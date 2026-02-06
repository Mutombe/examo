"""
Models for the schools app - B2B features.
"""

import random
import string
from django.conf import settings
from django.db import models

from apps.exams.models import ExaminationBoard, Subject, Topic, Paper, Question


class School(models.Model):
    """Schools/institutions for B2B features."""

    SCHOOL_TYPE_CHOICES = [
        ('government', 'Government'),
        ('private', 'Private'),
        ('mission', 'Mission'),
        ('trust', 'Trust'),
    ]

    name = models.CharField(max_length=200)
    slug = models.SlugField(unique=True)
    school_type = models.CharField(max_length=20, choices=SCHOOL_TYPE_CHOICES)

    # Location
    province = models.CharField(max_length=100)
    city = models.CharField(max_length=100)
    address = models.TextField(blank=True)

    # Contact
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    website = models.URLField(blank=True)

    # Branding
    logo = models.ImageField(upload_to='schools/logos/', null=True, blank=True)
    primary_color = models.CharField(max_length=7, default='#3B82F6')

    # Settings
    default_board = models.ForeignKey(
        ExaminationBoard,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )
    parent_portal_enabled = models.BooleanField(default=False)

    # Status
    is_verified = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    # Stats (denormalized for performance)
    total_students = models.PositiveIntegerField(default=0)
    total_teachers = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class TeacherProfile(models.Model):
    """Extended profile for teachers with school-specific information."""

    TEACHER_ROLE_CHOICES = [
        ('teacher', 'Teacher'),
        ('hod', 'Head of Department'),
        ('deputy', 'Deputy Head'),
        ('head', 'Headmaster/Headmistress'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='teacher_profile'
    )
    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='teachers'
    )

    # Professional info
    employee_id = models.CharField(max_length=50, blank=True)
    department = models.CharField(max_length=100, blank=True)
    role = models.CharField(max_length=20, choices=TEACHER_ROLE_CHOICES, default='teacher')

    # Subjects they teach
    subjects = models.ManyToManyField(Subject, related_name='teachers', blank=True)

    # Permissions
    can_create_assignments = models.BooleanField(default=True)
    can_view_school_analytics = models.BooleanField(default=False)
    can_manage_teachers = models.BooleanField(default=False)
    can_manage_students = models.BooleanField(default=False)

    is_active = models.BooleanField(default=True)
    joined_school_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'school']

    def __str__(self):
        return f"{self.user.get_full_name() or self.user.email} - {self.school.name}"


class Class(models.Model):
    """Represents a class/group of students taught by a teacher."""

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='classes'
    )
    teacher = models.ForeignKey(
        TeacherProfile,
        on_delete=models.CASCADE,
        related_name='classes'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='classes'
    )

    # Class identification
    name = models.CharField(max_length=100)  # "Form 4A", "O-Level Math Group 2"
    form_level = models.PositiveSmallIntegerField()  # 1-6

    # Academic period
    academic_year = models.PositiveIntegerField()
    term = models.PositiveSmallIntegerField(null=True, blank=True)

    # Students
    students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        related_name='enrolled_classes',
        blank=True
    )
    max_students = models.PositiveIntegerField(default=50)

    # Join settings
    join_code = models.CharField(max_length=8, unique=True, blank=True)
    allow_join = models.BooleanField(default=True)

    # Status
    is_active = models.BooleanField(default=True)
    archived_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name_plural = 'Classes'
        ordering = ['-academic_year', 'form_level', 'name']

    def __str__(self):
        return f"{self.name} - {self.subject.name} ({self.academic_year})"

    def save(self, *args, **kwargs):
        if not self.join_code:
            self.join_code = self._generate_join_code()
        super().save(*args, **kwargs)

    def _generate_join_code(self):
        """Generate a unique 8-character join code."""
        while True:
            code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))
            if not Class.objects.filter(join_code=code).exists():
                return code

    @property
    def student_count(self):
        return self.students.count()


class TeacherInvitation(models.Model):
    """Invitation for a teacher to join a school."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('expired', 'Expired'),
        ('cancelled', 'Cancelled'),
    ]

    school = models.ForeignKey(
        School,
        on_delete=models.CASCADE,
        related_name='invitations'
    )
    invited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_invitations'
    )
    email = models.EmailField()
    role = models.CharField(max_length=20, choices=TeacherProfile.TEACHER_ROLE_CHOICES, default='teacher')
    department = models.CharField(max_length=100, blank=True)
    token = models.CharField(max_length=64, unique=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"Invite {self.email} to {self.school.name} ({self.status})"

    @property
    def is_expired(self):
        from django.utils import timezone
        return self.status == 'pending' and self.expires_at < timezone.now()

    @staticmethod
    def generate_token():
        return ''.join(random.choices(string.ascii_letters + string.digits, k=48))


class ParentChild(models.Model):
    """Links a parent user to a child (student) user."""

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('active', 'Active'),
        ('revoked', 'Revoked'),
    ]

    parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='parent_links'
    )
    child = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='child_links'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')
    linked_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['parent', 'child']

    def __str__(self):
        return f"{self.parent.email} -> {self.child.email} ({self.status})"


class Assignment(models.Model):
    """Teacher-created assignments for classes."""

    ASSIGNMENT_TYPE_CHOICES = [
        ('paper', 'Full Paper'),
        ('topics', 'Topic Practice'),
        ('custom', 'Custom Questions'),
        ('quiz', 'Quick Quiz'),
    ]

    teacher = models.ForeignKey(
        TeacherProfile,
        on_delete=models.CASCADE,
        related_name='assignments',
        null=True,
        blank=True,
    )
    assigned_by_parent = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='parent_assignments',
    )
    classes = models.ManyToManyField(Class, related_name='assignments', blank=True)
    assigned_students = models.ManyToManyField(
        settings.AUTH_USER_MODEL,
        blank=True,
        related_name='direct_assignments',
    )

    # Assignment details
    title = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    assignment_type = models.CharField(max_length=20, choices=ASSIGNMENT_TYPE_CHOICES)

    # Content
    papers = models.ManyToManyField(Paper, blank=True)
    topics = models.ManyToManyField(Topic, blank=True)
    questions = models.ManyToManyField(Question, blank=True)
    resources = models.ManyToManyField('library.Resource', blank=True, related_name='assignments')

    # Settings
    total_marks = models.PositiveIntegerField(default=0)
    time_limit_minutes = models.PositiveIntegerField(null=True, blank=True)
    attempts_allowed = models.PositiveSmallIntegerField(default=1)  # 0 = unlimited
    show_answers_after = models.BooleanField(default=True)

    # Scheduling
    available_from = models.DateTimeField()
    due_date = models.DateTimeField()
    late_submission_allowed = models.BooleanField(default=False)
    late_penalty_percent = models.PositiveSmallIntegerField(default=0)

    # Status
    is_published = models.BooleanField(default=False)
    is_mandatory = models.BooleanField(default=True)

    # Notifications
    notify_on_publish = models.BooleanField(default=True)
    remind_before_due = models.BooleanField(default=True)
    notify_parents = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-due_date']

    def __str__(self):
        return f"{self.title} - {self.teacher.user.email}"


class AssignmentSubmission(models.Model):
    """Student's submission for an assignment."""

    STATUS_CHOICES = [
        ('not_started', 'Not Started'),
        ('in_progress', 'In Progress'),
        ('submitted', 'Submitted'),
        ('late', 'Submitted Late'),
        ('graded', 'Graded'),
    ]

    assignment = models.ForeignKey(
        Assignment,
        on_delete=models.CASCADE,
        related_name='submissions'
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='assignment_submissions'
    )
    attempt = models.ForeignKey(
        'attempts.Attempt',
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    # Status tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='not_started')
    attempt_number = models.PositiveSmallIntegerField(default=1)

    # Timing
    started_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)

    # Results
    marks_earned = models.PositiveIntegerField(default=0)
    marks_possible = models.PositiveIntegerField(default=0)
    percentage_score = models.FloatField(null=True, blank=True)
    final_score = models.FloatField(null=True, blank=True)  # After any penalties

    # Teacher feedback
    teacher_feedback = models.TextField(blank=True)
    graded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='graded_submissions'
    )
    graded_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['assignment', 'student', 'attempt_number']
        ordering = ['-submitted_at']

    def __str__(self):
        return f"{self.student.email} - {self.assignment.title}"
