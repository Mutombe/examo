"""
Models for progress tracking.
"""

from django.conf import settings
from django.db import models

from apps.exams.models import Topic, Question, Paper


class TopicProgress(models.Model):
    """Tracks a student's progress and mastery of each topic."""

    MASTERY_LEVEL_CHOICES = [
        ('not_started', 'Not Started'),
        ('beginner', 'Beginner'),
        ('developing', 'Developing'),
        ('proficient', 'Proficient'),
        ('mastered', 'Mastered'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='topic_progress'
    )
    topic = models.ForeignKey(
        Topic,
        on_delete=models.CASCADE,
        related_name='user_progress'
    )

    questions_attempted = models.PositiveIntegerField(default=0)
    questions_correct = models.PositiveIntegerField(default=0)
    total_marks_earned = models.PositiveIntegerField(default=0)
    total_marks_possible = models.PositiveIntegerField(default=0)

    mastery_level = models.CharField(
        max_length=20,
        choices=MASTERY_LEVEL_CHOICES,
        default='not_started'
    )
    mastery_score = models.FloatField(default=0)  # 0-100

    last_practiced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'topic']
        ordering = ['-last_practiced_at']

    def __str__(self):
        return f"{self.user.email} - {self.topic.name}"

    def update_mastery(self):
        """Calculate and update mastery level based on performance."""
        if self.total_marks_possible == 0:
            self.mastery_score = 0
            self.mastery_level = 'not_started'
        else:
            self.mastery_score = (self.total_marks_earned / self.total_marks_possible) * 100

            if self.mastery_score >= 90:
                self.mastery_level = 'mastered'
            elif self.mastery_score >= 75:
                self.mastery_level = 'proficient'
            elif self.mastery_score >= 50:
                self.mastery_level = 'developing'
            elif self.mastery_score > 0:
                self.mastery_level = 'beginner'
            else:
                self.mastery_level = 'not_started'

        self.save()


class StudySession(models.Model):
    """Tracks daily study activity for gamification and analytics."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='study_sessions'
    )
    date = models.DateField()

    time_spent_seconds = models.PositiveIntegerField(default=0)
    questions_attempted = models.PositiveIntegerField(default=0)
    questions_correct = models.PositiveIntegerField(default=0)
    marks_earned = models.PositiveIntegerField(default=0)
    marks_possible = models.PositiveIntegerField(default=0)

    streak_maintained = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'date']
        ordering = ['-date']

    def __str__(self):
        return f"{self.user.email} - {self.date}"

    @property
    def accuracy(self):
        if self.questions_attempted == 0:
            return 0
        return (self.questions_correct / self.questions_attempted) * 100


class Bookmark(models.Model):
    """Allows students to save questions, papers, and resources for later review."""

    FOLDER_CHOICES = [
        ('default', 'Saved Questions'),
        ('review', 'Review Later'),
        ('difficult', 'Difficult Questions'),
        ('favorite', 'Favorites'),
    ]

    BOOKMARK_TYPE_CHOICES = [
        ('question', 'Question'),
        ('paper', 'Paper'),
        ('resource', 'Resource'),
    ]

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='bookmarks'
    )
    bookmark_type = models.CharField(
        max_length=20,
        choices=BOOKMARK_TYPE_CHOICES,
        default='question'
    )
    question = models.ForeignKey(
        Question,
        on_delete=models.CASCADE,
        related_name='bookmarks',
        null=True,
        blank=True
    )
    paper = models.ForeignKey(
        Paper,
        on_delete=models.CASCADE,
        related_name='bookmarks',
        null=True,
        blank=True
    )
    resource = models.ForeignKey(
        'library.Resource',
        on_delete=models.CASCADE,
        related_name='bookmarks',
        null=True,
        blank=True
    )

    note = models.TextField(blank=True)
    folder = models.CharField(max_length=50, choices=FOLDER_CHOICES, default='default')

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        if self.bookmark_type == 'question' and self.question:
            return f"{self.user.email} - Q{self.question.question_number}"
        elif self.bookmark_type == 'paper' and self.paper:
            return f"{self.user.email} - {self.paper.title}"
        elif self.bookmark_type == 'resource' and self.resource:
            return f"{self.user.email} - {self.resource.title}"
        return f"{self.user.email} - bookmark"

    def clean(self):
        from django.core.exceptions import ValidationError
        if self.bookmark_type == 'question' and not self.question:
            raise ValidationError('Question is required for question bookmarks.')
        if self.bookmark_type == 'paper' and not self.paper:
            raise ValidationError('Paper is required for paper bookmarks.')
        if self.bookmark_type == 'resource' and not self.resource:
            raise ValidationError('Resource is required for resource bookmarks.')


class AIMarkingLog(models.Model):
    """Logs all AI marking requests for auditing, debugging, and cost tracking."""

    answer = models.ForeignKey(
        'attempts.Answer',
        on_delete=models.CASCADE,
        related_name='marking_logs'
    )

    # Request
    prompt_sent = models.TextField()
    model_used = models.CharField(max_length=50)

    # Response
    response_received = models.TextField()
    tokens_used = models.PositiveIntegerField(default=0)
    latency_ms = models.PositiveIntegerField(default=0)

    # Result
    marks_awarded = models.PositiveIntegerField(default=0)
    confidence_score = models.FloatField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Marking {self.answer.id} at {self.created_at}"
