"""
Admin configuration for the exams app.
"""

from django.contrib import admin

from .models import ExaminationBoard, Subject, Syllabus, Topic, Paper, Question


@admin.register(ExaminationBoard)
class ExaminationBoardAdmin(admin.ModelAdmin):
    list_display = ['name', 'short_name', 'country', 'is_active']
    list_filter = ['is_active', 'country']
    search_fields = ['name', 'short_name']


@admin.register(Subject)
class SubjectAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'is_active']
    list_filter = ['is_active']
    search_fields = ['name', 'code']


@admin.register(Syllabus)
class SyllabusAdmin(admin.ModelAdmin):
    list_display = ['__str__', 'board', 'subject', 'level', 'syllabus_code', 'is_active']
    list_filter = ['board', 'subject', 'level', 'is_active']
    search_fields = ['subject__name', 'board__name', 'syllabus_code']


@admin.register(Topic)
class TopicAdmin(admin.ModelAdmin):
    list_display = ['name', 'syllabus', 'parent', 'order', 'is_active']
    list_filter = ['syllabus__subject', 'syllabus__board', 'is_active']
    search_fields = ['name', 'description']
    prepopulated_fields = {'slug': ('name',)}
    raw_id_fields = ['syllabus', 'parent']


@admin.register(Paper)
class PaperAdmin(admin.ModelAdmin):
    list_display = ['title', 'syllabus', 'paper_type', 'year', 'session', 'total_marks', 'is_active']
    list_filter = ['syllabus__board', 'syllabus__subject', 'year', 'session', 'paper_type', 'is_active']
    search_fields = ['title', 'syllabus__subject__name']


@admin.register(Question)
class QuestionAdmin(admin.ModelAdmin):
    list_display = ['question_number', 'paper', 'question_type', 'marks', 'difficulty']
    list_filter = ['question_type', 'difficulty', 'paper__syllabus__subject']
    search_fields = ['question_text', 'paper__title']
    raw_id_fields = ['paper']
