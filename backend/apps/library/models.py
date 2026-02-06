"""
Models for the Resource Library.
Students can browse, read, and share educational resources in-app.
No downloads - reading only.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone


class ResourceCategory(models.Model):
    """Category for organizing resources (e.g., Chemistry Booklets, Study Guides)."""

    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    icon = models.CharField(
        max_length=50,
        blank=True,
        help_text='Lucide icon name (e.g., book-open, flask, atom)'
    )
    color = models.CharField(max_length=7, default='#6366F1')
    order = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['order', 'name']
        verbose_name_plural = 'Resource categories'

    def __str__(self):
        return self.name


class Resource(models.Model):
    """An educational resource (PDF booklet, study guide, notes, etc.)."""

    RESOURCE_TYPE_CHOICES = [
        ('booklet', 'Option Booklet'),
        ('study_guide', 'Study Guide'),
        ('notes', 'Notes'),
        ('syllabus', 'Syllabus Document'),
        ('formula_sheet', 'Formula Sheet'),
        ('data_booklet', 'Data Booklet'),
        ('revision', 'Revision Material'),
        ('other', 'Other'),
    ]

    LEVEL_CHOICES = [
        ('o_level', 'O Level'),
        ('a_level', 'A Level'),
        ('igcse', 'IGCSE'),
        ('as_level', 'AS Level'),
        ('all', 'All Levels'),
    ]

    title = models.CharField(max_length=255)
    slug = models.SlugField(max_length=255, unique=True)
    description = models.TextField(blank=True)
    resource_type = models.CharField(max_length=20, choices=RESOURCE_TYPE_CHOICES, default='booklet')
    category = models.ForeignKey(
        ResourceCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='resources'
    )

    # Subject/level linking
    subject = models.ForeignKey(
        'exams.Subject',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='library_resources'
    )
    level = models.CharField(max_length=20, choices=LEVEL_CHOICES, default='a_level')

    # The PDF file - stored in cloud
    file = models.FileField(upload_to='library/')
    page_count = models.PositiveIntegerField(default=0)
    file_size_bytes = models.PositiveIntegerField(default=0)

    # Cover/thumbnail
    cover_image = models.ImageField(upload_to='library/covers/', blank=True, null=True)
    cover_color = models.CharField(max_length=7, default='#4F46E5')

    # Engagement & metadata
    view_count = models.PositiveIntegerField(default=0)
    share_count = models.PositiveIntegerField(default=0)
    avg_rating = models.DecimalField(max_digits=3, decimal_places=2, default=0)
    total_ratings = models.PositiveIntegerField(default=0)

    # Tags for search
    tags = models.JSONField(default=list, blank=True)

    # Uploaded by
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True
    )

    is_featured = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-is_featured', '-view_count', '-created_at']

    def __str__(self):
        return self.title

    @property
    def file_size_display(self):
        """Human-readable file size."""
        size = self.file_size_bytes
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        else:
            return f"{size / (1024 * 1024):.1f} MB"


class ReadingProgress(models.Model):
    """Track a user's reading progress on a resource."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='reading_progress'
    )
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name='reading_progress'
    )

    current_page = models.PositiveIntegerField(default=1)
    total_pages_read = models.PositiveIntegerField(default=0)
    time_spent_seconds = models.PositiveIntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    last_read_at = models.DateTimeField(auto_now=True)
    started_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ['user', 'resource']
        ordering = ['-last_read_at']

    def __str__(self):
        return f"{self.user} - {self.resource.title} (p.{self.current_page})"

    @property
    def progress_percent(self):
        if self.resource.page_count == 0:
            return 0
        return min(100, round((self.current_page / self.resource.page_count) * 100))


class ResourceRating(models.Model):
    """User rating for a resource."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='resource_ratings'
    )
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name='ratings'
    )
    rating = models.PositiveSmallIntegerField(
        help_text='Rating from 1 to 5'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ['user', 'resource']

    def __str__(self):
        return f"{self.user} rated {self.resource.title}: {self.rating}/5"

    def save(self, *args, **kwargs):
        self.rating = max(1, min(5, self.rating))
        super().save(*args, **kwargs)
        # Update resource average
        from django.db.models import Avg, Count
        stats = self.resource.ratings.aggregate(
            avg=Avg('rating'),
            count=Count('id')
        )
        self.resource.avg_rating = stats['avg'] or 0
        self.resource.total_ratings = stats['count']
        self.resource.save(update_fields=['avg_rating', 'total_ratings'])


class ResourceHighlight(models.Model):
    """User highlights/notes on a specific page of a resource."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='resource_highlights'
    )
    resource = models.ForeignKey(
        Resource,
        on_delete=models.CASCADE,
        related_name='highlights'
    )
    page_number = models.PositiveIntegerField()
    note = models.TextField(blank=True)
    color = models.CharField(max_length=7, default='#FDE047')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['page_number', 'created_at']

    def __str__(self):
        return f"{self.user} - p.{self.page_number} of {self.resource.title}"
