"""
URL patterns for the users app.
"""

from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView, SchoolAdminRegisterView, AcceptInvitationView,
    LoginView, GoogleAuthView, MeView,
    PasswordResetRequestView, PasswordResetConfirmView, ChangePasswordView
)

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('register/school-admin/', SchoolAdminRegisterView.as_view(), name='register-school-admin'),
    path('invitations/<str:token>/', AcceptInvitationView.as_view(), name='accept-invitation'),
    path('login/', LoginView.as_view(), name='login'),
    path('google/', GoogleAuthView.as_view(), name='google-auth'),
    path('refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('me/', MeView.as_view(), name='me'),
    path('password-reset/', PasswordResetRequestView.as_view(), name='password-reset'),
    path('password-reset/confirm/', PasswordResetConfirmView.as_view(), name='password-reset-confirm'),
    path('change-password/', ChangePasswordView.as_view(), name='change-password'),
]
