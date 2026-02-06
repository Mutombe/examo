"""
URL patterns for the progress app.
"""

from django.urls import path

from .views import (
    # Topic Progress
    TopicProgressListView,
    TopicProgressBySubjectView,
    TopicProgressDetailView,
    # Study Sessions
    StudySessionListView,
    StudyStreakView,
    LogStudyTimeView,
    # Bookmarks
    BookmarkListCreateView,
    BookmarkDetailView,
    BookmarkByQuestionView,
    BookmarkByPaperView,
    BookmarkByResourceView,
    # Overall Progress
    OverallProgressView,
    WeakTopicsView,
    RecommendedTopicsView,
)

app_name = 'progress'

urlpatterns = [
    # Topic Progress
    path('progress/topics/', TopicProgressListView.as_view(), name='topic-progress-list'),
    path('progress/topics/by-subject/', TopicProgressBySubjectView.as_view(), name='topic-progress-by-subject'),
    path('progress/topics/<int:pk>/', TopicProgressDetailView.as_view(), name='topic-progress-detail'),

    # Study Sessions & Streak
    path('progress/sessions/', StudySessionListView.as_view(), name='study-session-list'),
    path('progress/streak/', StudyStreakView.as_view(), name='study-streak'),
    path('progress/log-time/', LogStudyTimeView.as_view(), name='log-study-time'),

    # Bookmarks
    path('bookmarks/', BookmarkListCreateView.as_view(), name='bookmark-list-create'),
    path('bookmarks/<int:pk>/', BookmarkDetailView.as_view(), name='bookmark-detail'),
    path('bookmarks/question/<int:question_id>/', BookmarkByQuestionView.as_view(), name='bookmark-by-question'),
    path('bookmarks/paper/<int:paper_id>/', BookmarkByPaperView.as_view(), name='bookmark-by-paper'),
    path('bookmarks/resource/<int:resource_id>/', BookmarkByResourceView.as_view(), name='bookmark-by-resource'),

    # Overall Progress
    path('progress/', OverallProgressView.as_view(), name='overall-progress'),
    path('progress/weak-topics/', WeakTopicsView.as_view(), name='weak-topics'),
    path('progress/recommended/', RecommendedTopicsView.as_view(), name='recommended-topics'),
]
