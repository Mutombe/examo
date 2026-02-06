"""
URL configuration for admin API.
"""

from django.urls import path

from .views import (
    AdminStatsView,
    AdminPendingPapersView,
    AdminPapersView,
    AdminPaperApproveView,
    AdminPaperRejectView,
    AdminPaperProcessView,
    AdminUsersView,
    AdminUserUpdateView,
)

app_name = 'admin_api'

urlpatterns = [
    # Stats
    path('stats/', AdminStatsView.as_view(), name='stats'),

    # Papers management
    path('papers/', AdminPapersView.as_view(), name='papers-list'),
    path('papers/pending/', AdminPendingPapersView.as_view(), name='papers-pending'),
    path('papers/<int:pk>/approve/', AdminPaperApproveView.as_view(), name='paper-approve'),
    path('papers/<int:pk>/reject/', AdminPaperRejectView.as_view(), name='paper-reject'),
    path('papers/<int:pk>/process/', AdminPaperProcessView.as_view(), name='paper-process'),

    # Users management
    path('users/', AdminUsersView.as_view(), name='users-list'),
    path('users/<int:pk>/', AdminUserUpdateView.as_view(), name='user-update'),
]
