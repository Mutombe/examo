"""
URL patterns for the attempts app.
"""

from django.urls import path

from .views import (
    AttemptListCreateView,
    AttemptDetailView,
    AttemptSubmitView,
    AttemptResultView,
    AnswerCreateUpdateView,
    AttemptSyncAnswersView,
    AttemptTrackingView,
    MarkingProgressView,
)

urlpatterns = [
    path('attempts/', AttemptListCreateView.as_view(), name='attempt-list-create'),
    path('attempts/<int:pk>/', AttemptDetailView.as_view(), name='attempt-detail'),
    path('attempts/<int:pk>/submit/', AttemptSubmitView.as_view(), name='attempt-submit'),
    path('attempts/<int:pk>/results/', AttemptResultView.as_view(), name='attempt-results'),
    path('attempts/<int:pk>/marking-progress/', MarkingProgressView.as_view(), name='attempt-marking-progress'),
    path('attempts/<int:pk>/sync-answers/', AttemptSyncAnswersView.as_view(), name='attempt-sync-answers'),
    path('attempts/<int:pk>/track/', AttemptTrackingView.as_view(), name='attempt-track'),
    path('answers/', AnswerCreateUpdateView.as_view(), name='answer-create'),
]
