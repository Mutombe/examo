"""
Background marking runner — spawns a daemon thread that marks an attempt
independently of the HTTP request/response cycle.
"""

import logging
import random
import threading
from datetime import timedelta

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.db import close_old_connections
from django.utils import timezone

logger = logging.getLogger(__name__)

PERSONALITY_MESSAGES = [
    "Hmm, interesting approach...",
    "Let me check the marking scheme...",
    "This is looking good so far!",
    "Taking a closer look at this one...",
    "Comparing with the model answer...",
    "Checking for key terms...",
    "Evaluating your reasoning...",
    "Almost there, just a few more to go...",
    "Reading through your response...",
    "Let me consider partial marks here...",
]

HIGH_SCORE_MESSAGES = [
    "Excellent work on this one!",
    "Strong answer — well done!",
    "Great understanding shown here!",
    "You nailed this one!",
]

LOW_SCORE_MESSAGES = [
    "This topic might need some revision.",
    "Don't worry — focus on the key concepts next time.",
    "Review the marking scheme to see what was expected.",
]


def start_marking_thread(attempt_id):
    """Spawn a background daemon thread to mark the attempt."""
    thread = threading.Thread(
        target=_run_marking,
        args=(attempt_id,),
        daemon=True,
        name=f"marking-{attempt_id}",
    )
    thread.start()
    return thread


def _run_marking(attempt_id):
    """Main marking workflow — runs inside a background thread."""
    try:
        close_old_connections()
        from .models import Attempt, MarkingProgress

        attempt = Attempt.objects.select_related(
            'paper', 'paper__syllabus', 'paper__syllabus__subject', 'user'
        ).get(pk=attempt_id)
        progress = attempt.marking_progress

        # --- Begin marking ---
        progress.status = 'marking'
        progress.started_at = timezone.now()
        progress.add_message('info', "Alright, let's see what you've got!")
        progress.save(update_fields=['status', 'started_at', 'messages'])

        # 1. Auto-mark MCQs (fast, no API)
        close_old_connections()
        mcq_answers = list(attempt.answers.filter(question__question_type='mcq').select_related('question'))
        mcq_correct = 0
        for answer in mcq_answers:
            answer.mark_mcq()
            if answer.is_correct:
                mcq_correct += 1
            progress.questions_marked += 1

        if mcq_answers:
            progress.add_message(
                'info',
                f"Multiple choice: {mcq_correct}/{len(mcq_answers)} correct"
            )
            progress.save(update_fields=['questions_marked', 'messages'])

        # 2. Mark written answers with AI
        close_old_connections()
        from apps.ai_marking.services import AIMarkingService
        marking_service = AIMarkingService()

        written_answers = list(
            attempt.answers.exclude(question__question_type='mcq')
            .select_related('question')
            .order_by('question__order', 'question__question_number')
        )

        total_written = len(written_answers)
        halfway = total_written // 2

        for idx, answer in enumerate(written_answers):
            close_old_connections()
            q = answer.question
            q_label = f"Q{q.question_number}"
            preview = (q.question_text or '')[:80]
            if len(q.question_text or '') > 80:
                preview += '...'

            progress.current_question_number = q.question_number
            progress.current_question_text = preview[:200]
            progress.add_message('progress', f"Marking {q_label}: {preview}")
            progress.save(update_fields=[
                'current_question_number', 'current_question_text', 'messages'
            ])

            # Random personality message (40% chance)
            if random.random() < 0.4:
                progress.add_message('fun', random.choice(PERSONALITY_MESSAGES))
                progress.save(update_fields=['messages'])

            # Mark the answer
            marking_service.mark_answer(answer)

            close_old_connections()
            # Reload answer to get saved score
            answer.refresh_from_db()

            # Result message
            score = answer.score or 0
            max_marks = q.marks
            feedback_snippet = (answer.feedback or '')[:80]
            if len(answer.feedback or '') > 80:
                feedback_snippet += '...'

            progress.questions_marked += 1
            progress.add_message(
                'result',
                f"{q_label}: {score}/{max_marks} — {feedback_snippet}"
            )
            progress.save(update_fields=['questions_marked', 'messages'])

            # High/low score flavor
            if max_marks > 0:
                pct = float(score) / max_marks
                if pct >= 0.8:
                    progress.add_message('fun', random.choice(HIGH_SCORE_MESSAGES))
                    progress.save(update_fields=['messages'])
                elif pct < 0.4:
                    progress.add_message('fun', random.choice(LOW_SCORE_MESSAGES))
                    progress.save(update_fields=['messages'])

            # Milestone messages
            if total_written > 2 and idx + 1 == halfway:
                progress.add_message('info', f"Halfway there — {idx + 1}/{total_written} written questions done!")
                progress.save(update_fields=['messages'])
            elif total_written > 3 and idx + 1 == total_written - 1:
                progress.add_message('info', "Just one more to go!")
                progress.save(update_fields=['messages'])

        # 3. Calculate score
        close_old_connections()
        progress.status = 'calculating'
        progress.current_question_number = ''
        progress.current_question_text = ''
        progress.add_message('info', 'Calculating your final score...')
        progress.save(update_fields=['status', 'current_question_number', 'current_question_text', 'messages'])

        attempt.status = 'marked'
        attempt.marked_at = timezone.now()
        attempt.calculate_score()

        # 4. Sync progress tables
        _sync_progress_tables(attempt)

        # 5. Mark completed
        close_old_connections()
        progress.refresh_from_db()
        pct = attempt.percentage or 0
        progress.status = 'completed'
        progress.completed_at = timezone.now()
        progress.add_message('complete', f"All done! Final score: {pct:.0f}%")
        progress.save(update_fields=['status', 'completed_at', 'messages'])

        # 6. Create notification
        _create_notification(attempt, progress)

        # 7. Send email if user left
        _maybe_send_email(attempt, progress)

    except Exception:
        logger.exception(f"Marking thread failed for attempt {attempt_id}")
        try:
            close_old_connections()
            from .models import MarkingProgress
            progress = MarkingProgress.objects.get(attempt_id=attempt_id)
            progress.status = 'failed'
            progress.error_message = 'An unexpected error occurred during marking. Please try again.'
            progress.add_message('error', 'Something went wrong. Please try submitting again.')
            progress.completed_at = timezone.now()
            progress.save(update_fields=['status', 'error_message', 'messages', 'completed_at'])

            # Create failure notification
            from .models import Attempt
            attempt = Attempt.objects.select_related('paper', 'user').get(pk=attempt_id)
            from apps.notifications.models import Notification
            Notification.objects.create(
                user=attempt.user,
                notification_type='marking_failed',
                title=f'Marking failed for {attempt.paper.title}',
                message='There was an error marking your paper. Please try submitting again.',
                link=f'/papers/{attempt.paper_id}/results/{attempt.id}',
                metadata={'attempt_id': attempt.id, 'paper_id': attempt.paper_id},
            )
        except Exception:
            logger.exception("Failed to update progress after marking error")


def _sync_progress_tables(attempt):
    """Sync TopicProgress, StudySession, and streak after marking."""
    close_old_connections()
    from apps.progress.models import TopicProgress, StudySession

    user = attempt.user
    all_answers = attempt.answers.select_related('question').prefetch_related('question__topics')

    # 1. Update TopicProgress for each topic
    topic_stats = {}
    for answer in all_answers:
        for topic in answer.question.topics.all():
            if topic.id not in topic_stats:
                topic_stats[topic.id] = {
                    'attempted': 0, 'correct': 0, 'earned': 0, 'possible': 0
                }
            stats = topic_stats[topic.id]
            stats['attempted'] += 1
            stats['correct'] += 1 if answer.is_correct else 0
            stats['earned'] += answer.score or 0
            stats['possible'] += answer.question.marks

    close_old_connections()
    for topic_id, stats in topic_stats.items():
        tp, _ = TopicProgress.objects.get_or_create(
            user=user, topic_id=topic_id
        )
        tp.questions_attempted += stats['attempted']
        tp.questions_correct += stats['correct']
        tp.total_marks_earned += stats['earned']
        tp.total_marks_possible += stats['possible']
        tp.last_practiced_at = timezone.now()
        tp.update_mastery()  # saves internally

    # 2. Update StudySession for today
    close_old_connections()
    today = timezone.now().date()
    total_attempted = all_answers.count()
    total_correct = sum(1 for a in all_answers if a.is_correct)
    total_earned = sum(a.score or 0 for a in all_answers)
    total_possible = sum(a.question.marks for a in all_answers)

    session, created = StudySession.objects.get_or_create(
        user=user, date=today,
        defaults={
            'time_spent_seconds': attempt.time_spent_seconds or 0,
            'questions_attempted': total_attempted,
            'questions_correct': total_correct,
            'marks_earned': total_earned,
            'marks_possible': total_possible,
        }
    )
    if not created:
        session.time_spent_seconds += attempt.time_spent_seconds or 0
        session.questions_attempted += total_attempted
        session.questions_correct += total_correct
        session.marks_earned += total_earned
        session.marks_possible += total_possible
        session.save()

    # 3. Update user streak
    close_old_connections()
    yesterday = today - timedelta(days=1)
    studied_yesterday = StudySession.objects.filter(user=user, date=yesterday).exists()
    if studied_yesterday:
        user.current_streak_days += 1
    else:
        user.current_streak_days = 1
    session.streak_maintained = studied_yesterday
    session.save(update_fields=['streak_maintained'])
    user.longest_streak_days = max(user.longest_streak_days, user.current_streak_days)
    user.last_activity_at = timezone.now()
    user.save(update_fields=['current_streak_days', 'longest_streak_days', 'last_activity_at'])


def _create_notification(attempt, progress):
    """Create an in-app notification when marking completes."""
    close_old_connections()
    from apps.notifications.models import Notification

    pct = attempt.percentage or 0
    Notification.objects.create(
        user=attempt.user,
        notification_type='marking_complete',
        title=f'Results ready: {attempt.paper.title}',
        message=f'Your paper has been marked! You scored {pct:.0f}%.',
        link=f'/papers/{attempt.paper_id}/results/{attempt.id}',
        metadata={'attempt_id': attempt.id, 'paper_id': attempt.paper_id, 'percentage': float(pct)},
    )
    progress.notification_sent = True
    progress.save(update_fields=['notification_sent'])


def _maybe_send_email(attempt, progress):
    """Send results email if the user navigated away (last_polled_at stale > 15s)."""
    close_old_connections()
    user = attempt.user

    if not user.email_notifications:
        return

    # If the user was polling recently, they're watching — skip email
    if progress.last_polled_at:
        stale_seconds = (timezone.now() - progress.last_polled_at).total_seconds()
        if stale_seconds < 15:
            return

    _send_results_email(attempt)
    progress.email_sent = True
    progress.save(update_fields=['email_sent'])


def _send_results_email(attempt):
    """Send the marking-complete HTML email."""
    user = attempt.user
    paper = attempt.paper
    pct = attempt.percentage or 0
    score = attempt.total_score or 0
    max_score = sum(a.question.marks for a in attempt.answers.select_related('question'))

    frontend_url = getattr(settings, 'FRONTEND_URL', 'https://examrevise.co.zw')
    site_url = getattr(settings, 'SITE_URL', 'https://examrevise.co.zw')
    results_url = f"{frontend_url}/papers/{paper.id}/results/{attempt.id}"

    subject = f"Your {paper.title} results are ready!"

    text_body = (
        f"Hi {user.first_name or 'there'},\n\n"
        f"Your paper \"{paper.title}\" has been marked.\n"
        f"Score: {score}/{max_score} ({pct:.0f}%)\n\n"
        f"View your full results: {results_url}\n\n"
        f"ExamRevise Zimbabwe — examrevise.co.zw"
    )

    html_body = f"""
    <div style="max-width: 520px; margin: 0 auto; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px; margin: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #111827; font-size: 20px; margin: 0;">Your Results Are Ready!</h2>
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Hi {user.first_name or 'there'}, your paper has been marked.
        </p>
        <div style="background: #f9fafb; border-radius: 8px; padding: 20px; text-align: center; margin: 0 0 24px;">
          <p style="color: #6b7280; font-size: 13px; margin: 0 0 4px;">{paper.title}</p>
          <p style="color: #111827; font-size: 32px; font-weight: 700; margin: 0;">{pct:.0f}%</p>
          <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0;">{score}/{max_score} marks</p>
        </div>
        <div style="text-align: center; margin: 28px 0;">
          <a href="{results_url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 32px; border-radius: 8px;">
            View Full Results
          </a>
        </div>
      </div>
      <div style="text-align: center; margin-top: 24px;">
        <p style="color: #9ca3af; font-size: 12px; margin: 0;">
          ExamRevise Zimbabwe &bull; <a href="{site_url}" style="color: #9ca3af;">examrevise.co.zw</a>
        </p>
      </div>
    </div>
    """

    try:
        msg = EmailMultiAlternatives(
            subject=subject,
            body=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            to=[user.email],
        )
        msg.attach_alternative(html_body, 'text/html')
        msg.send(fail_silently=True)
    except Exception:
        logger.exception(f"Failed to send results email for attempt {attempt.id}")
