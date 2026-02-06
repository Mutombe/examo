"""
Admin configuration for the progress app.
"""

from django.contrib import admin

from .models import TopicProgress, StudySession, Bookmark, AIMarkingLog


@admin.register(TopicProgress)
class TopicProgressAdmin(admin.ModelAdmin):
    list_display = ['user', 'topic', 'mastery_level', 'mastery_score', 'questions_attempted', 'last_practiced_at']
    list_filter = ['mastery_level', 'topic__syllabus__subject']
    search_fields = ['user__email', 'topic__name']
    raw_id_fields = ['user', 'topic']


@admin.register(StudySession)
class StudySessionAdmin(admin.ModelAdmin):
    list_display = ['user', 'date', 'time_spent_seconds', 'questions_attempted', 'questions_correct', 'streak_maintained']
    list_filter = ['date', 'streak_maintained']
    search_fields = ['user__email']
    raw_id_fields = ['user']
    date_hierarchy = 'date'


@admin.register(Bookmark)
class BookmarkAdmin(admin.ModelAdmin):
    list_display = ['user', 'question', 'folder', 'created_at']
    list_filter = ['folder', 'created_at']
    search_fields = ['user__email', 'question__question_text']
    raw_id_fields = ['user', 'question']


@admin.register(AIMarkingLog)
class AIMarkingLogAdmin(admin.ModelAdmin):
    list_display = ['answer', 'model_used', 'marks_awarded', 'confidence_score', 'tokens_used', 'latency_ms', 'created_at']
    list_filter = ['model_used', 'created_at']
    search_fields = ['answer__attempt__user__email']
    raw_id_fields = ['answer']
    readonly_fields = ['prompt_sent', 'response_received', 'tokens_used', 'latency_ms', 'marks_awarded', 'confidence_score']
