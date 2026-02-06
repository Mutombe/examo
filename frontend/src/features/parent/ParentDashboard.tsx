import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Users,
  TrendingUp,
  BookOpen,
  Clock,
  Award,
  Calendar,
  ChevronRight,
  Plus,
  AlertCircle,
  ClipboardList,
} from 'lucide-react'
import { Card, Button, Badge } from '@/components/ui'
import { ParentCreateAssignmentModal } from '@/components/ui/ParentCreateAssignmentModal'
import { parentApi } from '@/lib/api'
import { cn } from '@/lib/utils'

export function ParentDashboard() {
  const [selectedChild, setSelectedChild] = useState<number | null>(null)
  const [showCreateAssignment, setShowCreateAssignment] = useState(false)

  // Fetch linked children
  const { data: children, isLoading: childrenLoading } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => parentApi.getChildren(),
  })

  // Fetch selected child's progress
  const { data: childProgress } = useQuery({
    queryKey: ['parent', 'child-progress', selectedChild],
    queryFn: () => parentApi.getChildProgress(selectedChild!),
    enabled: !!selectedChild,
  })

  // Fetch selected child's recent activity
  const { data: recentActivity } = useQuery({
    queryKey: ['parent', 'child-activity', selectedChild],
    queryFn: () => parentApi.getChildActivity(selectedChild!),
    enabled: !!selectedChild,
  })

  // Fetch parent assignments
  const { data: assignmentsData } = useQuery({
    queryKey: ['parent', 'assignments'],
    queryFn: () => parentApi.getAssignments(),
  })

  const childList = children?.data?.children || []
  const progress = childProgress?.data
  const activity = recentActivity?.data || []
  const parentAssignments = assignmentsData?.data?.assignments || []

  // Auto-select first child
  if (!selectedChild && childList.length > 0) {
    setSelectedChild(childList[0].id)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parent Portal</h1>
          <p className="text-gray-500 mt-1">Monitor your child's learning progress</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowCreateAssignment(true)}>
            <ClipboardList className="h-4 w-4 mr-2" />
            Create Assignment
          </Button>
          <Button variant="secondary">
            <Plus className="h-4 w-4 mr-2" />
            Link Child Account
          </Button>
        </div>
      </div>

      {/* Children Selector */}
      {childList.length > 0 ? (
        <div className="flex gap-3 overflow-x-auto pb-2">
          {childList.map((child: any) => (
            <button
              key={child.id}
              onClick={() => setSelectedChild(child.id)}
              className={cn(
                'flex items-center gap-3 px-4 py-3 rounded-xl border-2 min-w-[200px] transition-all',
                selectedChild === child.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-white font-medium',
                selectedChild === child.id ? 'bg-primary-600' : 'bg-gray-400'
              )}>
                {child.first_name?.[0]}{child.last_name?.[0]}
              </div>
              <div className="text-left">
                <p className="font-medium text-gray-900">
                  {child.first_name} {child.last_name}
                </p>
                <p className="text-sm text-gray-500">Form {child.current_form || '?'}</p>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <Card className="text-center py-12">
          <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Children Linked</h3>
          <p className="text-gray-500 mt-1 mb-4">
            Link your child's account to monitor their progress
          </p>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Link Child Account
          </Button>
        </Card>
      )}

      {/* My Assignments */}
      {parentAssignments.length > 0 && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Assignments</h2>
            <Button variant="ghost" size="sm" onClick={() => setShowCreateAssignment(true)}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
          <div className="space-y-3">
            {parentAssignments.map((assignment: any) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <p className="font-medium text-gray-900">{assignment.title}</p>
                  <div className="flex items-center gap-2 mt-1 text-sm text-gray-500">
                    {assignment.paper_titles?.length > 0 && (
                      <span>{assignment.paper_titles.length} paper(s)</span>
                    )}
                    {assignment.resource_titles?.length > 0 && (
                      <span>{assignment.resource_titles.length} resource(s)</span>
                    )}
                    <span>·</span>
                    <span>
                      {assignment.child_names?.map((c: any) => c.name).join(', ')}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-600">
                    Due: {new Date(assignment.due_date).toLocaleDateString()}
                  </p>
                  <div className="flex gap-1 mt-1">
                    {assignment.submission_status?.map((sub: any) => (
                      <Badge
                        key={sub.student_id}
                        variant={
                          sub.status === 'submitted' || sub.status === 'graded'
                            ? 'success'
                            : sub.status === 'in_progress'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {sub.student_name}: {sub.status === 'not_started' ? 'Not started' : sub.status}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {selectedChild && progress && (
        <>
          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Papers Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{progress.papers_completed}</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Average Score</p>
                  <p className="text-2xl font-bold text-gray-900">{progress.average_score}%</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Study Time (Week)</p>
                  <p className="text-2xl font-bold text-gray-900">{progress.weekly_study_hours}h</p>
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Award className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Study Streak</p>
                  <p className="text-2xl font-bold text-gray-900">{progress.study_streak} days</p>
                </div>
              </div>
            </Card>
          </div>

          {/* Main Content Grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Subject Performance */}
            <Card className="lg:col-span-2">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Subject Performance</h2>
              <div className="space-y-4">
                {progress.subjects?.map((subject: any) => (
                  <div key={subject.name}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{subject.name}</span>
                      <span className="text-sm text-gray-500">{subject.score}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-2 rounded-full',
                          subject.score >= 80 ? 'bg-green-500' :
                          subject.score >= 60 ? 'bg-blue-500' :
                          subject.score >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                        )}
                        style={{ width: `${subject.score}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Areas Needing Attention */}
            <Card>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Areas to Focus</h2>
              {progress.weak_areas?.length > 0 ? (
                <div className="space-y-3">
                  {progress.weak_areas.map((area: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 p-3 bg-red-50 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="font-medium text-red-800">{area.topic}</p>
                        <p className="text-sm text-red-600">{area.subject}</p>
                        <p className="text-xs text-red-500 mt-1">Score: {area.score}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <Award className="h-10 w-10 text-green-500 mx-auto mb-2" />
                  <p className="text-gray-500">Performing well in all areas!</p>
                </div>
              )}
            </Card>
          </div>

          {/* Recent Activity */}
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
              <Button variant="ghost" size="sm">
                View All <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
            {activity.length > 0 ? (
              <div className="space-y-3">
                {activity.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        item.type === 'paper' ? 'bg-blue-100' :
                        item.type === 'assignment' ? 'bg-purple-100' : 'bg-gray-100'
                      )}>
                        {item.type === 'paper' ? (
                          <BookOpen className="h-5 w-5 text-blue-600" />
                        ) : (
                          <Calendar className="h-5 w-5 text-purple-600" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{item.title}</p>
                        <p className="text-sm text-gray-500">{item.subject}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={item.score >= 70 ? 'success' : item.score >= 50 ? 'warning' : 'danger'}>
                        {item.score}%
                      </Badge>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(item.completed_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">No recent activity</p>
            )}
          </Card>

          {/* Upcoming Assignments */}
          <Card>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Upcoming Assignments</h2>
            {progress.upcoming_assignments?.length > 0 ? (
              <div className="space-y-3">
                {progress.upcoming_assignments.map((assignment: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{assignment.title}</p>
                      <p className="text-sm text-gray-500">{assignment.class_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </p>
                      <Badge variant={assignment.status === 'submitted' ? 'success' : 'warning'}>
                        {assignment.status === 'submitted' ? 'Submitted' : 'Pending'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-6">No upcoming assignments</p>
            )}
          </Card>
        </>
      )}

      {/* Create Assignment Modal */}
      <ParentCreateAssignmentModal
        isOpen={showCreateAssignment}
        onClose={() => setShowCreateAssignment(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
