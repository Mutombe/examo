import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teacherApi, ClassDetail, StudentInfo, ClassAnalytics } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'

export function ClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [showCodeModal, setShowCodeModal] = useState(false)

  const { data: classData, isLoading } = useQuery({
    queryKey: ['teacher-class', id],
    queryFn: () => teacherApi.getClass(Number(id)),
    enabled: !!id,
  })

  const { data: analyticsData } = useQuery({
    queryKey: ['class-analytics', id],
    queryFn: () => teacherApi.getClassAnalytics(Number(id)),
    enabled: !!id,
  })

  const regenerateMutation = useMutation({
    mutationFn: () => teacherApi.regenerateCode(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-class', id] })
    },
  })

  const removeStudentMutation = useMutation({
    mutationFn: (studentId: number) => teacherApi.removeStudent(Number(id), studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-class', id] })
    },
  })

  const cls: ClassDetail | undefined = classData?.data
  const analytics: ClassAnalytics | undefined = analyticsData?.data

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96" />
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  if (!cls) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Class not found</h2>
        <Link to="/teacher/classes" className="text-blue-600 hover:underline">
          Back to classes
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{cls.name}</h1>
            <Badge variant={cls.is_active ? 'success' : 'secondary'}>
              {cls.is_active ? 'Active' : 'Archived'}
            </Badge>
          </div>
          <p className="text-gray-600">
            {cls.subject_name} · Form {cls.form_level} · {cls.academic_year} Term {cls.term}
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={() => setShowCodeModal(true)}>
            Share Join Code
          </Button>
          <Link to={`/teacher/classes/${id}/edit`}>
            <Button>Edit Class</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      {analytics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Total Students</div>
            <div className="text-2xl font-bold">{analytics.stats.total_students}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Active Students</div>
            <div className="text-2xl font-bold text-green-600">{analytics.stats.active_students}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Avg Score</div>
            <div className="text-2xl font-bold">{analytics.stats.avg_score_percentage}%</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Assignments</div>
            <div className="text-2xl font-bold">{analytics.stats.total_assignments}</div>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Students List */}
        <Card className="lg:col-span-2 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Students ({cls.students?.length || 0})
            </h2>
          </div>

          {!cls.students || cls.students.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No students enrolled yet.</p>
              <p className="text-sm mt-2">Share the join code to let students join.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm text-gray-500 border-b">
                    <th className="pb-2">Name</th>
                    <th className="pb-2">Form</th>
                    <th className="pb-2">Questions</th>
                    <th className="pb-2">Streak</th>
                    <th className="pb-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {cls.students.map((student: StudentInfo) => (
                    <tr key={student.id} className="text-sm">
                      <td className="py-3">
                        <div className="font-medium text-gray-900">{student.display_name}</div>
                        <div className="text-gray-500">{student.email}</div>
                      </td>
                      <td className="py-3">{student.current_form || '-'}</td>
                      <td className="py-3">{student.total_questions_attempted}</td>
                      <td className="py-3">
                        {student.current_streak_days > 0 && (
                          <span className="text-orange-600">
                            {student.current_streak_days} days
                          </span>
                        )}
                      </td>
                      <td className="py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeStudentMutation.mutate(student.id)}
                          disabled={removeStudentMutation.isPending}
                          className="text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Class Info */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Class Information</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Subject</span>
              <span className="font-medium">{cls.subject_name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Form Level</span>
              <span className="font-medium">Form {cls.form_level}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Academic Year</span>
              <span className="font-medium">{cls.academic_year}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Term</span>
              <span className="font-medium">{cls.term}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Max Students</span>
              <span className="font-medium">{cls.max_students}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Created</span>
              <span className="font-medium">
                {new Date(cls.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium text-gray-900 mb-2">Join Code</h3>
            {cls.allow_join ? (
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="font-mono font-bold text-2xl tracking-wider text-blue-600">
                  {cls.join_code}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Students can use this code to join the class
                </p>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Join code is disabled for this class.
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Join Code Modal */}
      <Modal isOpen={showCodeModal} onClose={() => setShowCodeModal(false)} title="Share Join Code">
        <div className="text-center">
          <div className="p-6 bg-gray-50 rounded-lg mb-4">
            <div className="font-mono font-bold text-4xl tracking-wider text-blue-600">
              {cls.join_code}
            </div>
          </div>
          <p className="text-gray-600 mb-4">
            Share this code with your students. They can use it to join the class.
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              variant="secondary"
              onClick={() => navigator.clipboard.writeText(cls.join_code)}
            >
              Copy Code
            </Button>
            <Button
              variant="ghost"
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? 'Regenerating...' : 'Regenerate'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
