"""
Custom User model for ExamRevise Zimbabwe.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    """Extended User model with student profile information."""

    ROLE_CHOICES = [
        ('student', 'Student'),
        ('teacher', 'Teacher'),
        ('parent', 'Parent'),
        ('school_admin', 'School Administrator'),
        ('admin', 'Administrator'),
    ]

    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='student')

    # Profile
    phone_number = models.CharField(max_length=20, blank=True)
    whatsapp_number = models.CharField(max_length=20, blank=True)
    avatar = models.ImageField(upload_to='users/avatars/', null=True, blank=True)

    # Student-specific (school FK will be added after migration)
    school_name = models.CharField(max_length=200, blank=True)  # Legacy text field
    current_form = models.PositiveSmallIntegerField(null=True, blank=True)  # Form 1-6
    date_of_birth = models.DateField(null=True, blank=True)

    # Notification preferences
    email_notifications = models.BooleanField(default=True)
    whatsapp_notifications = models.BooleanField(default=True)

    # Premium status
    is_premium = models.BooleanField(default=False)
    premium_expires_at = models.DateTimeField(null=True, blank=True)

    # Stats (denormalized for performance)
    total_questions_attempted = models.PositiveIntegerField(default=0)
    total_marks_earned = models.PositiveIntegerField(default=0)
    total_marks_possible = models.PositiveIntegerField(default=0)
    current_streak_days = models.PositiveIntegerField(default=0)
    longest_streak_days = models.PositiveIntegerField(default=0)
    last_activity_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.email

    @property
    def display_name(self):
        if self.first_name:
            return f"{self.first_name} {self.last_name}".strip()
        return self.username
