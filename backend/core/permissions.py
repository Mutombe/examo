"""
Custom permissions for the ExamRevise API.
"""

from rest_framework import permissions


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """

    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner
        return obj.user == request.user


class IsOwner(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to access it.
    """

    def has_object_permission(self, request, view, obj):
        return obj.user == request.user


class IsTeacher(permissions.BasePermission):
    """
    Custom permission to only allow teachers to access.
    """

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ['teacher', 'school_admin', 'admin']
        )


class IsSchoolAdmin(permissions.BasePermission):
    """
    Custom permission to only allow school admins to access.
    """

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role in ['school_admin', 'admin']
        )


class IsStudent(permissions.BasePermission):
    """
    Custom permission to only allow students to access.
    """

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'student'
        )


class IsParent(permissions.BasePermission):
    """
    Custom permission to only allow parents to access.
    """

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated and
            request.user.role == 'parent'
        )
