"""
Views for the users app.
"""

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail, EmailMultiAlternatives
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer, RegisterSerializer, SchoolAdminRegisterSerializer,
    LoginSerializer, GoogleAuthSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    ChangePasswordSerializer
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""

    queryset = User.objects.all()
    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = RegisterSerializer

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class SchoolAdminRegisterView(APIView):
    """Register a school admin - creates user, school, and teacher profile."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SchoolAdminRegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        from django.utils.text import slugify
        from apps.schools.models import School, TeacherProfile

        # Create the school
        base_slug = slugify(data['school_name'])
        slug = base_slug
        counter = 1
        while School.objects.filter(slug=slug).exists():
            slug = f"{base_slug}-{counter}"
            counter += 1

        school = School.objects.create(
            name=data['school_name'],
            slug=slug,
            school_type=data['school_type'],
            province=data['province'],
            city=data['city'],
            email=data.get('school_email', ''),
            phone=data.get('school_phone', ''),
        )

        # Create the user
        username = data['email'].split('@')[0]
        base_username = username
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f"{base_username}{counter}"
            counter += 1

        user = User.objects.create_user(
            email=data['email'],
            username=username,
            first_name=data['first_name'],
            last_name=data['last_name'],
            password=data['password'],
            role='school_admin',
            phone_number=data.get('phone_number', ''),
            school_name=data['school_name'],
        )

        # Create teacher profile (school admins also have a teacher profile for school association)
        TeacherProfile.objects.create(
            user=user,
            school=school,
            role='head',
            can_create_assignments=True,
            can_view_school_analytics=True,
            can_manage_teachers=True,
            can_manage_students=True,
        )

        # Update school stats
        school.total_teachers = 1
        school.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'school': {
                'id': school.id,
                'name': school.name,
                'slug': school.slug,
            },
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        }, status=status.HTTP_201_CREATED)


class AcceptInvitationView(APIView):
    """Accept a teacher invitation - creates user or links existing user to school."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def get(self, request, token):
        """Check if invitation is valid."""
        from apps.schools.models import TeacherInvitation

        try:
            invitation = TeacherInvitation.objects.select_related('school').get(token=token)
        except TeacherInvitation.DoesNotExist:
            return Response({'error': 'Invalid invitation link'}, status=status.HTTP_404_NOT_FOUND)

        if invitation.status != 'pending':
            return Response({'error': f'This invitation has already been {invitation.status}'}, status=status.HTTP_400_BAD_REQUEST)

        if invitation.is_expired:
            invitation.status = 'expired'
            invitation.save()
            return Response({'error': 'This invitation has expired'}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'email': invitation.email,
            'school_name': invitation.school.name,
            'role': invitation.role,
            'department': invitation.department,
        })

    def post(self, request, token):
        """Accept the invitation - register or link existing user."""
        from apps.schools.models import TeacherInvitation, TeacherProfile

        try:
            invitation = TeacherInvitation.objects.select_related('school').get(token=token)
        except TeacherInvitation.DoesNotExist:
            return Response({'error': 'Invalid invitation link'}, status=status.HTTP_404_NOT_FOUND)

        if invitation.status != 'pending':
            return Response({'error': f'This invitation has already been {invitation.status}'}, status=status.HTTP_400_BAD_REQUEST)

        if invitation.is_expired:
            invitation.status = 'expired'
            invitation.save()
            return Response({'error': 'This invitation has expired'}, status=status.HTTP_400_BAD_REQUEST)

        # Check if user exists
        existing_user = User.objects.filter(email=invitation.email).first()

        if existing_user:
            user = existing_user
            # If user provides password, verify it
            password = request.data.get('password')
            if password and not user.check_password(password):
                return Response({'error': 'Invalid password for existing account'}, status=status.HTTP_400_BAD_REQUEST)
        else:
            # Must provide registration data for new user
            first_name = request.data.get('first_name')
            last_name = request.data.get('last_name')
            password = request.data.get('password')

            if not all([first_name, last_name, password]):
                return Response(
                    {'error': 'first_name, last_name, and password are required for new accounts'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            username = invitation.email.split('@')[0]
            base_username = username
            counter = 1
            while User.objects.filter(username=username).exists():
                username = f"{base_username}{counter}"
                counter += 1

            user = User.objects.create_user(
                email=invitation.email,
                username=username,
                first_name=first_name,
                last_name=last_name,
                password=password,
                role='teacher',
            )

        # Update role if needed
        if user.role not in ['teacher', 'school_admin', 'admin']:
            user.role = 'teacher'
            user.save()

        # Create teacher profile (or reactivate)
        profile, created = TeacherProfile.objects.get_or_create(
            user=user,
            school=invitation.school,
            defaults={
                'role': invitation.role,
                'department': invitation.department,
                'can_create_assignments': True,
            }
        )
        if not created:
            profile.is_active = True
            profile.role = invitation.role
            profile.department = invitation.department
            profile.save()

        # Mark invitation as accepted
        invitation.status = 'accepted'
        invitation.accepted_at = timezone.now()
        invitation.save()

        # Update school stats
        school = invitation.school
        school.total_teachers = school.teachers.filter(is_active=True).count()
        school.save()

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'school': {
                'id': school.id,
                'name': school.name,
            },
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """User login endpoint."""

    authentication_classes = []
    permission_classes = [AllowAny]
    serializer_class = LoginSerializer

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        if not user.check_password(password):
            return Response(
                {'error': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Generate tokens
        refresh = RefreshToken.for_user(user)

        return Response({
            'user': UserSerializer(user).data,
            'access': str(refresh.access_token),
            'refresh': str(refresh),
        })


class MeView(generics.RetrieveUpdateAPIView):
    """Get and update current user's profile."""

    permission_classes = [IsAuthenticated]
    serializer_class = UserSerializer

    def get_object(self):
        return self.request.user


class PasswordResetRequestView(APIView):
    """Request a password reset email."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email=email)
            token = default_token_generator.make_token(user)

            site_url = getattr(settings, 'SITE_URL', settings.FRONTEND_URL)
            reset_url = f"{site_url}/reset-password?token={token}&uid={user.id}"

            subject = 'Reset Your Password - ExamRevise Zimbabwe'
            text_body = (
                f"Hi {user.first_name or 'there'},\n\n"
                f"We received a request to reset your password for your ExamRevise account.\n\n"
                f"Click this link to reset your password:\n{reset_url}\n\n"
                f"This link will expire in a few hours. If you didn't request this, you can safely ignore this email.\n\n"
                f"- The ExamRevise Team"
            )
            html_body = f"""
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 24px;">
              <div style="text-align: center; margin-bottom: 32px;">
                <h1 style="font-size: 24px; font-weight: 700; color: #111827; margin: 0;">ExamRevise</h1>
                <p style="color: #6b7280; font-size: 14px; margin: 4px 0 0;">Zimbabwe Exam Preparation</p>
              </div>
              <div style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 12px; padding: 32px;">
                <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 8px;">Reset Your Password</h2>
                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
                  Hi {user.first_name or 'there'}, we received a request to reset the password for your account.
                </p>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="{reset_url}" style="display: inline-block; background: #4f46e5; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; padding: 12px 32px; border-radius: 8px;">
                    Reset Password
                  </a>
                </div>
                <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
                  This link will expire in a few hours. If you didn't request this, you can safely ignore this email &mdash; your password won't change.
                </p>
              </div>
              <div style="text-align: center; margin-top: 24px;">
                <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                  ExamRevise Zimbabwe &bull; <a href="{site_url}" style="color: #9ca3af;">examrevise.co.zw</a>
                </p>
              </div>
            </div>
            """

            msg = EmailMultiAlternatives(
                subject=subject,
                body=text_body,
                from_email=settings.DEFAULT_FROM_EMAIL,
                to=[email],
            )
            msg.attach_alternative(html_body, 'text/html')
            msg.send(fail_silently=True)

        except User.DoesNotExist:
            pass

        return Response({
            'message': 'If an account exists with this email, a password reset link has been sent.'
        })


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        password = serializer.validated_data['password']

        try:
            user = User.objects.get(id=uid)

            if not default_token_generator.check_token(user, token):
                return Response(
                    {'error': 'Invalid or expired reset token'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            user.set_password(password)
            user.save()

            return Response({'message': 'Password has been reset successfully'})

        except User.DoesNotExist:
            return Response(
                {'error': 'Invalid reset request'},
                status=status.HTTP_400_BAD_REQUEST
            )


class ChangePasswordView(APIView):
    """Change password for authenticated user."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = ChangePasswordSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        current_password = serializer.validated_data['current_password']
        new_password = serializer.validated_data['new_password']

        if not user.check_password(current_password):
            return Response(
                {'error': 'Current password is incorrect'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user.set_password(new_password)
        user.save()

        return Response({'message': 'Password changed successfully'})


class GoogleAuthView(APIView):
    """Sign in or register with a Google ID token."""

    authentication_classes = []
    permission_classes = [AllowAny]

    def post(self, request):
        import requests as http_requests

        serializer = GoogleAuthSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        credential = serializer.validated_data['credential']

        if not settings.GOOGLE_CLIENT_ID:
            return Response(
                {'error': 'Google sign-in is not configured on the server (missing GOOGLE_CLIENT_ID)'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Verify the Google ID token via Google's tokeninfo endpoint
        try:
            google_resp = http_requests.get(
                'https://oauth2.googleapis.com/tokeninfo',
                params={'id_token': credential},
                timeout=10,
            )
            if google_resp.status_code != 200:
                return Response(
                    {'error': 'Invalid Google token'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            idinfo = google_resp.json()
        except Exception as e:
            return Response(
                {'error': f'Google token verification failed: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Verify the token was issued for our app
        if idinfo.get('aud') != settings.GOOGLE_CLIENT_ID:
            return Response(
                {'error': 'Google token was not issued for this application'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        email = idinfo.get('email')
        if not email or idinfo.get('email_verified') != 'true':
            return Response(
                {'error': 'No verified email found in Google token'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = idinfo.get('given_name', '')
        last_name = idinfo.get('family_name', '')

        try:
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': self._unique_username(email),
                    'first_name': first_name,
                    'last_name': last_name,
                    'role': 'student',
                },
            )

            if created:
                user.set_unusable_password()
                user.save()
            else:
                # Fill in blank name fields from Google profile
                changed = False
                if not user.first_name and first_name:
                    user.first_name = first_name
                    changed = True
                if not user.last_name and last_name:
                    user.last_name = last_name
                    changed = True
                if changed:
                    user.save()

            refresh = RefreshToken.for_user(user)

            return Response({
                'user': UserSerializer(user).data,
                'access': str(refresh.access_token),
                'refresh': str(refresh),
            }, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'error': f'Account creation failed: {str(e)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @staticmethod
    def _unique_username(email: str) -> str:
        base = email.split('@')[0]
        username = base
        counter = 1
        while User.objects.filter(username=username).exists():
            username = f'{base}{counter}'
            counter += 1
        return username
