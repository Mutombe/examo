import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  Users,
  GraduationCap,
  BookOpen,
  BarChart3,
  Settings,
  Plus,
  ChevronRight,
  Calendar,
  Mail,
  Clock,
  CheckCircle,
  Loader2,
  Save,
} from 'lucide-react'
import { Card, Button, Badge, Input } from '@/components/ui'
import { schoolApi, type TeacherInvitation } from '@/lib/api'
import { cn } from '@/lib/utils'
import { InviteTeacherModal } from './InviteTeacherModal'

type TabType = 'overview' | 'teachers' | 'students' | 'classes' | 'analytics' | 'invitations' | 'settings'

// Helper to extract array from API response (handles both paginated and non-paginated)
const getDataArray = (response: any): any[] => {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.data.results)) return response.data.results
  return []
}

export function SchoolDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [showInviteModal, setShowInviteModal] = useState(false)
  const queryClient = useQueryClient()

  // Fetch school stats
  const { data: stats } = useQuery({
    queryKey: ['school', 'stats'],
    queryFn: () => schoolApi.getStats(),
  })

  // Fetch teachers
  const { data: teachers } = useQuery({
    queryKey: ['school', 'teachers'],
    queryFn: () => schoolApi.getTeachers(),
    enabled: activeTab === 'teachers' || activeTab === 'overview',
  })

  // Fetch classes
  const { data: classes } = useQuery({
    queryKey: ['school', 'classes'],
    queryFn: () => schoolApi.getClasses(),
    enabled: activeTab === 'classes' || activeTab === 'overview',
  })

  // Fetch performance data
  const { data: performance } = useQuery({
    queryKey: ['school', 'performance'],
    queryFn: () => schoolApi.getPerformance(),
    enabled: activeTab === 'analytics' || activeTab === 'overview',
  })

  // Fetch invitations
  const { data: invitations } = useQuery({
    queryKey: ['school', 'invitations'],
    queryFn: () => schoolApi.getInvitations(),
    enabled: activeTab === 'invitations',
  })

  // Fetch school settings
  const { data: settings } = useQuery({
    queryKey: ['school', 'settings'],
    queryFn: () => schoolApi.getSettings(),
    enabled: activeTab === 'settings',
  })

  // Cancel invitation
  const cancelInvitationMutation = useMutation({
    mutationFn: (id: number) => schoolApi.cancelInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', 'invitations'] })
    },
  })

  // Remove teacher
  const removeTeacherMutation = useMutation({
    mutationFn: (id: number) => schoolApi.removeTeacher(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['school', 'teachers'] })
      queryClient.invalidateQueries({ queryKey: ['school', 'stats'] })
    },
  })

  const statsData = stats?.data || {
    total_teachers: 0,
    total_students: 0,
    total_classes: 0,
    active_assignments: 0,
    average_score: 0,
    completion_rate: 0,
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building2 },
    { id: 'teachers', label: 'Teachers', icon: GraduationCap },
    { id: 'invitations', label: 'Invitations', icon: Mail },
    { id: 'students', label: 'Students', icon: Users },
    { id: 'classes', label: 'Classes', icon: BookOpen },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">School Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage your school's exam preparation platform</p>
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Invite Teacher
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex gap-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Teachers</p>
                  <p className="text-3xl font-bold mt-1">{statsData.total_teachers}</p>
                </div>
                <GraduationCap className="h-10 w-10 text-blue-200" />
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Students</p>
                  <p className="text-3xl font-bold mt-1">{statsData.total_students}</p>
                </div>
                <Users className="h-10 w-10 text-green-200" />
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Active Classes</p>
                  <p className="text-3xl font-bold mt-1">{statsData.total_classes}</p>
                </div>
                <BookOpen className="h-10 w-10 text-purple-200" />
              </div>
            </Card>
          </div>

          {/* Performance Overview */}
          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Performance Summary</h2>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Average Score</span>
                    <span className="text-sm font-medium">{statsData.average_score}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-blue-500 rounded-full"
                      style={{ width: `${statsData.average_score}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-600">Assignment Completion</span>
                    <span className="text-sm font-medium">{statsData.completion_rate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-2 bg-green-500 rounded-full"
                      style={{ width: `${statsData.completion_rate}%` }}
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Top Performing Subjects</h2>
              </div>
              <div className="space-y-3">
                {performance?.data?.top_subjects?.map((subject: any, i: number) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center text-white font-medium text-sm',
                        i === 0 ? 'bg-yellow-500' :
                        i === 1 ? 'bg-gray-400' :
                        i === 2 ? 'bg-orange-600' : 'bg-gray-300'
                      )}>
                        {i + 1}
                      </div>
                      <span className="font-medium text-gray-900">{subject.name}</span>
                    </div>
                    <Badge variant={subject.score >= 70 ? 'success' : 'warning'}>
                      {subject.score}%
                    </Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Classes</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab('classes')}>
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            <div className="space-y-3">
              {getDataArray(classes).slice(0, 5).map((cls: any) => (
                <div
                  key={cls.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                      <BookOpen className="h-5 w-5 text-primary-600" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{cls.name}</p>
                      <p className="text-sm text-gray-500">
                        {cls.subject_name} - {cls.teacher_name}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">{cls.student_count} students</p>
                    <p className="text-xs text-gray-500">{cls.assignments_count} assignments</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Teachers Tab */}
      {activeTab === 'teachers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowInviteModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Invite Teacher
            </Button>
          </div>
          <Card>
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Teacher</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Department</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Classes</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {getDataArray(teachers).map((teacher: any) => (
                  <tr key={teacher.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-primary-600">
                            {teacher.first_name?.[0]}{teacher.last_name?.[0]}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">
                            {teacher.first_name} {teacher.last_name}
                          </p>
                          <p className="text-sm text-gray-500">{teacher.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{teacher.department || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={teacher.role === 'head' ? 'info' : 'secondary'}>
                        {teacher.role_display || teacher.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600">{teacher.classes_count}</td>
                    <td className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => {
                          if (confirm('Remove this teacher from the school?')) {
                            removeTeacherMutation.mutate(teacher.id)
                          }
                        }}
                      >
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
                {getDataArray(teachers).length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-gray-500">
                      No teachers yet. Invite your first teacher to get started.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Invitations Tab */}
      {activeTab === 'invitations' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setShowInviteModal(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Send Invitation
            </Button>
          </div>
          <Card>
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Email</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Department</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Sent</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {getDataArray(invitations).map((inv: TeacherInvitation) => (
                  <tr key={inv.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-gray-400" />
                        <span className="text-sm text-gray-900">{inv.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 capitalize">{inv.role}</td>
                    <td className="py-3 px-4 text-sm text-gray-600">{inv.department || '-'}</td>
                    <td className="py-3 px-4">
                      <Badge variant={
                        inv.status === 'accepted' ? 'success' :
                        inv.status === 'pending' ? 'warning' :
                        'secondary'
                      }>
                        {inv.status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                        {inv.status === 'accepted' && <CheckCircle className="h-3 w-3 mr-1" />}
                        {inv.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {inv.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => cancelInvitationMutation.mutate(inv.id)}
                          disabled={cancelInvitationMutation.isPending}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {getDataArray(invitations).length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No invitations sent yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Card>
        </div>
      )}

      {/* Students Tab */}
      {activeTab === 'students' && (
        <Card className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">Student Management</h3>
          <p className="text-gray-500 mt-1">
            View and manage all students enrolled in your school's classes.
          </p>
          <Button className="mt-4">View All Students</Button>
        </Card>
      )}

      {/* Classes Tab */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Class
            </Button>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {getDataArray(classes).map((cls: any) => (
              <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="h-5 w-5 text-primary-600" />
                  </div>
                  <Badge variant="success">Active</Badge>
                </div>
                <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                <p className="text-sm text-gray-500 mb-3">{cls.subject_name}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">{cls.student_count} students</span>
                  <span className="text-gray-500">{cls.teacher_name}</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Analytics</h2>
            <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-2" />
                <p className="text-gray-500">Charts and analytics will be displayed here</p>
              </div>
            </div>
          </Card>

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Subject Performance Comparison</h3>
              <div className="space-y-3">
                {performance?.data?.subjects?.map((subject: any) => (
                  <div key={subject.name}>
                    <div className="flex justify-between mb-1">
                      <span className="text-sm text-gray-600">{subject.name}</span>
                      <span className="text-sm font-medium">{subject.average}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          subject.average >= 70 ? 'bg-green-500' :
                          subject.average >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${subject.average}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-4">Monthly Activity</h3>
              <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                <Calendar className="h-8 w-8 text-gray-400" />
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <SchoolSettingsTab settings={settings?.data} />
      )}

      {/* Invite Teacher Modal */}
      <InviteTeacherModal
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />
    </div>
  )
}

function SchoolSettingsTab({ settings }: { settings: any }) {
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    name: settings?.name || '',
    school_type: settings?.school_type || 'government',
    province: settings?.province || '',
    city: settings?.city || '',
    address: settings?.address || '',
    email: settings?.email || '',
    phone: settings?.phone || '',
    website: settings?.website || '',
    primary_color: settings?.primary_color || '#2563eb',
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      await schoolApi.updateSettings(formData)
      queryClient.invalidateQueries({ queryKey: ['school', 'settings'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      // Handle error
    } finally {
      setSaving(false)
    }
  }

  const PROVINCES = [
    'Bulawayo', 'Harare', 'Manicaland', 'Mashonaland Central',
    'Mashonaland East', 'Mashonaland West', 'Masvingo', 'Matabeleland North',
    'Matabeleland South', 'Midlands',
  ]

  return (
    <div className="max-w-2xl space-y-6">
      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">School Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Type</label>
              <select
                className="input w-full"
                value={formData.school_type}
                onChange={(e) => setFormData({ ...formData, school_type: e.target.value })}
              >
                <option value="government">Government</option>
                <option value="private">Private</option>
                <option value="mission">Mission</option>
                <option value="trust">Trust</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
              <select
                className="input w-full"
                value={formData.province}
                onChange={(e) => setFormData({ ...formData, province: e.target.value })}
              >
                <option value="">Select province</option>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City/Town</label>
              <Input
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
              <Input
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Email</label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Website</label>
            <Input
              type="url"
              placeholder="https://school.ac.zw"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
            />
          </div>
        </div>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : saved ? (
            <><CheckCircle className="h-4 w-4 mr-2 text-green-500" /> Saved</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Changes</>
          )}
        </Button>
      </div>
    </div>
  )
}
