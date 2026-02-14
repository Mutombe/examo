"""
Admin configuration for the attempts app.
"""

from django.contrib import admin

from .models import Attempt, Answer, MarkingProgress


class AnswerInline(admin.TabularInline):
    model = Answer
    extra = 0
    readonly_fields = ['question', 'is_correct', 'score', 'feedback', 'ai_marked', 'marked_at']


@admin.register(Attempt)
class AttemptAdmin(admin.ModelAdmin):
    list_display = ['user', 'paper', 'status', 'total_score', 'percentage', 'started_at', 'submitted_at']
    list_filter = ['status', 'paper__syllabus__subject', 'paper__syllabus__board']
    search_fields = ['user__email', 'paper__title']
    inlines = [AnswerInline]
    readonly_fields = ['total_score', 'percentage', 'marked_at']


@admin.register(Answer)
class AnswerAdmin(admin.ModelAdmin):
    list_display = ['attempt', 'question', 'is_correct', 'score', 'ai_marked', 'marked_at']
    list_filter = ['is_correct', 'ai_marked', 'question__question_type']
    search_fields = ['attempt__user__email', 'question__question_text']
    raw_id_fields = ['attempt', 'question']


@admin.register(MarkingProgress)
class MarkingProgressAdmin(admin.ModelAdmin):
    list_display = ['attempt', 'status', 'questions_marked', 'total_questions', 'started_at', 'completed_at']
    list_filter = ['status']
    readonly_fields = ['messages', 'started_at', 'completed_at']
    raw_id_fields = ['attempt']
