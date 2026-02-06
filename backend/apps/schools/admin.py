"""
Admin configuration for the schools app.
"""

from django.contrib import admin

from .models import School, TeacherProfile, Class, Assignment, AssignmentSubmission


@admin.register(School)
class SchoolAdmin(admin.ModelAdmin):
    list_display = ['name', 'school_type', 'city', 'province', 'is_verified', 'is_active', 'total_students']
    list_filter = ['school_type', 'province', 'is_verified', 'is_active']
    search_fields = ['name', 'city', 'email']
    prepopulated_fields = {'slug': ('name',)}


@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'school', 'role', 'department', 'is_active']
    list_filter = ['school', 'role', 'is_active']
    search_fields = ['user__email', 'user__first_name', 'user__last_name', 'school__name']
    raw_id_fields = ['user', 'school']
    filter_horizontal = ['subjects']


@admin.register(Class)
class ClassAdmin(admin.ModelAdmin):
    list_display = ['name', 'subject', 'teacher', 'school', 'form_level', 'academic_year', 'student_count', 'is_active']
    list_filter = ['school', 'subject', 'form_level', 'academic_year', 'is_active']
    search_fields = ['name', 'teacher__user__email', 'school__name']
    raw_id_fields = ['teacher', 'school', 'subject']
    filter_horizontal = ['students']


class AssignmentSubmissionInline(admin.TabularInline):
    model = AssignmentSubmission
    extra = 0
    readonly_fields = ['student', 'status', 'marks_earned', 'percentage_score', 'submitted_at']
    can_delete = False


@admin.register(Assignment)
class AssignmentAdmin(admin.ModelAdmin):
    list_display = ['title', 'teacher', 'assignment_type', 'due_date', 'is_published', 'total_marks']
    list_filter = ['assignment_type', 'is_published', 'is_mandatory', 'due_date']
    search_fields = ['title', 'description', 'teacher__user__email']
    raw_id_fields = ['teacher']
    filter_horizontal = ['classes', 'papers', 'topics', 'questions']
    inlines = [AssignmentSubmissionInline]


@admin.register(AssignmentSubmission)
class AssignmentSubmissionAdmin(admin.ModelAdmin):
    list_display = ['student', 'assignment', 'status', 'marks_earned', 'percentage_score', 'submitted_at']
    list_filter = ['status', 'assignment__assignment_type']
    search_fields = ['student__email', 'assignment__title']
    raw_id_fields = ['assignment', 'student', 'attempt', 'graded_by']
