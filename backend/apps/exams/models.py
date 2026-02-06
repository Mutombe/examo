"""
Models for the exams app.
"""

from django.conf import settings
from django.db import models


class ExaminationBoard(models.Model):
    """Examination board (e.g., ZIMSEC, Cambridge)."""

    name = models.CharField(max_length=100, unique=True)
    short_name = models.CharField(max_length=20, unique=True)
    description = models.TextField(blank=True)
    country = models.CharField(max_length=100, default='Zimbabwe')
    website = models.URLField(blank=True)
    logo = models.ImageField(upload_to='boards/', blank=True, null=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Subject(models.Model):
    """Subject (e.g., Mathematics, Physics)."""

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=20, blank=True)
    description = models.TextField(blank=True)
    icon = models.CharField(max_length=50, blank=True)  # For frontend icon name
    color = models.CharField(max_length=7, default='#3B82F6')  # Hex color
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return self.name


class Syllabus(models.Model):
    """Links a board with a subject at a specific level."""

    LEVEL_CHOICES = [
        ('o_level', 'O Level'),
        ('a_level', 'A Level'),
        ('igcse', 'IGCSE'),
        ('as_level', 'AS Level'),
    ]

    board = models.ForeignKey(
        ExaminationBoard,
        on_delete=models.CASCADE,
        related_name='syllabi'
    )
    subject = models.ForeignKey(
        Subject,
        on_delete=models.CASCADE,
        related_name='syllabi'
    )
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES)
    syllabus_code = models.CharField(max_length=20, blank=True)
    year_from = models.IntegerField(null=True, blank=True)
    year_to = models.IntegerField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['board', 'subject', 'level']
        unique_together = ['board', 'subject', 'level']
        verbose_name_plural = 'Syllabi'

    def __str__(self):
        return f"{self.board.short_name} {self.subject.name} ({self.get_level_display()})"


class Topic(models.Model):
    """Syllabus topics for organizing questions and tracking mastery."""

    syllabus = models.ForeignKey(
        Syllabus,
        on_delete=models.CASCADE,
        related_name='topics'
    )
    parent = models.ForeignKey(
        'self',
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name='subtopics'
    )
    name = models.CharField(max_length=200)
    slug = models.SlugField(max_length=200)
    description = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)
    objectives = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        unique_together = ['syllabus', 'slug']

    def __str__(self):
        if self.parent:
            return f"{self.parent.name} > {self.name}"
        return self.name


class Paper(models.Model):
    """An examination paper."""

    PAPER_TYPE_CHOICES = [
        ('paper_1', 'Paper 1'),
        ('paper_2', 'Paper 2'),
        ('paper_3', 'Paper 3'),
        ('paper_4', 'Paper 4'),
        ('paper_5', 'Paper 5'),
        ('paper_6', 'Paper 6'),
        ('practical', 'Practical'),
        ('theory', 'Theory'),
    ]

    SESSION_CHOICES = [
        ('june', 'June'),
        ('november', 'November'),
        ('march', 'March'),
    ]

    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]

    syllabus = models.ForeignKey(
        Syllabus,
        on_delete=models.CASCADE,
        related_name='papers'
    )
    title = models.CharField(max_length=200)
    paper_type = models.CharField(max_length=20, choices=PAPER_TYPE_CHOICES)
    year = models.IntegerField()
    session = models.CharField(max_length=20, choices=SESSION_CHOICES)
    duration_minutes = models.IntegerField(default=120)
    total_marks = models.IntegerField(default=100)
    instructions = models.TextField(blank=True)
    pdf_file = models.FileField(upload_to='papers/', blank=True, null=True)
    marking_scheme_file = models.FileField(
        upload_to='marking_schemes/',
        blank=True,
        null=True,
        help_text='Optional marking scheme PDF'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='pending'
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='uploaded_papers'
    )
    rejection_reason = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-year', 'session', 'paper_type']

    def __str__(self):
        return f"{self.syllabus} - {self.title} ({self.year} {self.get_session_display()})"

    @property
    def question_count(self):
        return self.questions.count()


class Question(models.Model):
    """An individual question within a paper."""

    QUESTION_TYPE_CHOICES = [
        ('mcq', 'Multiple Choice'),
        ('short_answer', 'Short Answer'),
        ('long_answer', 'Long Answer'),
        ('structured', 'Structured'),
        ('essay', 'Essay'),
    ]

    paper = models.ForeignKey(
        Paper,
        on_delete=models.CASCADE,
        related_name='questions'
    )
    question_number = models.CharField(max_length=20)  # e.g., "1", "2a", "2b(i)"
    question_text = models.TextField()
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES)
    marks = models.IntegerField(default=1)

    # For MCQ questions
    options = models.JSONField(
        blank=True,
        null=True,
        help_text='List of options for MCQ: [{"key": "A", "text": "Option A"}, ...]'
    )
    correct_answer = models.CharField(
        max_length=10,
        blank=True,
        help_text='For MCQ: the key of correct option (A, B, C, D)'
    )

    # For written answers
    marking_scheme = models.TextField(
        blank=True,
        help_text='Marking guidelines for AI marking'
    )
    sample_answer = models.TextField(blank=True)

    # Metadata
    topic_text = models.CharField(max_length=100, blank=True)  # Legacy text field
    topics = models.ManyToManyField(
        'Topic',
        related_name='questions',
        blank=True
    )
    difficulty = models.CharField(
        max_length=20,
        choices=[('easy', 'Easy'), ('medium', 'Medium'), ('hard', 'Hard')],
        default='medium'
    )
    image = models.ImageField(upload_to='questions/', blank=True, null=True)
    order = models.IntegerField(default=0)

    # Source reference - for linking back to original PDF
    source_page = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text='Page number in the original PDF where this question appears'
    )
    source_position = models.CharField(
        max_length=20,
        blank=True,
        choices=[
            ('top', 'Top of page'),
            ('upper', 'Upper section'),
            ('middle', 'Middle of page'),
            ('lower', 'Lower section'),
            ('bottom', 'Bottom of page'),
        ],
        help_text='Approximate vertical position of question on the page'
    )
    has_diagram = models.BooleanField(
        default=False,
        help_text='Whether this question includes a diagram/figure/graph'
    )
    diagram_description = models.TextField(
        blank=True,
        help_text='AI-generated description of diagrams/figures in this question'
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['paper', 'order', 'question_number']

    def __str__(self):
        return f"Q{self.question_number} - {self.paper}"
