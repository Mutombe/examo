"""
URL patterns for the schools app.
"""

from django.urls import path

from .views import (
    # Teacher Profile
    TeacherProfileView,
    # Classes
    ClassListCreateView,
    ClassDetailView,
    ClassStudentsView,
    ClassAddStudentView,
    ClassRemoveStudentView,
    ClassRegenerateCodeView,
    ClassAnalyticsView,
    JoinClassView,
    # Assignments
    AssignmentListCreateView,
    AssignmentDetailView,
    AssignmentPublishView,
    AssignmentSubmissionsView,
    SubmissionFeedbackView,
    # Student Views
    StudentAssignmentsView,
    StudentAssignmentDetailView,
    # School Admin Views
    SchoolStatsView,
    SchoolTeachersView,
    SchoolTeacherDeleteView,
    SchoolClassesView,
    SchoolPerformanceView,
    SchoolInvitationsView,
    SchoolInvitationCancelView,
    SchoolSettingsView,
)

from .parent_views import (
    ParentChildrenView,
    ParentChildDeleteView,
    ParentChildProgressView,
    ParentChildActivityView,
    ParentAssignmentListCreateView,
    ParentAssignmentDetailView,
)

app_name = 'schools'

urlpatterns = [
    # Teacher Profile
    path('teacher/profile/', TeacherProfileView.as_view(), name='teacher-profile'),

    # Classes - Teacher
    path('classes/', ClassListCreateView.as_view(), name='class-list-create'),
    path('classes/<int:pk>/', ClassDetailView.as_view(), name='class-detail'),
    path('classes/<int:class_id>/students/', ClassStudentsView.as_view(), name='class-students'),
    path('classes/<int:class_id>/students/add/', ClassAddStudentView.as_view(), name='class-add-student'),
    path('classes/<int:class_id>/students/<int:student_id>/remove/', ClassRemoveStudentView.as_view(), name='class-remove-student'),
    path('classes/<int:class_id>/regenerate-code/', ClassRegenerateCodeView.as_view(), name='class-regenerate-code'),
    path('classes/<int:class_id>/analytics/', ClassAnalyticsView.as_view(), name='class-analytics'),

    # Classes - Student
    path('classes/join/', JoinClassView.as_view(), name='class-join'),

    # Assignments - Teacher
    path('assignments/', AssignmentListCreateView.as_view(), name='assignment-list-create'),
    path('assignments/<int:pk>/', AssignmentDetailView.as_view(), name='assignment-detail'),
    path('assignments/<int:pk>/publish/', AssignmentPublishView.as_view(), name='assignment-publish'),
    path('assignments/<int:assignment_id>/submissions/', AssignmentSubmissionsView.as_view(), name='assignment-submissions'),
    path('submissions/<int:submission_id>/feedback/', SubmissionFeedbackView.as_view(), name='submission-feedback'),

    # Assignments - Student
    path('student/assignments/', StudentAssignmentsView.as_view(), name='student-assignments'),
    path('student/assignments/<int:pk>/', StudentAssignmentDetailView.as_view(), name='student-assignment-detail'),

    # School Admin
    path('school/stats/', SchoolStatsView.as_view(), name='school-stats'),
    path('school/teachers/', SchoolTeachersView.as_view(), name='school-teachers'),
    path('school/teachers/<int:pk>/', SchoolTeacherDeleteView.as_view(), name='school-teacher-delete'),
    path('school/classes/', SchoolClassesView.as_view(), name='school-classes'),
    path('school/performance/', SchoolPerformanceView.as_view(), name='school-performance'),
    path('school/invitations/', SchoolInvitationsView.as_view(), name='school-invitations'),
    path('school/invitations/<int:pk>/', SchoolInvitationCancelView.as_view(), name='school-invitation-cancel'),
    path('school/settings/', SchoolSettingsView.as_view(), name='school-settings'),

    # Parent
    path('parent/children/', ParentChildrenView.as_view(), name='parent-children'),
    path('parent/children/<int:pk>/', ParentChildDeleteView.as_view(), name='parent-child-delete'),
    path('parent/children/<int:pk>/progress/', ParentChildProgressView.as_view(), name='parent-child-progress'),
    path('parent/children/<int:pk>/activity/', ParentChildActivityView.as_view(), name='parent-child-activity'),

    # Parent Assignments
    path('parent/assignments/', ParentAssignmentListCreateView.as_view(), name='parent-assignments'),
    path('parent/assignments/<int:pk>/', ParentAssignmentDetailView.as_view(), name='parent-assignment-detail'),
]
