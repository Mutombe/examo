"""
Views for the progress app - Student progress tracking APIs.
"""

from datetime import timedelta

from django.db.models import Sum, Count
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import TopicProgress, StudySession, Bookmark
from .serializers import (
    TopicProgressSerializer,
    TopicProgressSummarySerializer,
    StudySessionSerializer,
    StudyStreakSerializer,
    BookmarkSerializer,
    BookmarkCreateSerializer,
    BookmarkUpdateSerializer,
    OverallProgressSerializer,
)


# ============ Topic Progress ============

class TopicProgressListView(generics.ListAPIView):
    """List all topic progress for the current user."""

    serializer_class = TopicProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TopicProgress.objects.filter(
            user=self.request.user
        ).select_related('topic', 'topic__syllabus', 'topic__syllabus__subject')


class TopicProgressBySubjectView(APIView):
    """Get topic progress grouped by subject."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        progress = TopicProgress.objects.filter(
            user=request.user
        ).select_related('topic', 'topic__syllabus', 'topic__syllabus__subject')

        # Group by subject
        by_subject = {}
        for tp in progress:
            subject_name = tp.topic.syllabus.subject.name
            if subject_name not in by_subject:
                by_subject[subject_name] = {
                    'subject': subject_name,
                    'topics': [],
                    'total_mastery': 0,
                    'topics_count': 0
                }
            by_subject[subject_name]['topics'].append(TopicProgressSummarySerializer(tp).data)
            by_subject[subject_name]['total_mastery'] += tp.mastery_score
            by_subject[subject_name]['topics_count'] += 1

        # Calculate average mastery per subject
        result = []
        for subject_data in by_subject.values():
            if subject_data['topics_count'] > 0:
                subject_data['average_mastery'] = round(
                    subject_data['total_mastery'] / subject_data['topics_count'], 1
                )
            else:
                subject_data['average_mastery'] = 0
            del subject_data['total_mastery']
            del subject_data['topics_count']
            result.append(subject_data)

        return Response(result)


class TopicProgressDetailView(generics.RetrieveAPIView):
    """Get detailed progress for a specific topic."""

    serializer_class = TopicProgressSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return TopicProgress.objects.filter(
            user=self.request.user
        ).select_related('topic', 'topic__syllabus', 'topic__syllabus__subject')


# ============ Study Sessions ============

class StudySessionListView(generics.ListAPIView):
    """List recent study sessions for the current user."""

    serializer_class = StudySessionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        # Get last 30 days by default
        days = int(self.request.query_params.get('days', 30))
        start_date = timezone.now().date() - timedelta(days=days)
        return StudySession.objects.filter(
            user=self.request.user,
            date__gte=start_date
        )


class StudyStreakView(APIView):
    """Get study streak and summary statistics."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        today = timezone.now().date()

        # Calculate current streak
        current_streak = 0
        check_date = today
        while True:
            if StudySession.objects.filter(user=user, date=check_date).exists():
                current_streak += 1
                check_date -= timedelta(days=1)
            else:
                break

        # Calculate longest streak
        sessions = StudySession.objects.filter(user=user).order_by('date')
        longest_streak = 0
        temp_streak = 0
        prev_date = None

        for session in sessions:
            if prev_date is None:
                temp_streak = 1
            elif (session.date - prev_date).days == 1:
                temp_streak += 1
            else:
                temp_streak = 1
            longest_streak = max(longest_streak, temp_streak)
            prev_date = session.date

        # Get aggregate stats
        stats = StudySession.objects.filter(user=user).aggregate(
            total_study_days=Count('id'),
            total_questions=Sum('questions_attempted'),
            total_time=Sum('time_spent_seconds')
        )

        # Recent sessions
        recent = StudySession.objects.filter(user=user).order_by('-date')[:7]

        data = {
            'current_streak': current_streak,
            'longest_streak': longest_streak,
            'total_study_days': stats['total_study_days'] or 0,
            'total_questions': stats['total_questions'] or 0,
            'total_time_seconds': stats['total_time'] or 0,
            'recent_sessions': StudySessionSerializer(recent, many=True).data
        }

        return Response(data)


class LogStudyTimeView(APIView):
    """Log study time for today's session."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        time_seconds = request.data.get('time_seconds', 0)
        if time_seconds <= 0:
            return Response(
                {'error': 'time_seconds must be positive'},
                status=status.HTTP_400_BAD_REQUEST
            )

        today = timezone.now().date()
        session, created = StudySession.objects.get_or_create(
            user=request.user,
            date=today,
            defaults={'time_spent_seconds': time_seconds}
        )

        if not created:
            session.time_spent_seconds += time_seconds
            session.save()

        return Response(StudySessionSerializer(session).data)


# ============ Bookmarks ============

class BookmarkListCreateView(generics.ListCreateAPIView):
    """List or create bookmarks."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return BookmarkCreateSerializer
        return BookmarkSerializer

    def get_queryset(self):
        queryset = Bookmark.objects.filter(
            user=self.request.user
        ).select_related(
            'question', 'question__paper', 'question__paper__syllabus',
            'paper', 'paper__syllabus', 'paper__syllabus__subject',
            'resource',
        )

        folder = self.request.query_params.get('folder')
        if folder:
            queryset = queryset.filter(folder=folder)

        bookmark_type = self.request.query_params.get('type')
        if bookmark_type:
            queryset = queryset.filter(bookmark_type=bookmark_type)

        return queryset

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BookmarkDetailView(generics.RetrieveUpdateDestroyAPIView):
    """Get, update, or delete a bookmark."""

    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        if self.request.method in ['PUT', 'PATCH']:
            return BookmarkUpdateSerializer
        return BookmarkSerializer

    def get_queryset(self):
        return Bookmark.objects.filter(user=self.request.user)


class BookmarkByQuestionView(APIView):
    """Check if a question is bookmarked and toggle bookmark."""

    permission_classes = [IsAuthenticated]

    def get(self, request, question_id):
        """Check if question is bookmarked."""
        bookmark = Bookmark.objects.filter(
            user=request.user,
            question_id=question_id,
            bookmark_type='question'
        ).first()

        if bookmark:
            return Response({
                'is_bookmarked': True,
                'bookmark': BookmarkSerializer(bookmark).data
            })
        return Response({'is_bookmarked': False, 'bookmark': None})

    def post(self, request, question_id):
        """Toggle bookmark for a question."""
        bookmark = Bookmark.objects.filter(
            user=request.user,
            question_id=question_id,
            bookmark_type='question'
        ).first()

        if bookmark:
            # Remove bookmark
            bookmark.delete()
            return Response({'is_bookmarked': False, 'message': 'Bookmark removed'})
        else:
            # Create bookmark
            from apps.exams.models import Question
            try:
                question = Question.objects.get(id=question_id)
            except Question.DoesNotExist:
                return Response(
                    {'error': 'Question not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            bookmark = Bookmark.objects.create(
                user=request.user,
                question=question,
                bookmark_type='question',
                note=request.data.get('note', ''),
                folder=request.data.get('folder', 'default')
            )
            return Response({
                'is_bookmarked': True,
                'bookmark': BookmarkSerializer(bookmark).data
            }, status=status.HTTP_201_CREATED)


class BookmarkByPaperView(APIView):
    """Check if a paper is bookmarked and toggle bookmark."""

    permission_classes = [IsAuthenticated]

    def get(self, request, paper_id):
        """Check if paper is bookmarked."""
        bookmark = Bookmark.objects.filter(
            user=request.user,
            paper_id=paper_id,
            bookmark_type='paper'
        ).first()

        if bookmark:
            return Response({
                'is_bookmarked': True,
                'bookmark': BookmarkSerializer(bookmark).data
            })
        return Response({'is_bookmarked': False, 'bookmark': None})

    def post(self, request, paper_id):
        """Toggle bookmark for a paper."""
        bookmark = Bookmark.objects.filter(
            user=request.user,
            paper_id=paper_id,
            bookmark_type='paper'
        ).first()

        if bookmark:
            bookmark.delete()
            return Response({'is_bookmarked': False, 'message': 'Bookmark removed'})
        else:
            from apps.exams.models import Paper
            try:
                paper = Paper.objects.get(id=paper_id)
            except Paper.DoesNotExist:
                return Response(
                    {'error': 'Paper not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            bookmark = Bookmark.objects.create(
                user=request.user,
                paper=paper,
                bookmark_type='paper',
                note=request.data.get('note', ''),
                folder=request.data.get('folder', 'default')
            )
            return Response({
                'is_bookmarked': True,
                'bookmark': BookmarkSerializer(bookmark).data
            }, status=status.HTTP_201_CREATED)


class BookmarkByResourceView(APIView):
    """Check if a resource is bookmarked and toggle bookmark."""

    permission_classes = [IsAuthenticated]

    def get(self, request, resource_id):
        """Check if resource is bookmarked."""
        bookmark = Bookmark.objects.filter(
            user=request.user,
            resource_id=resource_id,
            bookmark_type='resource'
        ).first()

        if bookmark:
            return Response({
                'is_bookmarked': True,
                'bookmark': BookmarkSerializer(bookmark).data
            })
        return Response({'is_bookmarked': False, 'bookmark': None})

    def post(self, request, resource_id):
        """Toggle bookmark for a resource."""
        bookmark = Bookmark.objects.filter(
            user=request.user,
            resource_id=resource_id,
            bookmark_type='resource'
        ).first()

        if bookmark:
            bookmark.delete()
            return Response({'is_bookmarked': False, 'message': 'Bookmark removed'})
        else:
            from apps.library.models import Resource
            try:
                resource = Resource.objects.get(id=resource_id)
            except Resource.DoesNotExist:
                return Response(
                    {'error': 'Resource not found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            bookmark = Bookmark.objects.create(
                user=request.user,
                resource=resource,
                bookmark_type='resource',
                note=request.data.get('note', ''),
                folder=request.data.get('folder', 'default')
            )
            return Response({
                'is_bookmarked': True,
                'bookmark': BookmarkSerializer(bookmark).data
            }, status=status.HTTP_201_CREATED)


# ============ Overall Progress ============

class OverallProgressView(APIView):
    """Get overall progress statistics for the current user."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user

        # Topic progress aggregates
        topic_stats = TopicProgress.objects.filter(user=user).aggregate(
            total_attempted=Sum('questions_attempted'),
            total_correct=Sum('questions_correct'),
            total_earned=Sum('total_marks_earned'),
            total_possible=Sum('total_marks_possible'),
            topics_started=Count('id'),
        )

        topics_mastered = TopicProgress.objects.filter(
            user=user,
            mastery_level='mastered'
        ).count()

        # Study time
        total_time = StudySession.objects.filter(user=user).aggregate(
            total=Sum('time_spent_seconds')
        )['total'] or 0

        # Calculate overall scores
        total_attempted = topic_stats['total_attempted'] or 0
        total_correct = topic_stats['total_correct'] or 0
        total_earned = topic_stats['total_earned'] or 0
        total_possible = topic_stats['total_possible'] or 0

        accuracy = 0
        if total_attempted > 0:
            accuracy = round((total_correct / total_attempted) * 100, 1)

        score = 0
        if total_possible > 0:
            score = round((total_earned / total_possible) * 100, 1)

        # Subjects studied
        subjects = TopicProgress.objects.filter(
            user=user
        ).values(
            'topic__syllabus__subject__name'
        ).annotate(
            topics_count=Count('id'),
            avg_mastery=Sum('mastery_score') / Count('id')
        ).order_by('-avg_mastery')

        subjects_data = [
            {
                'name': s['topic__syllabus__subject__name'],
                'topics_count': s['topics_count'],
                'average_mastery': round(s['avg_mastery'], 1)
            }
            for s in subjects
        ]

        data = {
            'total_questions_attempted': total_attempted,
            'total_questions_correct': total_correct,
            'total_marks_earned': total_earned,
            'total_marks_possible': total_possible,
            'overall_accuracy': accuracy,
            'overall_score': score,
            'topics_started': topic_stats['topics_started'] or 0,
            'topics_mastered': topics_mastered,
            'current_streak_days': user.current_streak_days,
            'total_study_time_seconds': total_time,
            'subjects_studied': subjects_data
        }

        return Response(data)


class WeakTopicsView(APIView):
    """Get topics that need more practice."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        # Get topics with low mastery that have been attempted
        weak_topics = TopicProgress.objects.filter(
            user=request.user,
            questions_attempted__gt=0,
            mastery_score__lt=70  # Below 70% mastery
        ).select_related(
            'topic', 'topic__syllabus', 'topic__syllabus__subject'
        ).order_by('mastery_score')[:10]

        return Response(TopicProgressSerializer(weak_topics, many=True).data)


class RecommendedTopicsView(APIView):
    """Get recommended topics to study next."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        from apps.exams.models import Topic

        user = request.user

        # Get topics user hasn't started yet
        practiced_topic_ids = TopicProgress.objects.filter(
            user=user
        ).values_list('topic_id', flat=True)

        # Get topics from syllabi the user has shown interest in
        interested_syllabi = TopicProgress.objects.filter(
            user=user
        ).values_list('topic__syllabus_id', flat=True).distinct()

        recommended = Topic.objects.filter(
            syllabus_id__in=interested_syllabi
        ).exclude(
            id__in=practiced_topic_ids
        ).select_related(
            'syllabus', 'syllabus__subject'
        ).order_by('?')[:5]  # Random selection

        data = [
            {
                'id': t.id,
                'name': t.name,
                'syllabus': t.syllabus.display_name,
                'subject': t.syllabus.subject.name,
                'question_count': t.questions.count()
            }
            for t in recommended
        ]

        return Response(data)
