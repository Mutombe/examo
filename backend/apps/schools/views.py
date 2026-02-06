"""
Views for the schools app - Teacher and School Admin APIs.
"""

from django.contrib.auth import get_user_model
from django.db import models
from django.db.models import Count, Avg, Sum, Q
from django.utils import timezone
from rest_framework import generics, status, filters
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsTeacher, IsSchoolAdmin
from .models import School, TeacherProfile, Class, Assignment, AssignmentSubmission, TeacherInvitation
from .serializers import (
    SchoolSerializer,
    TeacherProfileSerializer,
    TeacherInvitationSerializer,
    ClassListSerializer,
    ClassDetailSerializer,
    ClassCreateSerializer,
    AssignmentListSerializer,
    AssignmentDetailSerializer,
    AssignmentCreateSerializer,
    AssignmentSubmissionSerializer,
    StudentSerializer,
    ClassJoinSerializer,
)

User = get_user_model()


# ============ Teacher Profile ============

class TeacherProfileView(generics.RetrieveUpdateAPIView):
    """Get or update the current teacher's profile."""

    serializer_class = TeacherProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return TeacherProfile.objects.select_related('school', 'user').prefetch_related('subjects').get(
            user=self.request.user
        )


# ============ Classes ============

class ClassListCreateView(generics.ListCreateAPIView):
    """List teacher's classes or create a new class."""

    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'subject__name']
    ordering_fields = ['academic_year', 'form_level', 'created_at']
    ordering = ['-academic_year', 'form_level']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ClassCreateSerializer
        return ClassListSerializer

    def get_queryset(self):
        try:
            teacher_profile = self.request.user.teacher_profile
            return Class.objects.filter(
                teacher=teacher_profile,
                is_active=True
            ).select_related('subject', 'teacher__user').annotate(
                student_count=Count('students')
            )
        except TeacherProfile.DoesNotExist:
            return Class.objects.none()

    def perform_create(self, serializer):
        teacher_profile = self.request.user.teacher_profile
        serializer.save(teacher=teacher_profile, school=teacher_profile.school)


class ClassDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or archive a class."""

    serializer_class = ClassDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        try:
            teacher_profile = self.request.user.teacher_profile
            return Class.objects.filter(
                teacher=teacher_profile
            ).select_related('subject', 'teacher__user', 'teacher__school').prefetch_related('students')
        except TeacherProfile.DoesNotExist:
            return Class.objects.none()

    def perform_destroy(self, instance):
        # Soft delete by archiving
        instance.is_active = False
        instance.archived_at = timezone.now()
        instance.save()


class ClassStudentsView(generics.ListAPIView):
    """List students in a class."""

    serializer_class = StudentSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        class_id = self.kwargs['class_id']
        try:
            teacher_profile = self.request.user.teacher_profile
            class_obj = Class.objects.get(id=class_id, teacher=teacher_profile)
            return class_obj.students.all().order_by('last_name', 'first_name')
        except (TeacherProfile.DoesNotExist, Class.DoesNotExist):
            return []


class ClassAddStudentView(APIView):
    """Add a student to a class."""

    permission_classes = [IsAuthenticated]

    def post(self, request, class_id):
        try:
            teacher_profile = request.user.teacher_profile
            class_obj = Class.objects.get(id=class_id, teacher=teacher_profile)
        except (TeacherProfile.DoesNotExist, Class.DoesNotExist):
            return Response(
                {'error': 'Class not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        student_id = request.data.get('student_id')
        if not student_id:
            return Response(
                {'error': 'student_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        from django.contrib.auth import get_user_model
        User = get_user_model()

        try:
            student = User.objects.get(id=student_id, role='student')
        except User.DoesNotExist:
            return Response(
                {'error': 'Student not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        class_obj.students.add(student)
        return Response({'message': 'Student added successfully'})


class ClassRemoveStudentView(APIView):
    """Remove a student from a class."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, class_id, student_id):
        try:
            teacher_profile = request.user.teacher_profile
            class_obj = Class.objects.get(id=class_id, teacher=teacher_profile)
        except (TeacherProfile.DoesNotExist, Class.DoesNotExist):
            return Response(
                {'error': 'Class not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        class_obj.students.remove(student_id)
        return Response({'message': 'Student removed successfully'})


class ClassRegenerateCodeView(APIView):
    """Regenerate join code for a class."""

    permission_classes = [IsAuthenticated]

    def post(self, request, class_id):
        try:
            teacher_profile = request.user.teacher_profile
            class_obj = Class.objects.get(id=class_id, teacher=teacher_profile)
        except (TeacherProfile.DoesNotExist, Class.DoesNotExist):
            return Response(
                {'error': 'Class not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        class_obj.join_code = class_obj._generate_join_code()
        class_obj.save()

        return Response({'join_code': class_obj.join_code})


class JoinClassView(APIView):
    """Join a class using a join code (for students)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ClassJoinSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        join_code = serializer.validated_data['join_code']

        try:
            class_obj = Class.objects.get(
                join_code=join_code,
                is_active=True,
                allow_join=True
            )
        except Class.DoesNotExist:
            return Response(
                {'error': 'Invalid or expired join code'},
                status=status.HTTP_404_NOT_FOUND
            )

        if class_obj.students.count() >= class_obj.max_students:
            return Response(
                {'error': 'Class is full'},
                status=status.HTTP_400_BAD_REQUEST
            )

        class_obj.students.add(request.user)
        return Response({
            'message': 'Successfully joined class',
            'class': ClassListSerializer(class_obj).data
        })


# ============ Assignments ============

class AssignmentListCreateView(generics.ListCreateAPIView):
    """List teacher's assignments or create a new assignment."""

    permission_classes = [IsAuthenticated]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['due_date', 'created_at', 'title']
    ordering = ['-due_date']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return AssignmentCreateSerializer
        return AssignmentListSerializer

    def get_queryset(self):
        try:
            teacher_profile = self.request.user.teacher_profile
            return Assignment.objects.filter(
                teacher=teacher_profile
            ).prefetch_related('classes', 'submissions')
        except TeacherProfile.DoesNotExist:
            return Assignment.objects.none()

    def perform_create(self, serializer):
        teacher_profile = self.request.user.teacher_profile
        serializer.save(teacher=teacher_profile)


class AssignmentDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete an assignment."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return AssignmentCreateSerializer
        return AssignmentDetailSerializer

    def get_queryset(self):
        try:
            teacher_profile = self.request.user.teacher_profile
            return Assignment.objects.filter(
                teacher=teacher_profile
            ).prefetch_related('classes', 'papers', 'topics', 'questions')
        except TeacherProfile.DoesNotExist:
            return Assignment.objects.none()


class AssignmentPublishView(APIView):
    """Publish an assignment."""

    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        try:
            teacher_profile = request.user.teacher_profile
            assignment = Assignment.objects.get(id=pk, teacher=teacher_profile)
        except (TeacherProfile.DoesNotExist, Assignment.DoesNotExist):
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        assignment.is_published = True
        assignment.save()

        # Create submission records for all students in assigned classes
        students = set()
        for class_obj in assignment.classes.all():
            students.update(class_obj.students.all())

        for student in students:
            AssignmentSubmission.objects.get_or_create(
                assignment=assignment,
                student=student,
                defaults={'status': 'not_started'}
            )

        return Response({'message': 'Assignment published successfully'})


class AssignmentSubmissionsView(generics.ListAPIView):
    """List submissions for an assignment."""

    serializer_class = AssignmentSubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        assignment_id = self.kwargs['assignment_id']
        try:
            teacher_profile = self.request.user.teacher_profile
            assignment = Assignment.objects.get(id=assignment_id, teacher=teacher_profile)
            return assignment.submissions.all().select_related('student')
        except (TeacherProfile.DoesNotExist, Assignment.DoesNotExist):
            return AssignmentSubmission.objects.none()


class SubmissionFeedbackView(APIView):
    """Add teacher feedback to a submission."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, submission_id):
        try:
            teacher_profile = request.user.teacher_profile
            submission = AssignmentSubmission.objects.get(
                id=submission_id,
                assignment__teacher=teacher_profile
            )
        except (TeacherProfile.DoesNotExist, AssignmentSubmission.DoesNotExist):
            return Response(
                {'error': 'Submission not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        feedback = request.data.get('teacher_feedback', '')
        submission.teacher_feedback = feedback
        submission.graded_by = request.user
        submission.graded_at = timezone.now()
        submission.save()

        return Response(AssignmentSubmissionSerializer(submission).data)


# ============ Student Assignments (Student View) ============

class StudentAssignmentsView(generics.ListAPIView):
    """List assignments for the current student (teacher + parent assignments)."""

    serializer_class = AssignmentListSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        # Get all classes the student is enrolled in
        class_ids = user.enrolled_classes.filter(is_active=True).values_list('id', flat=True)

        return Assignment.objects.filter(
            Q(classes__id__in=class_ids) | Q(assigned_students=user),
            is_published=True
        ).distinct().order_by('-due_date')


class StudentAssignmentDetailView(generics.RetrieveAPIView):
    """Get assignment details and submission status for a student."""

    serializer_class = AssignmentDetailSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        class_ids = user.enrolled_classes.filter(is_active=True).values_list('id', flat=True)

        return Assignment.objects.filter(
            classes__id__in=class_ids,
            is_published=True
        ).distinct()

    def retrieve(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        data = serializer.data

        # Add submission info
        try:
            submission = AssignmentSubmission.objects.get(
                assignment=instance,
                student=request.user
            )
            data['submission'] = AssignmentSubmissionSerializer(submission).data
        except AssignmentSubmission.DoesNotExist:
            data['submission'] = None

        return Response(data)


# ============ Class Analytics ============

class ClassAnalyticsView(APIView):
    """Get analytics for a class."""

    permission_classes = [IsAuthenticated]

    def get(self, request, class_id):
        try:
            teacher_profile = request.user.teacher_profile
            class_obj = Class.objects.get(id=class_id, teacher=teacher_profile)
        except (TeacherProfile.DoesNotExist, Class.DoesNotExist):
            return Response(
                {'error': 'Class not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        students = class_obj.students.all()

        # Calculate basic stats
        total_students = students.count()
        active_students = students.filter(last_activity_at__isnull=False).count()

        # Calculate average performance
        avg_stats = students.aggregate(
            avg_attempted=Avg('total_questions_attempted'),
            avg_marks_earned=Avg('total_marks_earned'),
            avg_marks_possible=Avg('total_marks_possible'),
            avg_streak=Avg('current_streak_days')
        )

        avg_score = 0
        if avg_stats['avg_marks_possible'] and avg_stats['avg_marks_possible'] > 0:
            avg_score = (avg_stats['avg_marks_earned'] or 0) / avg_stats['avg_marks_possible'] * 100

        # Get assignment stats
        assignments = Assignment.objects.filter(
            classes=class_obj,
            is_published=True
        )
        total_assignments = assignments.count()
        completed_submissions = AssignmentSubmission.objects.filter(
            assignment__classes=class_obj,
            status__in=['submitted', 'graded']
        ).count()

        return Response({
            'class': ClassListSerializer(class_obj).data,
            'stats': {
                'total_students': total_students,
                'active_students': active_students,
                'avg_questions_attempted': avg_stats['avg_attempted'] or 0,
                'avg_score_percentage': round(avg_score, 1),
                'avg_streak_days': avg_stats['avg_streak'] or 0,
                'total_assignments': total_assignments,
                'completed_submissions': completed_submissions,
            }
        })


# ============ School Admin Views ============

class SchoolStatsView(APIView):
    """
    GET /school/stats/ - Return school statistics.
    Only accessible by school_admin or admin users.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get(self, request):
        # Get the school for this admin
        try:
            teacher_profile = request.user.teacher_profile
            school = teacher_profile.school
        except TeacherProfile.DoesNotExist:
            # For admin users without a teacher profile, return mock data
            return Response({
                'school': None,
                'stats': {
                    'total_students': 0,
                    'total_teachers': 0,
                    'total_classes': 0,
                    'active_classes': 0,
                    'total_assignments': 0,
                    'completed_assignments': 0,
                    'avg_school_performance': 0,
                    'active_students_this_week': 0,
                    'assignments_due_this_week': 0,
                },
                'message': 'No school associated with this admin'
            })

        # Calculate school statistics
        total_teachers = school.teachers.filter(is_active=True).count()
        total_classes = school.classes.count()
        active_classes = school.classes.filter(is_active=True).count()

        # Get all students enrolled in school's classes
        student_ids = Class.objects.filter(
            school=school, is_active=True
        ).values_list('students', flat=True).distinct()
        total_students = User.objects.filter(id__in=student_ids).count()

        # Get assignment stats
        total_assignments = Assignment.objects.filter(
            teacher__school=school
        ).count()
        completed_submissions = AssignmentSubmission.objects.filter(
            assignment__teacher__school=school,
            status__in=['submitted', 'graded']
        ).count()

        # Calculate average performance across school
        students = User.objects.filter(id__in=student_ids)
        avg_stats = students.aggregate(
            total_earned=Sum('total_marks_earned'),
            total_possible=Sum('total_marks_possible')
        )
        avg_performance = 0
        if avg_stats['total_possible'] and avg_stats['total_possible'] > 0:
            avg_performance = (avg_stats['total_earned'] or 0) / avg_stats['total_possible'] * 100

        # Active students this week
        week_ago = timezone.now() - timezone.timedelta(days=7)
        active_students_this_week = students.filter(
            last_activity_at__gte=week_ago
        ).count()

        # Assignments due this week
        week_from_now = timezone.now() + timezone.timedelta(days=7)
        assignments_due_this_week = Assignment.objects.filter(
            teacher__school=school,
            due_date__gte=timezone.now(),
            due_date__lte=week_from_now,
            is_published=True
        ).count()

        return Response({
            'school': SchoolSerializer(school).data,
            'stats': {
                'total_students': total_students,
                'total_teachers': total_teachers,
                'total_classes': total_classes,
                'active_classes': active_classes,
                'total_assignments': total_assignments,
                'completed_submissions': completed_submissions,
                'avg_school_performance': round(avg_performance, 1),
                'active_students_this_week': active_students_this_week,
                'assignments_due_this_week': assignments_due_this_week,
            }
        })


class SchoolTeachersView(APIView):
    """
    GET /school/teachers/ - List all teachers in the school.
    POST /school/teachers/ - Add a new teacher to the school.
    Only accessible by school_admin or admin users.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get(self, request):
        try:
            teacher_profile = request.user.teacher_profile
            school = teacher_profile.school
        except TeacherProfile.DoesNotExist:
            return Response({
                'teachers': [],
                'message': 'No school associated with this admin'
            })

        teachers = school.teachers.filter(is_active=True).select_related('user')
        return Response({
            'teachers': TeacherProfileSerializer(teachers, many=True).data
        })

    def post(self, request):
        try:
            admin_profile = request.user.teacher_profile
            school = admin_profile.school
        except TeacherProfile.DoesNotExist:
            return Response(
                {'error': 'No school associated with this admin'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Required fields
        email = request.data.get('email')
        if not email:
            return Response(
                {'error': 'Email is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check if user exists
        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'User with this email does not exist'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if already a teacher at this school
        if TeacherProfile.objects.filter(user=user, school=school).exists():
            return Response(
                {'error': 'User is already a teacher at this school'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create teacher profile
        teacher_profile = TeacherProfile.objects.create(
            user=user,
            school=school,
            employee_id=request.data.get('employee_id', ''),
            department=request.data.get('department', ''),
            role=request.data.get('role', 'teacher'),
            can_create_assignments=request.data.get('can_create_assignments', True),
            can_view_school_analytics=request.data.get('can_view_school_analytics', False),
            can_manage_teachers=request.data.get('can_manage_teachers', False),
            can_manage_students=request.data.get('can_manage_students', False),
        )

        # Update user role if not already teacher or higher
        if user.role not in ['teacher', 'school_admin', 'admin']:
            user.role = 'teacher'
            user.save()

        # Update school teacher count
        school.total_teachers = school.teachers.filter(is_active=True).count()
        school.save()

        return Response(
            TeacherProfileSerializer(teacher_profile).data,
            status=status.HTTP_201_CREATED
        )


class SchoolTeacherDeleteView(APIView):
    """
    DELETE /school/teachers/{id}/ - Remove a teacher from the school.
    Only accessible by school_admin or admin users.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def delete(self, request, pk):
        try:
            admin_profile = request.user.teacher_profile
            school = admin_profile.school
        except TeacherProfile.DoesNotExist:
            return Response(
                {'error': 'No school associated with this admin'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            teacher_profile = TeacherProfile.objects.get(id=pk, school=school)
        except TeacherProfile.DoesNotExist:
            return Response(
                {'error': 'Teacher not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Soft delete by deactivating
        teacher_profile.is_active = False
        teacher_profile.save()

        # Update school teacher count
        school.total_teachers = school.teachers.filter(is_active=True).count()
        school.save()

        return Response({'message': 'Teacher removed successfully'})


class SchoolClassesView(generics.ListAPIView):
    """
    GET /school/classes/ - List all classes in the school.
    Only accessible by school_admin or admin users.
    """

    serializer_class = ClassListSerializer
    permission_classes = [IsAuthenticated, IsSchoolAdmin]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['name', 'subject__name', 'teacher__user__first_name', 'teacher__user__last_name']
    ordering_fields = ['academic_year', 'form_level', 'created_at', 'name']
    ordering = ['-academic_year', 'form_level']

    def get_queryset(self):
        try:
            teacher_profile = self.request.user.teacher_profile
            school = teacher_profile.school
            return Class.objects.filter(
                school=school
            ).select_related('subject', 'teacher__user').annotate(
                student_count=Count('students')
            )
        except TeacherProfile.DoesNotExist:
            return Class.objects.none()


class SchoolPerformanceView(APIView):
    """
    GET /school/performance/ - School performance metrics.
    Only accessible by school_admin or admin users.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get(self, request):
        try:
            teacher_profile = request.user.teacher_profile
            school = teacher_profile.school
        except TeacherProfile.DoesNotExist:
            return Response({
                'performance': None,
                'message': 'No school associated with this admin'
            })

        # Get all students in school's classes
        student_ids = Class.objects.filter(
            school=school, is_active=True
        ).values_list('students', flat=True).distinct()
        students = User.objects.filter(id__in=student_ids)

        # Overall performance stats
        overall_stats = students.aggregate(
            total_questions=Sum('total_questions_attempted'),
            total_earned=Sum('total_marks_earned'),
            total_possible=Sum('total_marks_possible'),
            avg_streak=Avg('current_streak_days')
        )

        overall_avg = 0
        if overall_stats['total_possible'] and overall_stats['total_possible'] > 0:
            overall_avg = (overall_stats['total_earned'] or 0) / overall_stats['total_possible'] * 100

        # Performance by form level
        form_performance = []
        for form_level in range(1, 7):
            form_student_ids = Class.objects.filter(
                school=school, is_active=True, form_level=form_level
            ).values_list('students', flat=True).distinct()
            form_students = User.objects.filter(id__in=form_student_ids)

            form_stats = form_students.aggregate(
                total_earned=Sum('total_marks_earned'),
                total_possible=Sum('total_marks_possible'),
                count=Count('id')
            )

            form_avg = 0
            if form_stats['total_possible'] and form_stats['total_possible'] > 0:
                form_avg = (form_stats['total_earned'] or 0) / form_stats['total_possible'] * 100

            form_performance.append({
                'form_level': form_level,
                'student_count': form_stats['count'] or 0,
                'avg_performance': round(form_avg, 1)
            })

        # Top performing students (by percentage)
        top_students = students.exclude(
            total_marks_possible=0
        ).annotate(
            performance_pct=100.0 * models.F('total_marks_earned') / models.F('total_marks_possible')
        ).order_by('-performance_pct')[:10]

        top_students_data = [
            {
                'id': s.id,
                'name': s.display_name,
                'email': s.email,
                'performance': round(s.performance_pct, 1) if hasattr(s, 'performance_pct') else 0,
                'questions_attempted': s.total_questions_attempted
            }
            for s in top_students
        ]

        # Recent activity (last 30 days)
        thirty_days_ago = timezone.now() - timezone.timedelta(days=30)
        recent_submissions = AssignmentSubmission.objects.filter(
            assignment__teacher__school=school,
            submitted_at__gte=thirty_days_ago
        ).count()

        return Response({
            'school': SchoolSerializer(school).data,
            'performance': {
                'overall_avg_performance': round(overall_avg, 1),
                'total_questions_attempted': overall_stats['total_questions'] or 0,
                'avg_streak_days': round(overall_stats['avg_streak'] or 0, 1),
                'form_performance': form_performance,
                'top_students': top_students_data,
                'recent_submissions_30_days': recent_submissions,
            }
        })


# ============ Teacher Invitations ============

class SchoolInvitationsView(APIView):
    """
    GET /school/invitations/ - List pending invitations.
    POST /school/invitations/ - Invite a teacher by email.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def _get_school(self, request):
        try:
            return request.user.teacher_profile.school
        except TeacherProfile.DoesNotExist:
            return None

    def get(self, request):
        school = self._get_school(request)
        if not school:
            return Response({'invitations': []})

        invitations = TeacherInvitation.objects.filter(
            school=school
        ).select_related('invited_by').order_by('-created_at')[:50]

        return Response({
            'invitations': TeacherInvitationSerializer(invitations, many=True).data
        })

    def post(self, request):
        school = self._get_school(request)
        if not school:
            return Response(
                {'error': 'No school associated with this admin'},
                status=status.HTTP_400_BAD_REQUEST
            )

        email = request.data.get('email')
        if not email:
            return Response({'error': 'Email is required'}, status=status.HTTP_400_BAD_REQUEST)

        role = request.data.get('role', 'teacher')
        department = request.data.get('department', '')

        # Check if already a teacher at this school
        if TeacherProfile.objects.filter(
            user__email=email, school=school, is_active=True
        ).exists():
            return Response(
                {'error': 'This person is already a teacher at your school'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Check for existing pending invitation
        existing = TeacherInvitation.objects.filter(
            school=school, email=email, status='pending'
        ).first()
        if existing:
            if not existing.is_expired:
                return Response(
                    {'error': 'A pending invitation already exists for this email'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            existing.status = 'expired'
            existing.save()

        # Create invitation (expires in 7 days)
        invitation = TeacherInvitation.objects.create(
            school=school,
            invited_by=request.user,
            email=email,
            role=role,
            department=department,
            token=TeacherInvitation.generate_token(),
            expires_at=timezone.now() + timezone.timedelta(days=7),
        )

        # Build the invitation link
        from django.conf import settings as django_settings
        frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173')
        invite_link = f"{frontend_url}/accept-invite/{invitation.token}"

        return Response({
            'invitation': TeacherInvitationSerializer(invitation).data,
            'invite_link': invite_link,
            'message': f'Invitation created. Share this link with {email}: {invite_link}',
        }, status=status.HTTP_201_CREATED)


class SchoolInvitationCancelView(APIView):
    """DELETE /school/invitations/{id}/ - Cancel a pending invitation."""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def delete(self, request, pk):
        try:
            school = request.user.teacher_profile.school
        except TeacherProfile.DoesNotExist:
            return Response({'error': 'No school'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            invitation = TeacherInvitation.objects.get(id=pk, school=school, status='pending')
        except TeacherInvitation.DoesNotExist:
            return Response({'error': 'Invitation not found'}, status=status.HTTP_404_NOT_FOUND)

        invitation.status = 'cancelled'
        invitation.save()
        return Response({'message': 'Invitation cancelled'})


# ============ School Settings ============

class SchoolSettingsView(APIView):
    """
    GET /school/settings/ - Get school profile.
    PATCH /school/settings/ - Update school profile.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def _get_school(self, request):
        try:
            return request.user.teacher_profile.school
        except TeacherProfile.DoesNotExist:
            return None

    def get(self, request):
        school = self._get_school(request)
        if not school:
            return Response({'error': 'No school associated'}, status=status.HTTP_404_NOT_FOUND)
        return Response(SchoolSerializer(school).data)

    def patch(self, request):
        school = self._get_school(request)
        if not school:
            return Response({'error': 'No school associated'}, status=status.HTTP_404_NOT_FOUND)

        serializer = SchoolSerializer(school, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
