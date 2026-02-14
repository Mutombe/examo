import axios from 'axios'
import { useAuthStore } from '@/stores/authStore'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api/v1'

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Helper function to get auth token from multiple sources
const getAuthToken = (): string | null => {
  // Try Zustand store first (works after login and when store is hydrated)
  try {
    const storeToken = useAuthStore.getState().accessToken
    if (storeToken) {
      return storeToken
    }
  } catch (e) {
    // Store not ready
  }

  // Fallback: read directly from localStorage
  // This handles cases where:
  // 1. Store hasn't hydrated yet
  // 2. Page refresh scenarios
  // 3. Any timing issues with Zustand persist
  try {
    const stored = localStorage.getItem('auth-storage')
    if (stored) {
      const parsed = JSON.parse(stored)
      // Zustand persist stores data under 'state' key
      return parsed.state?.accessToken || null
    }
  } catch (e) {
    // localStorage error
  }

  return null
}

// Endpoints that should never send an Authorization header — a stale token
// causes the backend to reject the request with 401 before AllowAny runs.
// Includes all AllowAny backend views.
const PUBLIC_ENDPOINTS = [
  '/auth/login/', '/auth/register/', '/auth/google/', '/auth/refresh/', '/auth/password-reset/',
  '/subjects/', '/boards/', '/syllabi/', '/papers/', '/topics/', '/library/',
  '/paper-upload/',
]

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const isPublic = PUBLIC_ENDPOINTS.some((ep) => config.url?.includes(ep))
    if (!isPublic) {
      const token = getAuthToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor to handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    // Skip retry for login/register endpoints to avoid infinite loops
    if (originalRequest.url?.includes('/auth/login') ||
        originalRequest.url?.includes('/auth/register') ||
        originalRequest.url?.includes('/auth/refresh')) {
      return Promise.reject(error)
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true

      // Try to get refresh token from store or localStorage
      let refreshToken = useAuthStore.getState().refreshToken
      if (!refreshToken) {
        try {
          const stored = localStorage.getItem('auth-storage')
          if (stored) {
            const parsed = JSON.parse(stored)
            refreshToken = parsed.state?.refreshToken
          }
        } catch (e) {
          // Ignore localStorage errors
        }
      }

      if (refreshToken) {
        try {
          const response = await axios.post(`${API_BASE_URL}/auth/refresh/`, {
            refresh: refreshToken,
          })

          const { access } = response.data
          useAuthStore.getState().setTokens(access, refreshToken)

          originalRequest.headers.Authorization = `Bearer ${access}`
          return api(originalRequest)
        } catch (refreshError) {
          // Refresh failed - DON'T auto-logout, just reject
          // Let the UI handle showing auth modal if needed
          console.warn('Token refresh failed:', refreshError)
          return Promise.reject(error)
        }
      }

      // No refresh token available - just reject without logout
      // This allows guest users to access public endpoints without issues
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)

// Auth API
export const authApi = {
  register: (data: any) => api.post('/auth/register/', data),
  registerSchoolAdmin: (data: RegisterSchoolAdminData) =>
    api.post('/auth/register/school-admin/', data),
  login: (email: string, password: string) => api.post('/auth/login/', { email, password }),
  googleLogin: (credential: string) => api.post('/auth/google/', { credential }),
  me: () => api.get('/auth/me/'),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh/', { refresh: refreshToken }),
  requestPasswordReset: (email: string) =>
    api.post('/auth/password-reset/', { email }),
  confirmPasswordReset: (uid: number, token: string, password: string, password_confirm: string) =>
    api.post('/auth/password-reset/confirm/', { uid, token, password, password_confirm }),
  changePassword: (current_password: string, new_password: string, new_password_confirm: string) =>
    api.post('/auth/change-password/', { current_password, new_password, new_password_confirm }),
  checkInvitation: (token: string) => api.get(`/auth/invitations/${token}/`),
  acceptInvitation: (token: string, data: AcceptInvitationData) =>
    api.post(`/auth/invitations/${token}/`, data),
}

// Exams API
export const examsApi = {
  getBoards: () => api.get('/boards/'),
  getSubjects: () => api.get('/subjects/'),
  getSyllabi: (params?: SyllabiParams) => api.get('/syllabi/', { params }),
  getPapers: (params?: PapersParams) => api.get('/papers/', { params }),
  getPaper: (id: number) => api.get(`/papers/${id}/`),
  getPaperQuestions: (paperId: number) => api.get(`/papers/${paperId}/questions/`),
}

// Attempts API
export const attemptsApi = {
  getAttempts: () => api.get('/attempts/'),
  getAttempt: (id: number) => api.get(`/attempts/${id}/`),
  createAttempt: (paperId: number) => api.post('/attempts/', { paper: paperId }),
  submitAttempt: (id: number, timeSpent: number) =>
    api.post(`/attempts/${id}/submit/`, { time_spent_seconds: timeSpent }),
  getResults: (id: number) => api.get(`/attempts/${id}/results/`),
  getMarkingProgress: (attemptId: number, after?: string) =>
    api.get(`/attempts/${attemptId}/marking-progress/`, { params: after ? { after } : {} }),
  saveAnswer: (data: SaveAnswerData) => api.post('/answers/', data),
  // Sync guest answers after registration
  syncAnswers: (attemptId: number, data: SyncAnswersData) =>
    api.post(`/attempts/${attemptId}/sync-answers/`, data),
  // Tracking API
  trackActivity: (attemptId: number, data: TrackingData) =>
    api.post(`/attempts/${attemptId}/track/`, data),
}

// Notifications API
export const notificationsApi = {
  getNotifications: (params?: { page?: number }) =>
    api.get('/notifications/', { params }),
  getUnreadCount: () => api.get('/notifications/unread-count/'),
  markRead: (id: number) => api.post(`/notifications/${id}/read/`),
  markAllRead: () => api.post('/notifications/read-all/'),
}

// Teacher/Schools API
export const teacherApi = {
  getProfile: () => api.get('/teacher/profile/'),
  updateProfile: (data: Partial<TeacherProfile>) =>
    api.patch('/teacher/profile/', data),

  // Classes
  getClasses: (params?: { page?: number }) => api.get('/classes/', { params }),
  getClass: (id: number) => api.get(`/classes/${id}/`),
  createClass: (data: CreateClassData) => api.post('/classes/', data),
  updateClass: (id: number, data: Partial<CreateClassData>) =>
    api.patch(`/classes/${id}/`, data),
  deleteClass: (id: number) => api.delete(`/classes/${id}/`),
  getClassStudents: (classId: number) => api.get(`/classes/${classId}/students/`),
  addStudent: (classId: number, studentId: number) =>
    api.post(`/classes/${classId}/students/add/`, { student_id: studentId }),
  removeStudent: (classId: number, studentId: number) =>
    api.delete(`/classes/${classId}/students/${studentId}/remove/`),
  regenerateCode: (classId: number) =>
    api.post(`/classes/${classId}/regenerate-code/`),
  getClassAnalytics: (classId: number) =>
    api.get(`/classes/${classId}/analytics/`),

  // Assignments
  getAssignments: (params?: { page?: number }) => api.get('/assignments/', { params }),
  getAssignment: (id: number) => api.get(`/assignments/${id}/`),
  createAssignment: (data: CreateAssignmentData) =>
    api.post('/assignments/', data),
  updateAssignment: (id: number, data: Partial<CreateAssignmentData>) =>
    api.patch(`/assignments/${id}/`, data),
  deleteAssignment: (id: number) => api.delete(`/assignments/${id}/`),
  publishAssignment: (id: number) => api.post(`/assignments/${id}/publish/`),
  getSubmissions: (assignmentId: number) =>
    api.get(`/assignments/${assignmentId}/submissions/`),
  addFeedback: (submissionId: number, feedback: string) =>
    api.patch(`/submissions/${submissionId}/feedback/`, { teacher_feedback: feedback }),
}

// Student - Class/Assignment APIs
export const studentApi = {
  joinClass: (joinCode: string) => api.post('/classes/join/', { join_code: joinCode }),
  getAssignments: (params?: { page?: number }) => api.get('/student/assignments/', { params }),
  getAssignment: (id: number) => api.get(`/student/assignments/${id}/`),
}

// Progress API
export const progressApi = {
  // Overall
  getOverall: () => api.get('/progress/'),
  getWeakTopics: () => api.get('/progress/weak-topics/'),
  getRecommended: () => api.get('/progress/recommended/'),

  // Topics
  getTopicProgress: () => api.get('/progress/topics/'),
  getTopicProgressBySubject: () => api.get('/progress/topics/by-subject/'),
  getTopicDetail: (id: number) => api.get(`/progress/topics/${id}/`),

  // Study Sessions
  getSessions: (days?: number) =>
    api.get('/progress/sessions/', { params: { days } }),
  getStreak: () => api.get('/progress/streak/'),
  logTime: (timeSeconds: number) =>
    api.post('/progress/log-time/', { time_seconds: timeSeconds }),

  // Bookmarks
  getBookmarks: (params?: { folder?: string; type?: string; page?: number }) =>
    api.get('/bookmarks/', { params }),
  createBookmark: (data: CreateBookmarkData) => api.post('/bookmarks/', data),
  updateBookmark: (id: number, data: UpdateBookmarkData) =>
    api.patch(`/bookmarks/${id}/`, data),
  deleteBookmark: (id: number) => api.delete(`/bookmarks/${id}/`),
  toggleBookmark: (questionId: number, data?: CreateBookmarkData) =>
    api.post(`/bookmarks/question/${questionId}/`, data || {}),
  checkBookmark: (questionId: number) =>
    api.get(`/bookmarks/question/${questionId}/`),
  togglePaperBookmark: (paperId: number) =>
    api.post(`/bookmarks/paper/${paperId}/`),
  checkPaperBookmark: (paperId: number) =>
    api.get(`/bookmarks/paper/${paperId}/`),
  toggleResourceBookmark: (resourceId: number) =>
    api.post(`/bookmarks/resource/${resourceId}/`),
  checkResourceBookmark: (resourceId: number) =>
    api.get(`/bookmarks/resource/${resourceId}/`),
}

// Types
export interface RegisterData {
  email: string
  username: string
  password: string
  password_confirm: string
  first_name?: string
  last_name?: string
  school?: string
  grade_level?: string
}

export interface LoginData {
  email: string
  password: string
}

export interface SyllabiParams {
  board?: number
  subject?: number
  level?: string
}

export interface PapersParams {
  syllabus?: number
  board?: number
  subject?: number
  level?: string
  year?: number
  session?: string
  search?: string
  page?: number
}

export interface SaveAnswerData {
  attempt: number
  question: number
  answer_text?: string
  selected_option?: string
}

export interface SyncAnswersData {
  answers: { question_id: number; answer_text: string; selected_option: string }[]
  time_spent_seconds: number
  question_times: Record<string, number>
}

// Tracking data for attempt activity
export type TrackingAction = 'view_question' | 'view_pdf' | 'pause' | 'resume' | 'update_time'

export interface TrackingData {
  action: TrackingAction
  // For view_question
  question_id?: number
  question_index?: number
  time_on_previous_seconds?: number
  previous_question_id?: number
  // For view_pdf
  page_number?: number
  // For update_time
  time_spent_seconds?: number
}

// Response types
export interface User {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  role: string
  school_name: string
  current_form: number | null
  date_of_birth: string | null
  created_at: string
  updated_at: string
}

export interface Board {
  id: number
  name: string
  short_name: string
  description: string
  country: string
  logo: string | null
}

export interface Subject {
  id: number
  name: string
  code: string
  description: string
  icon: string
  color: string
}

export interface Syllabus {
  id: number
  board_name: string
  subject_name: string
  level: string
  level_display: string
  syllabus_code: string
}

export interface Paper {
  id: number
  title: string
  syllabus: Syllabus
  paper_type: string
  paper_type_display: string
  year: number
  session: string
  session_display: string
  duration_minutes: number
  total_marks: number
  question_count: number
}

export interface Question {
  id: number
  question_number: string
  question_text: string
  question_type: string
  type_display: string
  marks: number
  options: { key: string; text: string }[] | null
  topic: string
  topic_text?: string
  difficulty: string
  image: string | null
  order?: number
  // Source reference fields
  source_page?: number | null
  source_position?: 'top' | 'upper' | 'middle' | 'lower' | 'bottom' | ''
  has_diagram?: boolean
  diagram_description?: string
}

export interface Answer {
  id: number
  question: Question
  answer_text: string
  selected_option: string
  is_correct: boolean | null
  score: number | null
  feedback: string
  ai_marked: boolean
  confidence_score: number | null
  confidence_level: 'high' | 'medium' | 'low' | ''
}

export interface Attempt {
  id: number
  paper: Paper
  status: 'in_progress' | 'submitted' | 'marked'
  started_at: string
  submitted_at: string | null
  marked_at: string | null
  total_score: number | null
  percentage: number | null
  time_spent_seconds: number
  answers: Answer[]
}

// Teacher types
export interface TeacherProfile {
  id: number
  user: number
  user_email: string
  user_name: string
  school: number
  school_name: string
  employee_id: string
  department: string
  role: string
  role_display: string
  subjects: Subject[]
  can_create_assignments: boolean
  can_view_school_analytics: boolean
  is_active: boolean
}

export interface Class {
  id: number
  name: string
  subject: number
  subject_name: string
  form_level: number
  academic_year: number
  term: number
  teacher_name: string
  student_count: number
  join_code: string
  allow_join: boolean
  is_active: boolean
}

export interface ClassDetail extends Class {
  students: StudentInfo[]
  max_students: number
  created_at: string
}

export interface StudentInfo {
  id: number
  email: string
  username: string
  first_name: string
  last_name: string
  display_name: string
  current_form: number
  total_questions_attempted: number
  current_streak_days: number
}

export interface Assignment {
  id: number
  title: string
  description: string
  assignment_type: string
  type_display: string
  teacher_name: string
  total_marks: number
  time_limit_minutes: number
  available_from: string
  due_date: string
  is_published: boolean
  is_mandatory: boolean
  class_count: number
  submission_count: number
  created_at: string
}

export interface AssignmentSubmission {
  id: number
  student: StudentInfo
  status: string
  status_display: string
  attempt_number: number
  started_at: string | null
  submitted_at: string | null
  marks_earned: number | null
  marks_possible: number | null
  percentage_score: number | null
  teacher_feedback: string
}

export interface CreateClassData {
  name: string
  subject: number
  form_level: number
  academic_year: number
  term: number
  max_students?: number
}

export interface CreateAssignmentData {
  title: string
  description: string
  assignment_type: string
  class_ids: number[]
  paper_ids?: number[]
  topic_ids?: number[]
  question_ids?: number[]
  total_marks: number
  time_limit_minutes?: number
  attempts_allowed?: number
  available_from: string
  due_date: string
  is_mandatory?: boolean
}

export interface CreateParentAssignmentData {
  title: string
  description?: string
  assignment_type?: string
  child_ids: number[]
  paper_ids?: number[]
  resource_ids?: number[]
  available_from: string
  due_date: string
}

// Progress types
export interface TopicProgress {
  id: number
  topic: Topic
  questions_attempted: number
  questions_correct: number
  total_marks_earned: number
  total_marks_possible: number
  mastery_level: string
  mastery_level_display: string
  mastery_score: number
  accuracy: number
  last_practiced_at: string | null
}

export interface Topic {
  id: number
  name: string
  syllabus_name: string
}

export interface StudySession {
  id: number
  date: string
  time_spent_seconds: number
  time_spent_formatted: string
  questions_attempted: number
  questions_correct: number
  marks_earned: number
  marks_possible: number
  accuracy: number
  streak_maintained: boolean
}

export interface StudyStreak {
  current_streak: number
  longest_streak: number
  total_study_days: number
  total_questions: number
  total_time_seconds: number
  recent_sessions: StudySession[]
}

export interface Bookmark {
  id: number
  bookmark_type: 'question' | 'paper' | 'resource'
  question: Question | null
  paper: {
    id: number
    title: string
    year: number
    session_display: string
    subject_name: string
    level_display: string
  } | null
  resource: {
    id: number
    title: string
    slug: string
    resource_type: string
    type_display: string
  } | null
  note: string
  folder: string
  folder_display: string
  created_at: string
}

export interface CreateBookmarkData {
  bookmark_type?: 'question' | 'paper' | 'resource'
  question?: number
  paper?: number
  resource?: number
  note?: string
  folder?: string
}

export interface UpdateBookmarkData {
  note?: string
  folder?: string
}

export interface OverallProgress {
  total_questions_attempted: number
  total_questions_correct: number
  total_marks_earned: number
  total_marks_possible: number
  overall_accuracy: number
  overall_score: number
  topics_started: number
  topics_mastered: number
  current_streak_days: number
  total_study_time_seconds: number
  subjects_studied: SubjectProgress[]
}

export interface SubjectProgress {
  name: string
  topics_count: number
  average_mastery: number
}

export interface ClassAnalytics {
  class: Class
  stats: {
    total_students: number
    active_students: number
    avg_questions_attempted: number
    avg_score_percentage: number
    avg_streak_days: number
    total_assignments: number
    completed_submissions: number
  }
}

// Admin API
export const adminApi = {
  getStats: () => api.get('/admin/stats/'),
  getPendingPapers: () => api.get('/admin/papers/pending/'),
  getPapers: (params?: { status?: string; page?: number }) => api.get('/admin/papers/', { params }),
  approvePaper: (paperId: number) => api.post(`/admin/papers/${paperId}/approve/`),
  rejectPaper: (paperId: number, reason: string) =>
    api.post(`/admin/papers/${paperId}/reject/`, { reason }),
  processPaperWithAI: (paperId: number) =>
    api.post(`/admin/papers/${paperId}/process/`),
  getUsers: (params?: { page?: number }) => api.get('/admin/users/', { params }),
  updateUserRole: (userId: number, role: string) =>
    api.patch(`/admin/users/${userId}/`, { role }),
}

// Papers Upload API
export const papersApi = {
  uploadPaper: (formData: FormData) =>
    api.post('/papers/upload/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  getPaperStatus: (paperId: number) => api.get(`/papers/${paperId}/status/`),
}

// Parent Portal API
export const parentApi = {
  getChildren: () => api.get('/parent/children/'),
  linkChild: (childEmail: string) =>
    api.post('/parent/children/', { email: childEmail }),
  unlinkChild: (childId: number) =>
    api.delete(`/parent/children/${childId}/`),
  getChildProgress: (childId: number) =>
    api.get(`/parent/children/${childId}/progress/`),
  getChildActivity: (childId: number) =>
    api.get(`/parent/children/${childId}/activity/`),
  getAssignments: () => api.get('/parent/assignments/'),
  createAssignment: (data: CreateParentAssignmentData) =>
    api.post('/parent/assignments/', data),
  deleteAssignment: (id: number) => api.delete(`/parent/assignments/${id}/`),
}

// School Admin API
export const schoolApi = {
  getStats: () => api.get('/school/stats/'),
  getTeachers: () => api.get('/school/teachers/'),
  addTeacher: (data: { email: string; department?: string }) =>
    api.post('/school/teachers/', data),
  removeTeacher: (teacherId: number) =>
    api.delete(`/school/teachers/${teacherId}/`),
  getClasses: () => api.get('/school/classes/'),
  getPerformance: () => api.get('/school/performance/'),
  getSettings: () => api.get('/school/settings/'),
  updateSettings: (data: any) => api.patch('/school/settings/', data),
  // Invitations
  getInvitations: () => api.get('/school/invitations/'),
  inviteTeacher: (data: InviteTeacherData) =>
    api.post('/school/invitations/', data),
  cancelInvitation: (id: number) => api.delete(`/school/invitations/${id}/`),
}

// Library API
export const libraryApi = {
  getCategories: () => api.get('/library/categories/'),
  getResources: (params?: LibraryParams) => api.get('/library/', { params }),
  getFeatured: () => api.get('/library/featured/'),
  getResource: (slug: string) => api.get(`/library/${slug}/`),
  shareResource: (slug: string) => api.post(`/library/${slug}/share/`),
  getProgress: (resourceId: number) => api.get(`/library/resource/${resourceId}/progress/`),
  updateProgress: (resourceId: number, data: { current_page: number; time_spent_seconds?: number }) =>
    api.post(`/library/resource/${resourceId}/progress/`, data),
  rateResource: (resourceId: number, rating: number) =>
    api.post(`/library/resource/${resourceId}/rate/`, { rating }),
  getHighlights: (resourceId: number) =>
    api.get(`/library/resource/${resourceId}/highlights/`),
  addHighlight: (resourceId: number, data: { page_number: number; note?: string; color?: string }) =>
    api.post(`/library/resource/${resourceId}/highlights/`, data),
  deleteHighlight: (highlightId: number) =>
    api.delete(`/library/highlights/${highlightId}/`),
  getMyReadingList: () => api.get('/library/my-reading-list/'),
}

// Library types
export interface LibraryParams {
  category?: string
  subject?: number
  level?: string
  type?: string
  featured?: boolean
  search?: string
  page?: number
}

export interface LibraryResource {
  id: number
  title: string
  slug: string
  description: string
  resource_type: string
  type_display: string
  category_name: string
  subject_name: string
  level: string
  level_display: string
  page_count: number
  file_size_display: string
  cover_image: string | null
  cover_color: string
  view_count: number
  share_count: number
  avg_rating: number
  total_ratings: number
  tags: string[]
  is_featured: boolean
  reading_progress: {
    current_page: number
    progress_percent: number
    is_completed: boolean
    last_read_at: string
  } | null
  created_at: string
  file_url?: string
  user_rating?: number | null
  highlights?: any[]
}

export interface LibraryCategory {
  id: number
  name: string
  slug: string
  description: string
  icon: string
  color: string
  resource_count: number
}

// School Admin Registration
export interface RegisterSchoolAdminData {
  email: string
  first_name: string
  last_name: string
  password: string
  password_confirm: string
  phone_number?: string
  school_name: string
  school_type: 'government' | 'private' | 'mission' | 'trust'
  province: string
  city: string
  school_email?: string
  school_phone?: string
}

// Teacher Invitation
export interface InviteTeacherData {
  email: string
  role?: string
  department?: string
}

export interface TeacherInvitation {
  id: number
  school: number
  school_name: string
  invited_by: number
  invited_by_name: string
  email: string
  role: string
  department: string
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  expires_at: string
  created_at: string
}

// Accept Invitation
export interface AcceptInvitationData {
  first_name?: string
  last_name?: string
  password?: string
}

export interface InvitationInfo {
  email: string
  school_name: string
  role: string
  department: string
}

// Marking Progress types
export interface MarkingMessage {
  timestamp: string
  type: 'info' | 'progress' | 'result' | 'fun' | 'error' | 'complete'
  text: string
}

export interface MarkingProgressData {
  status: 'queued' | 'marking' | 'calculating' | 'completed' | 'failed'
  total_questions: number
  questions_marked: number
  current_question_number: string
  current_question_text: string
  messages: MarkingMessage[]
  started_at: string | null
  completed_at: string | null
  error_message: string
  percentage: number | null
  total_score: number | null
}

export interface SubmitAttemptResponse {
  attempt_id: number
  paper_id: number
  status: string
  total_questions: number
}

// Notification types
export interface NotificationData {
  id: number
  notification_type: string
  title: string
  message: string
  link: string
  is_read: boolean
  created_at: string
  metadata: Record<string, any>
}
