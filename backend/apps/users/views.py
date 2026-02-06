"""
Views for the users app.
"""

import secrets
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .serializers import (
    UserSerializer, RegisterSerializer, SchoolAdminRegisterSerializer,
    LoginSerializer,
    PasswordResetRequestSerializer, PasswordResetConfirmSerializer,
    ChangePasswordSerializer
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    """User registration endpoint."""

    queryset = User.objects.all()
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

    permission_classes = [AllowAny]

    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        email = serializer.validated_data['email']

        try:
            user = User.objects.get(email=email)
            # Generate a token
            token = default_token_generator.make_token(user)

            # In production, send an actual email
            # For now, we'll just return the token (development only)
            reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}&uid={user.id}"

            # TODO: Send actual email in production
            # send_mail(
            #     'Password Reset - ExamRevise Zimbabwe',
            #     f'Click here to reset your password: {reset_url}',
            #     settings.DEFAULT_FROM_EMAIL,
            #     [email],
            #     fail_silently=False,
            # )

        except User.DoesNotExist:
            # Don't reveal that the email doesn't exist
            pass

        return Response({
            'message': 'If an account exists with this email, a password reset link has been sent.'
        })


class PasswordResetConfirmView(APIView):
    """Confirm password reset with token."""

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
