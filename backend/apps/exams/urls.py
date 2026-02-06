"""
URL patterns for the exams app.
"""

from django.urls import path

from .views import (
    ExaminationBoardListView,
    SubjectListView,
    SyllabusListView,
    TopicListView,
    TopicDetailView,
    TopicQuestionsView,
    PaperListView,
    PaperDetailView,
    PaperQuestionsView,
    PaperUploadView,
)

urlpatterns = [
    path('boards/', ExaminationBoardListView.as_view(), name='board-list'),
    path('subjects/', SubjectListView.as_view(), name='subject-list'),
    path('syllabi/', SyllabusListView.as_view(), name='syllabus-list'),
    path('topics/', TopicListView.as_view(), name='topic-list'),
    path('topics/<int:pk>/', TopicDetailView.as_view(), name='topic-detail'),
    path('topics/<int:topic_id>/questions/', TopicQuestionsView.as_view(), name='topic-questions'),
    path('papers/', PaperListView.as_view(), name='paper-list'),
    path('papers/upload/', PaperUploadView.as_view(), name='paper-upload'),
    path('papers/<int:pk>/', PaperDetailView.as_view(), name='paper-detail'),
    path('papers/<int:paper_id>/questions/', PaperQuestionsView.as_view(), name='paper-questions'),
]
