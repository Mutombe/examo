"""
Serializers for the schools app.
"""

from rest_framework import serializers
from django.contrib.auth import get_user_model

from apps.exams.serializers import SubjectSerializer, PaperListSerializer, TopicListSerializer
from .models import School, TeacherProfile, Class, Assignment, AssignmentSubmission, TeacherInvitation

User = get_user_model()


class SchoolSerializer(serializers.ModelSerializer):
    """Serializer for School."""

    class Meta:
        model = School
        fields = [
            'id', 'name', 'slug', 'school_type', 'province', 'city',
            'address', 'email', 'phone', 'website', 'logo', 'primary_color',
            'is_verified', 'is_active', 'total_students', 'total_teachers',
            'created_at'
        ]
        read_only_fields = ['slug', 'is_verified', 'total_students', 'total_teachers']


class TeacherInvitationSerializer(serializers.ModelSerializer):
    """Serializer for teacher invitations."""

    school_name = serializers.CharField(source='school.name', read_only=True)
    invited_by_name = serializers.CharField(source='invited_by.display_name', read_only=True)

    class Meta:
        model = TeacherInvitation
        fields = [
            'id', 'school', 'school_name', 'invited_by', 'invited_by_name',
            'email', 'role', 'department', 'status', 'expires_at', 'created_at',
        ]
        read_only_fields = ['id', 'school', 'invited_by', 'status', 'expires_at', 'created_at']


class TeacherProfileSerializer(serializers.ModelSerializer):
    """Serializer for TeacherProfile."""

    user_email = serializers.CharField(source='user.email', read_only=True)
    user_name = serializers.CharField(source='user.display_name', read_only=True)
    school_name = serializers.CharField(source='school.name', read_only=True)
    subjects = SubjectSerializer(many=True, read_only=True)
    role_display = serializers.CharField(source='get_role_display', read_only=True)

    class Meta:
        model = TeacherProfile
        fields = [
            'id', 'user', 'user_email', 'user_name', 'school', 'school_name',
            'employee_id', 'department', 'role', 'role_display', 'subjects',
            'can_create_assignments', 'can_view_school_analytics',
            'can_manage_teachers', 'can_manage_students', 'is_active',
            'joined_school_at'
        ]
        read_only_fields = ['user', 'school']


class StudentSerializer(serializers.ModelSerializer):
    """Serializer for Student (User with role=student)."""

    display_name = serializers.CharField(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'email', 'username', 'first_name', 'last_name',
            'display_name', 'current_form', 'total_questions_attempted',
            'total_marks_earned', 'total_marks_possible', 'current_streak_days',
            'last_activity_at'
        ]


class ClassListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Class list."""

    subject_name = serializers.CharField(source='subject.name', read_only=True)
    teacher_name = serializers.CharField(source='teacher.user.display_name', read_only=True)
    student_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Class
        fields = [
            'id', 'name', 'subject', 'subject_name', 'form_level',
            'academic_year', 'term', 'teacher_name', 'student_count',
            'join_code', 'allow_join', 'is_active'
        ]


class ClassDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Class."""

    subject = SubjectSerializer(read_only=True)
    teacher = TeacherProfileSerializer(read_only=True)
    students = StudentSerializer(many=True, read_only=True)
    student_count = serializers.IntegerField(read_only=True)

    class Meta:
        model = Class
        fields = [
            'id', 'name', 'subject', 'form_level', 'academic_year', 'term',
            'teacher', 'students', 'student_count', 'max_students',
            'join_code', 'allow_join', 'is_active', 'created_at'
        ]


class ClassCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a Class."""

    class Meta:
        model = Class
        fields = ['name', 'subject', 'form_level', 'academic_year', 'term', 'max_students']


class AssignmentListSerializer(serializers.ModelSerializer):
    """Lightweight serializer for Assignment list."""

    teacher_name = serializers.CharField(source='teacher.user.display_name', read_only=True)
    class_count = serializers.SerializerMethodField()
    submission_count = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_assignment_type_display', read_only=True)

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'assignment_type', 'type_display',
            'teacher_name', 'total_marks', 'time_limit_minutes',
            'available_from', 'due_date', 'is_published', 'is_mandatory',
            'class_count', 'submission_count', 'created_at'
        ]

    def get_class_count(self, obj):
        return obj.classes.count()

    def get_submission_count(self, obj):
        return obj.submissions.count()


class AssignmentDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for Assignment."""

    teacher = TeacherProfileSerializer(read_only=True)
    classes = ClassListSerializer(many=True, read_only=True)
    papers = PaperListSerializer(many=True, read_only=True)
    topics = TopicListSerializer(many=True, read_only=True)
    type_display = serializers.CharField(source='get_assignment_type_display', read_only=True)

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'assignment_type', 'type_display',
            'teacher', 'classes', 'papers', 'topics', 'total_marks',
            'time_limit_minutes', 'attempts_allowed', 'show_answers_after',
            'available_from', 'due_date', 'late_submission_allowed',
            'late_penalty_percent', 'is_published', 'is_mandatory',
            'notify_on_publish', 'remind_before_due', 'notify_parents',
            'created_at', 'updated_at'
        ]


class AssignmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating an Assignment."""

    class_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True
    )
    paper_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    topic_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )
    question_ids = serializers.ListField(
        child=serializers.IntegerField(),
        write_only=True,
        required=False
    )

    class Meta:
        model = Assignment
        fields = [
            'title', 'description', 'assignment_type', 'class_ids',
            'paper_ids', 'topic_ids', 'question_ids', 'total_marks',
            'time_limit_minutes', 'attempts_allowed', 'show_answers_after',
            'available_from', 'due_date', 'late_submission_allowed',
            'late_penalty_percent', 'is_mandatory', 'notify_on_publish',
            'remind_before_due', 'notify_parents'
        ]

    def create(self, validated_data):
        class_ids = validated_data.pop('class_ids', [])
        paper_ids = validated_data.pop('paper_ids', [])
        topic_ids = validated_data.pop('topic_ids', [])
        question_ids = validated_data.pop('question_ids', [])

        assignment = Assignment.objects.create(**validated_data)

        if class_ids:
            assignment.classes.set(class_ids)
        if paper_ids:
            assignment.papers.set(paper_ids)
        if topic_ids:
            assignment.topics.set(topic_ids)
        if question_ids:
            assignment.questions.set(question_ids)

        return assignment


class AssignmentSubmissionSerializer(serializers.ModelSerializer):
    """Serializer for AssignmentSubmission."""

    student = StudentSerializer(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = AssignmentSubmission
        fields = [
            'id', 'assignment', 'student', 'attempt', 'status', 'status_display',
            'attempt_number', 'started_at', 'submitted_at', 'marks_earned',
            'marks_possible', 'percentage_score', 'final_score',
            'teacher_feedback', 'graded_by', 'graded_at', 'created_at'
        ]
        read_only_fields = [
            'assignment', 'student', 'attempt', 'marks_earned', 'marks_possible',
            'percentage_score', 'final_score', 'graded_at'
        ]


class ParentAssignmentSerializer(serializers.ModelSerializer):
    """Serializer for parent-created assignments."""

    paper_titles = serializers.SerializerMethodField()
    resource_titles = serializers.SerializerMethodField()
    child_names = serializers.SerializerMethodField()
    submission_status = serializers.SerializerMethodField()
    type_display = serializers.CharField(source='get_assignment_type_display', read_only=True)

    class Meta:
        model = Assignment
        fields = [
            'id', 'title', 'description', 'assignment_type', 'type_display',
            'total_marks', 'available_from', 'due_date',
            'is_published', 'is_mandatory',
            'paper_titles', 'resource_titles', 'child_names', 'submission_status',
            'created_at',
        ]

    def get_paper_titles(self, obj):
        return list(obj.papers.values_list('title', flat=True))

    def get_resource_titles(self, obj):
        return list(obj.resources.values_list('title', flat=True))

    def get_child_names(self, obj):
        return [
            {'id': s.id, 'name': s.display_name}
            for s in obj.assigned_students.all()
        ]

    def get_submission_status(self, obj):
        return [
            {
                'student_id': sub.student_id,
                'student_name': sub.student.display_name,
                'status': sub.status,
                'submitted_at': sub.submitted_at,
                'percentage': sub.percentage_score,
            }
            for sub in obj.submissions.select_related('student').all()
        ]


class ParentAssignmentCreateSerializer(serializers.Serializer):
    """Serializer for creating a parent assignment."""

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, default='')
    assignment_type = serializers.ChoiceField(
        choices=[('paper', 'Full Paper'), ('topics', 'Topic Practice'), ('custom', 'Custom Questions'), ('quiz', 'Quick Quiz')],
        default='paper'
    )
    child_ids = serializers.ListField(
        child=serializers.IntegerField(),
    )
    paper_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )
    resource_ids = serializers.ListField(
        child=serializers.IntegerField(),
        required=False,
        default=list,
    )
    total_marks = serializers.IntegerField(default=0)
    available_from = serializers.DateTimeField()
    due_date = serializers.DateTimeField()
    is_mandatory = serializers.BooleanField(default=True)


class ClassJoinSerializer(serializers.Serializer):
    """Serializer for joining a class."""

    join_code = serializers.CharField(max_length=8)
