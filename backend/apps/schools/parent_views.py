"""
Views for parent-related features.
Parents can view their children's progress and activity,
and create assignments for their children.
"""

from django.contrib.auth import get_user_model
from django.db.models import Sum, Avg, Count, Q
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsParent
from .models import ParentChild, Assignment, AssignmentSubmission
from .serializers import (
    StudentSerializer,
    AssignmentListSerializer,
    ParentAssignmentSerializer,
    ParentAssignmentCreateSerializer,
)

User = get_user_model()


class ParentChildrenView(APIView):
    """
    GET /parent/children/ - List all children linked to this parent.
    POST /parent/children/ - Link a new child to this parent.
    Only accessible by users with 'parent' role.
    """

    permission_classes = [IsAuthenticated, IsParent]

    def get(self, request):
        links = ParentChild.objects.filter(
            parent=request.user, status='active'
        ).select_related('child')

        children = [link.child for link in links]
        children_data = []
        for link in links:
            child = link.child
            children_data.append({
                **StudentSerializer(child).data,
                'linked_at': link.linked_at.isoformat(),
            })

        return Response({
            'children': children_data
        })

    def post(self, request):
        """Link a child to this parent using email."""
        child_email = request.data.get('email')
        linking_code = request.data.get('linking_code')

        if not child_email and not linking_code:
            return Response(
                {'error': 'Either email or linking_code is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if child_email:
            try:
                child = User.objects.get(email=child_email, role='student')
            except User.DoesNotExist:
                return Response(
                    {'error': 'Student with this email not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
        else:
            return Response(
                {'error': 'Linking code feature not yet implemented'},
                status=status.HTTP_501_NOT_IMPLEMENTED
            )

        # Check if already linked
        existing = ParentChild.objects.filter(
            parent=request.user, child=child
        ).first()
        if existing:
            if existing.status == 'active':
                return Response(
                    {'error': 'Child is already linked to your account'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Reactivate revoked link
            existing.status = 'active'
            existing.save()
            return Response({
                'message': 'Child linked successfully',
                'child': StudentSerializer(child).data,
            }, status=status.HTTP_200_OK)

        # Prevent linking yourself
        if child == request.user:
            return Response(
                {'error': 'Cannot link yourself as a child'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ParentChild.objects.create(
            parent=request.user,
            child=child,
            status='active',
        )

        return Response({
            'message': 'Child linked successfully',
            'child': StudentSerializer(child).data,
        }, status=status.HTTP_201_CREATED)


class ParentChildDeleteView(APIView):
    """
    DELETE /parent/children/{id}/ - Unlink a child from this parent.
    Only accessible by users with 'parent' role.
    """

    permission_classes = [IsAuthenticated, IsParent]

    def delete(self, request, pk):
        try:
            link = ParentChild.objects.get(
                parent=request.user, child_id=pk, status='active'
            )
        except ParentChild.DoesNotExist:
            return Response(
                {'error': 'Child link not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        link.status = 'revoked'
        link.save()

        return Response({'message': 'Child unlinked successfully'})


def _verify_parent_child(parent, child_id):
    """Verify that a parent-child link exists and is active."""
    return ParentChild.objects.filter(
        parent=parent, child_id=child_id, status='active'
    ).exists()


class ParentChildProgressView(APIView):
    """
    GET /parent/children/{id}/progress/ - Get a child's academic progress.
    Only accessible by users with 'parent' role.
    """

    permission_classes = [IsAuthenticated, IsParent]

    def get(self, request, pk):
        if not _verify_parent_child(request.user, pk):
            return Response(
                {'error': 'Child not linked to your account'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            child = User.objects.get(id=pk, role='student')
        except User.DoesNotExist:
            return Response(
                {'error': 'Child not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Get child's classes
        enrolled_classes = child.enrolled_classes.filter(is_active=True)
        class_count = enrolled_classes.count()
        subjects = enrolled_classes.values_list('subject__name', flat=True).distinct()

        # Calculate performance
        performance_pct = 0
        if child.total_marks_possible > 0:
            performance_pct = (child.total_marks_earned / child.total_marks_possible) * 100

        # Get assignment statistics (teacher + parent assignments)
        assignments = AssignmentSubmission.objects.filter(student=child)
        total_assignments = assignments.count()
        completed_assignments = assignments.filter(
            status__in=['submitted', 'graded']
        ).count()
        pending_assignments = assignments.filter(
            status__in=['not_started', 'in_progress']
        ).count()

        recent_submissions = assignments.filter(
            submitted_at__isnull=False
        ).order_by('-submitted_at')[:5]

        recent_scores = [
            {
                'assignment_title': sub.assignment.title,
                'marks_earned': sub.marks_earned,
                'marks_possible': sub.marks_possible,
                'percentage': round(sub.percentage_score or 0, 1),
                'submitted_at': sub.submitted_at,
                'status': sub.status
            }
            for sub in recent_submissions
        ]

        return Response({
            'child': {
                'id': child.id,
                'name': child.display_name,
                'email': child.email,
                'current_form': child.current_form,
                'school_name': child.school_name,
            },
            'progress': {
                'overall_performance': round(performance_pct, 1),
                'total_questions_attempted': child.total_questions_attempted,
                'total_marks_earned': child.total_marks_earned,
                'total_marks_possible': child.total_marks_possible,
                'current_streak_days': child.current_streak_days,
                'longest_streak_days': child.longest_streak_days,
                'last_activity': child.last_activity_at,
            },
            'classes': {
                'enrolled_count': class_count,
                'subjects': list(subjects),
            },
            'assignments': {
                'total': total_assignments,
                'completed': completed_assignments,
                'pending': pending_assignments,
                'recent_scores': recent_scores,
            },
        })


class ParentChildActivityView(APIView):
    """
    GET /parent/children/{id}/activity/ - Get a child's recent activity.
    Only accessible by users with 'parent' role.
    """

    permission_classes = [IsAuthenticated, IsParent]

    def get(self, request, pk):
        if not _verify_parent_child(request.user, pk):
            return Response(
                {'error': 'Child not linked to your account'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            child = User.objects.get(id=pk, role='student')
        except User.DoesNotExist:
            return Response(
                {'error': 'Child not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        days = int(request.query_params.get('days', 30))
        limit = int(request.query_params.get('limit', 50))
        cutoff_date = timezone.now() - timezone.timedelta(days=days)

        # Get recent assignment submissions
        recent_submissions = AssignmentSubmission.objects.filter(
            student=child,
            updated_at__gte=cutoff_date
        ).select_related('assignment').order_by('-updated_at')[:limit]

        submissions_activity = [
            {
                'type': 'assignment_submission',
                'assignment_id': sub.assignment.id,
                'assignment_title': sub.assignment.title,
                'status': sub.status,
                'marks_earned': sub.marks_earned if sub.status in ['submitted', 'graded'] else None,
                'marks_possible': sub.marks_possible if sub.status in ['submitted', 'graded'] else None,
                'percentage': round(sub.percentage_score or 0, 1) if sub.percentage_score else None,
                'timestamp': sub.updated_at,
                'details': f"{'Submitted' if sub.status == 'submitted' else 'Started'} assignment: {sub.assignment.title}"
            }
            for sub in recent_submissions
        ]

        # Get class join activity
        recent_classes = child.enrolled_classes.filter(
            is_active=True
        ).order_by('-created_at')[:10]

        class_activity = [
            {
                'type': 'class_joined',
                'class_id': cls.id,
                'class_name': cls.name,
                'subject': cls.subject.name if cls.subject else 'Unknown',
                'teacher': cls.teacher.user.display_name if cls.teacher else 'Unknown',
                'timestamp': cls.created_at,
                'details': f"Joined class: {cls.name}"
            }
            for cls in recent_classes
        ]

        all_activity = submissions_activity + class_activity
        all_activity.sort(key=lambda x: x['timestamp'], reverse=True)

        seven_days_ago = timezone.now() - timezone.timedelta(days=7)
        activity_this_week = AssignmentSubmission.objects.filter(
            student=child,
            updated_at__gte=seven_days_ago
        ).count()

        return Response({
            'child': {
                'id': child.id,
                'name': child.display_name,
                'last_activity': child.last_activity_at,
            },
            'summary': {
                'activity_count_this_week': activity_this_week,
                'current_streak': child.current_streak_days,
                'days_since_last_activity': (
                    (timezone.now() - child.last_activity_at).days
                    if child.last_activity_at else None
                ),
            },
            'activity': all_activity[:limit],
            'period_days': days,
        })


class ParentAssignmentListCreateView(APIView):
    """
    GET /parent/assignments/ - List assignments created by this parent.
    POST /parent/assignments/ - Create a new assignment for children.
    """

    permission_classes = [IsAuthenticated, IsParent]

    def get(self, request):
        assignments = Assignment.objects.filter(
            assigned_by_parent=request.user
        ).prefetch_related(
            'papers', 'resources', 'assigned_students', 'submissions'
        ).order_by('-due_date')

        data = ParentAssignmentSerializer(assignments, many=True).data
        return Response({'assignments': data})

    def post(self, request):
        serializer = ParentAssignmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        child_ids = serializer.validated_data.pop('child_ids', [])
        paper_ids = serializer.validated_data.pop('paper_ids', [])
        resource_ids = serializer.validated_data.pop('resource_ids', [])

        # Validate children belong to this parent
        valid_child_ids = ParentChild.objects.filter(
            parent=request.user, child_id__in=child_ids, status='active'
        ).values_list('child_id', flat=True)

        if len(valid_child_ids) != len(child_ids):
            return Response(
                {'error': 'One or more children are not linked to your account'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Create assignment
        assignment = Assignment.objects.create(
            assigned_by_parent=request.user,
            is_published=True,
            **serializer.validated_data,
        )

        if paper_ids:
            assignment.papers.set(paper_ids)
        if resource_ids:
            assignment.resources.set(resource_ids)
        if valid_child_ids:
            assignment.assigned_students.set(valid_child_ids)

        # Create submission records for each child
        for child_id in valid_child_ids:
            AssignmentSubmission.objects.get_or_create(
                assignment=assignment,
                student_id=child_id,
                defaults={'status': 'not_started'}
            )

        return Response(
            ParentAssignmentSerializer(assignment).data,
            status=status.HTTP_201_CREATED
        )


class ParentAssignmentDetailView(APIView):
    """
    GET /parent/assignments/{id}/ - Get assignment details.
    DELETE /parent/assignments/{id}/ - Delete an assignment.
    """

    permission_classes = [IsAuthenticated, IsParent]

    def get(self, request, pk):
        try:
            assignment = Assignment.objects.get(
                pk=pk, assigned_by_parent=request.user
            )
        except Assignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        return Response(ParentAssignmentSerializer(assignment).data)

    def delete(self, request, pk):
        try:
            assignment = Assignment.objects.get(
                pk=pk, assigned_by_parent=request.user
            )
        except Assignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        assignment.delete()
        return Response({'message': 'Assignment deleted'})
