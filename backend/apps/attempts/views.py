"""
Views for the attempts app.
"""

from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsOwner
from apps.ai_marking.services import AIMarkingService
from .models import Attempt, Answer
from .serializers import (
    AttemptSerializer,
    AttemptCreateSerializer,
    AttemptListSerializer,
    AttemptSubmitSerializer,
    AttemptResultSerializer,
    AnswerCreateSerializer,
)


class AttemptListCreateView(generics.ListCreateAPIView):
    """List user's attempts or create a new attempt."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AttemptCreateSerializer
        return AttemptListSerializer

    def get_queryset(self):
        return Attempt.objects.filter(user=self.request.user).select_related(
            'paper', 'paper__syllabus', 'paper__syllabus__board', 'paper__syllabus__subject'
        )

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class AttemptDetailView(generics.RetrieveAPIView):
    """Get attempt details."""

    serializer_class = AttemptSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Attempt.objects.filter(user=self.request.user).select_related(
            'paper', 'paper__syllabus', 'paper__syllabus__board', 'paper__syllabus__subject'
        ).prefetch_related('answers', 'answers__question')


class AttemptSubmitView(APIView):
    """Submit an attempt for marking."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            attempt = Attempt.objects.get(pk=pk, user=request.user)
        except Attempt.DoesNotExist:
            return Response(
                {'error': 'Attempt not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if attempt.status != 'in_progress':
            return Response(
                {'error': 'Attempt has already been submitted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = AttemptSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Update attempt status
        attempt.status = 'submitted'
        attempt.submitted_at = timezone.now()
        attempt.time_spent_seconds = serializer.validated_data.get('time_spent_seconds', 0)
        attempt.save()

        # Mark MCQ answers automatically
        for answer in attempt.answers.filter(question__question_type='mcq'):
            answer.mark_mcq()

        # Mark written answers with AI
        marking_service = AIMarkingService()
        written_answers = attempt.answers.exclude(question__question_type='mcq')

        for answer in written_answers:
            marking_service.mark_answer(answer)

        # Calculate total score
        attempt.status = 'marked'
        attempt.marked_at = timezone.now()
        attempt.calculate_score()

        return Response(AttemptResultSerializer(attempt).data)


class AttemptResultView(generics.RetrieveAPIView):
    """Get attempt results with all answers and feedback."""

    serializer_class = AttemptResultSerializer
    permission_classes = [IsAuthenticated, IsOwner]

    def get_queryset(self):
        return Attempt.objects.filter(
            user=self.request.user,
            status='marked'
        ).select_related(
            'paper', 'paper__syllabus', 'paper__syllabus__board', 'paper__syllabus__subject'
        ).prefetch_related('answers', 'answers__question')


class AnswerCreateUpdateView(APIView):
    """Create or update an answer."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        # Add attempt ownership validation
        attempt_id = request.data.get('attempt')
        try:
            attempt = Attempt.objects.get(pk=attempt_id, user=request.user)
        except Attempt.DoesNotExist:
            return Response(
                {'error': 'Attempt not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = AnswerCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        answer = serializer.save()

        return Response({
            'id': answer.id,
            'question': answer.question_id,
            'answer_text': answer.answer_text,
            'selected_option': answer.selected_option,
        }, status=status.HTTP_201_CREATED)


class AttemptSyncAnswersView(APIView):
    """Bulk sync answers from guest session after registration."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            attempt = Attempt.objects.get(pk=pk, user=request.user)
        except Attempt.DoesNotExist:
            return Response(
                {'error': 'Attempt not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if attempt.status not in ['in_progress', 'paused']:
            return Response(
                {'error': 'Cannot sync answers for a completed attempt'},
                status=status.HTTP_400_BAD_REQUEST
            )

        answers_data = request.data.get('answers', [])
        time_spent_seconds = request.data.get('time_spent_seconds', 0)
        question_times = request.data.get('question_times', {})

        synced = 0
        for ans in answers_data:
            question_id = ans.get('question_id')
            if not question_id:
                continue

            answer, created = Answer.objects.update_or_create(
                attempt=attempt,
                question_id=question_id,
                defaults={
                    'answer_text': ans.get('answer_text', ''),
                    'selected_option': ans.get('selected_option', ''),
                }
            )

            # Update per-question time if provided
            q_time = question_times.get(str(question_id), 0)
            if q_time:
                answer.time_spent_seconds = q_time
                answer.save(update_fields=['time_spent_seconds', 'updated_at'])

            synced += 1

        if time_spent_seconds:
            attempt.time_spent_seconds = time_spent_seconds
            attempt.save(update_fields=['time_spent_seconds', 'last_activity_at'])

        return Response({
            'success': True,
            'synced_count': synced,
            'attempt_id': attempt.id,
        })


class AttemptTrackingView(APIView):
    """Track user activity during an attempt (question views, time, PDF views)."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        """Update tracking data for an attempt."""
        try:
            attempt = Attempt.objects.get(pk=pk, user=request.user)
        except Attempt.DoesNotExist:
            return Response(
                {'error': 'Attempt not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        if attempt.status not in ['in_progress', 'paused']:
            return Response(
                {'error': 'Cannot track completed attempt'},
                status=status.HTTP_400_BAD_REQUEST
            )

        data = request.data
        action = data.get('action')

        if action == 'view_question':
            # Track when a question is viewed
            question_id = data.get('question_id')
            question_index = data.get('question_index', 0)
            time_on_previous = data.get('time_on_previous_seconds', 0)

            attempt.last_question_index = question_index

            # Add to viewed questions if not already there
            if question_id and question_id not in attempt.questions_viewed:
                attempt.questions_viewed = attempt.questions_viewed + [question_id]

            # Update or create answer record for time tracking
            if question_id and time_on_previous > 0:
                previous_question_id = data.get('previous_question_id')
                if previous_question_id:
                    answer, created = Answer.objects.get_or_create(
                        attempt=attempt,
                        question_id=previous_question_id,
                        defaults={'answer_text': '', 'selected_option': ''}
                    )
                    answer.time_spent_seconds += time_on_previous
                    answer.last_viewed_at = timezone.now()
                    answer.view_count += 1
                    answer.save(update_fields=['time_spent_seconds', 'last_viewed_at', 'view_count', 'updated_at'])

            # Set first_viewed_at for new question
            if question_id:
                answer, created = Answer.objects.get_or_create(
                    attempt=attempt,
                    question_id=question_id,
                    defaults={'answer_text': '', 'selected_option': ''}
                )
                if not answer.first_viewed_at:
                    answer.first_viewed_at = timezone.now()
                    answer.save(update_fields=['first_viewed_at', 'updated_at'])

            attempt.save(update_fields=['last_question_index', 'questions_viewed', 'last_activity_at'])

        elif action == 'view_pdf':
            # Track PDF view
            page_number = data.get('page_number')
            question_id = data.get('question_id')

            attempt.pdf_views += 1
            if page_number:
                attempt.pdf_last_page_viewed = page_number
            attempt.save(update_fields=['pdf_views', 'pdf_last_page_viewed', 'last_activity_at'])

            # Track PDF clicks per question
            if question_id:
                answer, _ = Answer.objects.get_or_create(
                    attempt=attempt,
                    question_id=question_id,
                    defaults={'answer_text': '', 'selected_option': ''}
                )
                answer.pdf_reference_clicks += 1
                answer.save(update_fields=['pdf_reference_clicks', 'updated_at'])

        elif action == 'pause':
            # Pause the attempt
            attempt.status = 'paused'
            attempt.paused_at = timezone.now()
            attempt.save(update_fields=['status', 'paused_at', 'last_activity_at'])

        elif action == 'resume':
            # Resume a paused attempt
            if attempt.paused_at:
                pause_duration = (timezone.now() - attempt.paused_at).total_seconds()
                attempt.total_pause_time_seconds += int(pause_duration)
            attempt.status = 'in_progress'
            attempt.paused_at = None
            attempt.save(update_fields=['status', 'paused_at', 'total_pause_time_seconds', 'last_activity_at'])

        elif action == 'update_time':
            # Update total time spent
            time_spent = data.get('time_spent_seconds', 0)
            attempt.time_spent_seconds = time_spent
            attempt.save(update_fields=['time_spent_seconds', 'last_activity_at'])

        return Response({
            'success': True,
            'attempt_id': attempt.id,
            'status': attempt.status,
            'time_spent_seconds': attempt.time_spent_seconds,
            'questions_viewed_count': len(attempt.questions_viewed),
            'pdf_views': attempt.pdf_views,
        })
