"""
Models for the attempts app.
"""

from django.conf import settings
from django.db import models

from apps.exams.models import Paper, Question


class Attempt(models.Model):
    """A student's attempt at a paper."""

    STATUS_CHOICES = [
        ('in_progress', 'In Progress'),
        ('paused', 'Paused'),
        ('submitted', 'Submitted'),
        ('marked', 'Marked'),
        ('abandoned', 'Abandoned'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='attempts'
    )
    paper = models.ForeignKey(
        Paper,
        on_delete=models.CASCADE,
        related_name='attempts'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='in_progress')
    started_at = models.DateTimeField(auto_now_add=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    marked_at = models.DateTimeField(null=True, blank=True)
    total_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    percentage = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    time_spent_seconds = models.IntegerField(default=0)

    # Enhanced tracking
    last_activity_at = models.DateTimeField(auto_now=True)
    paused_at = models.DateTimeField(null=True, blank=True)
    total_pause_time_seconds = models.IntegerField(default=0)
    last_question_index = models.IntegerField(default=0, help_text='Last question viewed (0-indexed)')
    questions_viewed = models.JSONField(
        default=list,
        blank=True,
        help_text='List of question IDs that have been viewed'
    )
    pdf_views = models.IntegerField(default=0, help_text='Number of times original PDF was viewed')
    pdf_last_page_viewed = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ['-started_at']

    def __str__(self):
        return f"{self.user.email} - {self.paper.title}"

    def calculate_score(self):
        """Calculate total score from all marked answers."""
        answers = self.answers.filter(score__isnull=False)
        if answers.exists():
            self.total_score = sum(a.score for a in answers)
            max_score = sum(a.question.marks for a in self.answers.all())
            if max_score > 0:
                self.percentage = (self.total_score / max_score) * 100
            self.save()


class Answer(models.Model):
    """A student's answer to a question."""

    attempt = models.ForeignKey(
        Attempt,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='answers'
    )
    answer_text = models.TextField(blank=True)
    selected_option = models.CharField(
        max_length=10,
        blank=True,
        help_text='For MCQ: the key of selected option (A, B, C, D)'
    )
    is_correct = models.BooleanField(null=True, blank=True)
    score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    feedback = models.TextField(blank=True)
    ai_marked = models.BooleanField(default=False)
    marked_at = models.DateTimeField(null=True, blank=True)

    # AI confidence indicators
    CONFIDENCE_CHOICES = [
        ('high', 'High'),
        ('medium', 'Medium'),
        ('low', 'Low'),
    ]
    confidence_score = models.FloatField(null=True, blank=True, help_text='0.0-1.0 confidence score')
    confidence_level = models.CharField(max_length=10, blank=True, choices=CONFIDENCE_CHOICES)

    # Per-question time tracking
    time_spent_seconds = models.IntegerField(default=0, help_text='Total time spent on this question')
    first_viewed_at = models.DateTimeField(null=True, blank=True)
    last_viewed_at = models.DateTimeField(null=True, blank=True)
    view_count = models.IntegerField(default=0, help_text='Number of times this question was viewed')
    pdf_reference_clicks = models.IntegerField(default=0, help_text='Times the PDF reference was clicked')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['question__order', 'question__question_number']
        unique_together = ['attempt', 'question']

    def __str__(self):
        return f"Answer to Q{self.question.question_number} by {self.attempt.user.email}"

    def mark_mcq(self):
        """Auto-mark MCQ question."""
        if self.question.question_type == 'mcq':
            self.is_correct = self.selected_option == self.question.correct_answer
            self.score = self.question.marks if self.is_correct else 0
            if self.is_correct:
                self.feedback = "Correct!"
            else:
                self.feedback = f"Incorrect. The correct answer is {self.question.correct_answer}."
            self.ai_marked = False
            self.confidence_score = 1.0
            self.confidence_level = 'high'
            self.save()
