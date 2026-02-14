"""
URL patterns for the notifications app.
"""

from django.urls import path

from .views import (
    NotificationListView,
    UnreadCountView,
    MarkReadView,
    MarkAllReadView,
)

urlpatterns = [
    path('notifications/', NotificationListView.as_view(), name='notification-list'),
    path('notifications/unread-count/', UnreadCountView.as_view(), name='notification-unread-count'),
    path('notifications/<int:pk>/read/', MarkReadView.as_view(), name='notification-mark-read'),
    path('notifications/read-all/', MarkAllReadView.as_view(), name='notification-read-all'),
]
