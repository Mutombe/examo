import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { Layout } from '@/components/layout/Layout'
import { PublicLayout } from '@/components/layout/PublicLayout'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LandingPage } from '@/features/landing/LandingPage'
import { SubjectsPage } from '@/features/papers/SubjectsPage'
import { PapersPage } from '@/features/papers/PapersPage'
import { PaperDetailPage } from '@/features/papers/PaperDetailPage'
import { AttemptPage } from '@/features/attempts/AttemptPage'
import { ResultsPage } from '@/features/attempts/ResultsPage'
// Auth pages
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage'
import { ResetPasswordPage } from '@/features/auth/ResetPasswordPage'
import { SchoolAdminRegisterPage } from '@/features/auth/SchoolAdminRegisterPage'
import { AcceptInvitationPage } from '@/features/auth/AcceptInvitationPage'
// Admin pages
import { AdminDashboard } from '@/features/admin/AdminDashboard'
import { AdminPapersPage } from '@/features/admin/AdminPapersPage'
import { AdminUsersPage } from '@/features/admin/AdminUsersPage'
// Teacher pages
import { TeacherDashboard } from '@/features/teacher/TeacherDashboard'
import { ClassesPage } from '@/features/teacher/ClassesPage'
import { ClassDetailPage } from '@/features/teacher/ClassDetailPage'
// CreateClassPage removed - now uses modal in ClassesPage
import { AssignmentsPage } from '@/features/teacher/AssignmentsPage'
import { AssignmentDetailPage } from '@/features/teacher/AssignmentDetailPage'
// CreateAssignmentPage removed - now uses modal in AssignmentsPage
// School pages
import { SchoolDashboard } from '@/features/school/SchoolDashboard'
// Parent pages
import { ParentDashboard } from '@/features/parent/ParentDashboard'
// Student pages
import { StudentAssignmentsPage } from '@/features/student/StudentAssignmentsPage'
import { JoinClassPage } from '@/features/student/JoinClassPage'
// Progress pages
import { ProgressPage } from '@/features/progress/ProgressPage'
import { BookmarksPage } from '@/features/progress/BookmarksPage'
// Profile page
import { ProfilePage } from '@/features/profile/ProfilePage'
// Marking pages
import { MarkingProgressPage } from '@/features/marking/MarkingProgressPage'
// Notification pages
import { NotificationsPage } from '@/features/notifications/NotificationsPage'
// Library pages
import { LibraryPage } from '@/features/library/LibraryPage'
import { ResourceReaderPage } from '@/features/library/ResourceReaderPage'
// Legal pages
import { PrivacyPolicyPage } from '@/features/legal/PrivacyPolicyPage'
import { TermsOfServicePage } from '@/features/legal/TermsOfServicePage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function TeacherRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user?.role !== 'teacher' && user?.role !== 'school_admin' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function SchoolAdminRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user?.role !== 'school_admin' && user?.role !== 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

function ParentRoute({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return <Navigate to="/" replace />
  }

  if (user?.role !== 'parent') {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

// Component to redirect to appropriate dashboard based on role
function DashboardRedirect() {
  const user = useAuthStore((state) => state.user)

  switch (user?.role) {
    case 'admin':
      return <Navigate to="/admin" replace />
    case 'school_admin':
      return <Navigate to="/school" replace />
    case 'teacher':
      return <Navigate to="/teacher" replace />
    case 'parent':
      return <Navigate to="/parent" replace />
    default:
      return <DashboardPage />
  }
}

export function AppRouter() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  return (
    <Routes>
      {/* Landing & static pages - always PublicLayout (auth-aware) */}
      <Route element={<PublicLayout />}>
        <Route index element={<LandingPage />} />
        <Route path="privacy" element={<PrivacyPolicyPage />} />
        <Route path="terms" element={<TermsOfServicePage />} />
      </Route>

      {/* App routes - conditional layout based on auth */}
      <Route element={isAuthenticated ? <Layout /> : <PublicLayout />}>
        {/* These routes work for both guests and authenticated users */}
        <Route path="subjects" element={<SubjectsPage />} />
        <Route path="papers" element={<PapersPage />} />
        <Route path="papers/:id" element={<PaperDetailPage />} />
        <Route path="papers/:id/attempt" element={<AttemptPage />} />
        <Route path="papers/:paperId/results/:attemptId" element={<ResultsPage />} />
        <Route
          path="papers/:paperId/marking/:attemptId"
          element={
            <ProtectedRoute>
              <MarkingProgressPage />
            </ProtectedRoute>
          }
        />

        {/* Library - accessible to everyone */}
        <Route path="library" element={<LibraryPage />} />
        <Route path="library/:slug" element={<ResourceReaderPage />} />

        {/* Bookmarks - accessible to everyone */}
        <Route path="bookmarks" element={<BookmarksPage />} />

        {/* Student Dashboard - default for students */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute>
              <DashboardRedirect />
            </ProtectedRoute>
          }
        />

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminDashboard />
            </AdminRoute>
          }
        />
        <Route
          path="admin/papers"
          element={
            <AdminRoute>
              <AdminPapersPage />
            </AdminRoute>
          }
        />
        <Route
          path="admin/users"
          element={
            <AdminRoute>
              <AdminUsersPage />
            </AdminRoute>
          }
        />

        {/* School Admin routes */}
        <Route
          path="school"
          element={
            <SchoolAdminRoute>
              <SchoolDashboard />
            </SchoolAdminRoute>
          }
        />

        {/* Parent routes */}
        <Route
          path="parent"
          element={
            <ParentRoute>
              <ParentDashboard />
            </ParentRoute>
          }
        />

        {/* Progress routes - authenticated only */}
        <Route
          path="progress"
          element={
            <ProtectedRoute>
              <ProgressPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Notifications */}
        <Route
          path="notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Student routes - authenticated only */}
        <Route
          path="assignments"
          element={
            <ProtectedRoute>
              <StudentAssignmentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="join-class"
          element={
            <ProtectedRoute>
              <JoinClassPage />
            </ProtectedRoute>
          }
        />

        {/* Teacher routes */}
        <Route
          path="teacher"
          element={
            <TeacherRoute>
              <TeacherDashboard />
            </TeacherRoute>
          }
        />
        <Route
          path="teacher/classes"
          element={
            <TeacherRoute>
              <ClassesPage />
            </TeacherRoute>
          }
        />
        <Route
          path="teacher/classes/:id"
          element={
            <TeacherRoute>
              <ClassDetailPage />
            </TeacherRoute>
          }
        />
        <Route
          path="teacher/assignments"
          element={
            <TeacherRoute>
              <AssignmentsPage />
            </TeacherRoute>
          }
        />
        <Route
          path="teacher/assignments/:id"
          element={
            <TeacherRoute>
              <AssignmentDetailPage />
            </TeacherRoute>
          }
        />
      </Route>

      {/* Standalone auth pages (no layout) */}
      <Route path="forgot-password" element={<ForgotPasswordPage />} />
      <Route path="reset-password" element={<ResetPasswordPage />} />
      <Route path="register/school" element={<SchoolAdminRegisterPage />} />
      <Route path="accept-invite/:token" element={<AcceptInvitationPage />} />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
