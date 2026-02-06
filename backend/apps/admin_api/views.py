"""
Views for the admin API.
"""

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db.models import Count, Q
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.exams.models import Paper, Question


def get_full_media_url(request, file_field):
    """Get full URL for a media file including domain."""
    if not file_field:
        return None
    # Build absolute URI
    return request.build_absolute_uri(file_field.url)

User = get_user_model()


class IsAdmin:
    """Permission mixin that checks if user has admin role."""

    def check_admin_permission(self, request):
        """Check if the user is authenticated and has admin role."""
        if not request.user.is_authenticated:
            return False
        return request.user.role == 'admin' or request.user.is_superuser


class AdminStatsView(APIView, IsAdmin):
    """
    GET /admin/stats/ - Return counts of papers, users, questions.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        # Paper counts - handle case where status field might not exist
        total_papers = Paper.objects.count()

        try:
            # Try to get counts by status
            pending_papers = Paper.objects.filter(status='pending').count()
            approved_papers = Paper.objects.filter(status='approved').count()
            rejected_papers = Paper.objects.filter(status='rejected').count()
        except Exception:
            # Status field doesn't exist yet
            pending_papers = 0
            approved_papers = total_papers  # Assume all existing papers are approved
            rejected_papers = 0

        # User and question counts
        total_users = User.objects.count()
        total_questions = Question.objects.count()

        # Additional user breakdown by role
        users_by_role = dict(
            User.objects.values('role').annotate(count=Count('id')).values_list('role', 'count')
        )

        return Response({
            'papers': {
                'total': total_papers,
                'pending': pending_papers,
                'approved': approved_papers,
                'rejected': rejected_papers,
            },
            'users': {
                'total': total_users,
                'by_role': users_by_role,
            },
            'questions': {
                'total': total_questions,
            }
        })


class AdminPendingPapersView(APIView, IsAdmin):
    """
    GET /admin/papers/pending/ - List papers with status='pending'.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            papers = Paper.objects.filter(status='pending').select_related(
                'syllabus', 'syllabus__board', 'syllabus__subject', 'uploaded_by'
            ).order_by('-created_at')
        except Exception:
            # Status field doesn't exist
            papers = Paper.objects.none()

        paper_list = []
        for paper in papers:
            paper_list.append({
                'id': paper.id,
                'title': paper.title,
                'paper_type': paper.paper_type,
                'year': paper.year,
                'session': paper.session,
                'duration_minutes': paper.duration_minutes,
                'total_marks': paper.total_marks,
                'question_count': paper.question_count,
                'syllabus': {
                    'id': paper.syllabus.id,
                    'board': paper.syllabus.board.name,
                    'subject': paper.syllabus.subject.name,
                    'level': paper.syllabus.get_level_display(),
                },
                'status': getattr(paper, 'status', 'approved'),
                'pdf_url': get_full_media_url(request, paper.pdf_file),
                'marking_scheme_url': get_full_media_url(request, paper.marking_scheme_file) if hasattr(paper, 'marking_scheme_file') else None,
                'uploaded_by_name': paper.uploaded_by.email if hasattr(paper, 'uploaded_by') and paper.uploaded_by else 'Unknown',
                'created_at': paper.created_at.isoformat(),
                'updated_at': paper.updated_at.isoformat(),
            })

        return Response({
            'count': len(paper_list),
            'results': paper_list,
        })


class AdminPapersView(APIView, IsAdmin):
    """
    GET /admin/papers/ - List all papers with optional status filter.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        papers = Paper.objects.select_related(
            'syllabus', 'syllabus__board', 'syllabus__subject'
        ).order_by('-created_at')

        # Filter by status if provided
        status_filter = request.query_params.get('status')
        if status_filter:
            try:
                papers = papers.filter(status=status_filter)
            except Exception:
                # Status field doesn't exist, return all papers if approved, none otherwise
                if status_filter != 'approved':
                    papers = Paper.objects.none()

        paper_list = []
        for paper in papers:
            paper_list.append({
                'id': paper.id,
                'title': paper.title,
                'paper_type': paper.paper_type,
                'year': paper.year,
                'session': paper.session,
                'duration_minutes': paper.duration_minutes,
                'total_marks': paper.total_marks,
                'question_count': paper.question_count,
                'syllabus': {
                    'id': paper.syllabus.id,
                    'board': paper.syllabus.board.name,
                    'subject': paper.syllabus.subject.name,
                    'level': paper.syllabus.get_level_display(),
                },
                'status': getattr(paper, 'status', 'approved'),
                'is_active': paper.is_active,
                'pdf_url': get_full_media_url(request, paper.pdf_file),
                'marking_scheme_url': get_full_media_url(request, paper.marking_scheme_file) if hasattr(paper, 'marking_scheme_file') else None,
                'uploaded_by_name': paper.uploaded_by.email if hasattr(paper, 'uploaded_by') and paper.uploaded_by else 'Unknown',
                'rejection_reason': getattr(paper, 'rejection_reason', None),
                'created_at': paper.created_at.isoformat(),
                'updated_at': paper.updated_at.isoformat(),
            })

        return Response({
            'count': len(paper_list),
            'results': paper_list,
        })


class AdminPaperApproveView(APIView, IsAdmin):
    """
    POST /admin/papers/{id}/approve/ - Set status to 'approved'.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            paper = Paper.objects.get(pk=pk)
        except Paper.DoesNotExist:
            return Response(
                {'error': 'Paper not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Set status to approved and activate the paper
        if hasattr(paper, 'status'):
            paper.status = 'approved'
        paper.is_active = True
        paper.save(update_fields=['status', 'is_active', 'updated_at'] if hasattr(paper, 'status') else ['is_active', 'updated_at'])

        return Response({
            'message': 'Paper approved successfully',
            'paper': {
                'id': paper.id,
                'title': paper.title,
                'status': getattr(paper, 'status', 'approved'),
                'is_active': paper.is_active,
            }
        })


class AdminPaperRejectView(APIView, IsAdmin):
    """
    POST /admin/papers/{id}/reject/ - Set status to 'rejected' with reason.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            paper = Paper.objects.get(pk=pk)
        except Paper.DoesNotExist:
            return Response(
                {'error': 'Paper not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        reason = request.data.get('reason', '')

        # Try to set status if field exists
        if hasattr(paper, 'status'):
            paper.status = 'rejected'
            # Store reason if rejection_reason field exists
            if hasattr(paper, 'rejection_reason'):
                paper.rejection_reason = reason
                paper.save(update_fields=['status', 'rejection_reason', 'updated_at'])
            else:
                paper.save(update_fields=['status', 'updated_at'])

            return Response({
                'message': 'Paper rejected',
                'paper': {
                    'id': paper.id,
                    'title': paper.title,
                    'status': paper.status,
                    'reason': reason,
                }
            })
        else:
            # Status field doesn't exist, mark as inactive
            paper.is_active = False
            paper.save(update_fields=['is_active', 'updated_at'])
            return Response({
                'message': 'Paper deactivated (status field not available)',
                'paper': {
                    'id': paper.id,
                    'title': paper.title,
                    'is_active': paper.is_active,
                    'reason': reason,
                }
            })


class AdminPaperProcessView(APIView, IsAdmin):
    """
    POST /admin/papers/{id}/process/ - Process paper with AI to extract questions.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            paper = Paper.objects.get(pk=pk)
        except Paper.DoesNotExist:
            return Response(
                {'error': 'Paper not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Check if paper has a PDF
        if not paper.pdf_file:
            return Response(
                {'error': 'No PDF file attached to this paper'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Process the paper with AI
        from apps.ai_marking.paper_processing import PaperProcessingService

        service = PaperProcessingService()
        result = service.process_paper(paper)

        if result['success']:
            # Activate the paper after successful question extraction
            paper.is_active = True
            paper.save(update_fields=['is_active', 'updated_at'])

            return Response({
                'message': 'Paper processed successfully',
                'paper': {
                    'id': paper.id,
                    'title': paper.title,
                    'is_active': paper.is_active,
                },
                'questions_extracted': result['questions_extracted'],
                'total_marks': result.get('total_marks', 0),
            })
        else:
            return Response({
                'error': result['error'],
                'paper': {
                    'id': paper.id,
                    'title': paper.title,
                },
            }, status=status.HTTP_400_BAD_REQUEST)


class AdminUsersView(APIView, IsAdmin):
    """
    GET /admin/users/ - List all users.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        users = User.objects.all().order_by('-created_at')

        # Optional filters
        role_filter = request.query_params.get('role')
        if role_filter:
            users = users.filter(role=role_filter)

        search = request.query_params.get('search')
        if search:
            users = users.filter(
                Q(email__icontains=search) |
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search)
            )

        user_list = []
        for user in users:
            user_list.append({
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'role': user.role,
                'is_active': user.is_active,
                'is_premium': user.is_premium,
                'school_name': user.school_name,
                'current_form': user.current_form,
                'date_joined': user.date_joined.isoformat() if user.date_joined else None,
                'last_login': user.last_login.isoformat() if user.last_login else None,
                'created_at': user.created_at.isoformat(),
            })

        return Response({
            'count': len(user_list),
            'results': user_list,
        })


class AdminUserUpdateView(APIView, IsAdmin):
    """
    PATCH /admin/users/{id}/ - Update user role.
    """
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        if not self.check_admin_permission(request):
            return Response(
                {'error': 'Admin access required'},
                status=status.HTTP_403_FORBIDDEN
            )

        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response(
                {'error': 'User not found'},
                status=status.HTTP_404_NOT_FOUND
            )

        # Prevent admin from demoting themselves
        if user.id == request.user.id:
            return Response(
                {'error': 'Cannot modify your own account'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Update allowed fields
        update_fields = []

        if 'role' in request.data:
            valid_roles = ['student', 'teacher', 'parent', 'school_admin', 'admin']
            new_role = request.data['role']
            if new_role not in valid_roles:
                return Response(
                    {'error': f'Invalid role. Must be one of: {", ".join(valid_roles)}'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.role = new_role
            update_fields.append('role')

        if 'is_active' in request.data:
            user.is_active = request.data['is_active']
            update_fields.append('is_active')

        if 'is_premium' in request.data:
            user.is_premium = request.data['is_premium']
            update_fields.append('is_premium')

        if update_fields:
            update_fields.append('updated_at')
            user.save(update_fields=update_fields)

        return Response({
            'message': 'User updated successfully',
            'user': {
                'id': user.id,
                'email': user.email,
                'username': user.username,
                'role': user.role,
                'is_active': user.is_active,
                'is_premium': user.is_premium,
            }
        })
