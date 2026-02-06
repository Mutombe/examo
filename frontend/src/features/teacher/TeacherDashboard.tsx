import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { teacherApi, Class, Assignment } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { CreateClassModal } from '@/components/ui/CreateClassModal'
import { CreateAssignmentModal } from '@/components/ui/CreateAssignmentModal'

export function TeacherDashboard() {
  const [showCreateClassModal, setShowCreateClassModal] = useState(false)
  const [showCreateAssignmentModal, setShowCreateAssignmentModal] = useState(false)
  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => teacherApi.getClasses(),
  })

  const { data: assignments, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['teacher-assignments'],
    queryFn: () => teacherApi.getAssignments(),
  })

  const classList: Class[] = classes?.data?.results || classes?.data || []
  const assignmentList: Assignment[] = assignments?.data?.results || assignments?.data || []

  const totalStudents = classList.reduce((sum, c) => sum + (c.student_count || 0), 0)
  const pendingAssignments = assignmentList.filter((a) => !a.is_published).length
  const activeAssignments = assignmentList.filter(
    (a) => a.is_published && new Date(a.due_date) > new Date()
  ).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Teacher Dashboard</h1>
          <p className="text-gray-600">Manage your classes and assignments</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setShowCreateClassModal(true)}>New Class</Button>
          <Button variant="secondary" onClick={() => setShowCreateAssignmentModal(true)}>New Assignment</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Classes</div>
          <div className="text-2xl font-bold text-gray-900">
            {classesLoading ? <Skeleton className="h-8 w-12" /> : classList.length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Students</div>
          <div className="text-2xl font-bold text-gray-900">
            {classesLoading ? <Skeleton className="h-8 w-12" /> : totalStudents}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Active Assignments</div>
          <div className="text-2xl font-bold text-green-600">
            {assignmentsLoading ? <Skeleton className="h-8 w-12" /> : activeAssignments}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Pending Review</div>
          <div className="text-2xl font-bold text-orange-600">
            {assignmentsLoading ? <Skeleton className="h-8 w-12" /> : pendingAssignments}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Classes */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">My Classes</h2>
            <Link to="/teacher/classes" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>

          {classesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : classList.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No classes yet.</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setShowCreateClassModal(true)}>
                Create your first class
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {classList.slice(0, 5).map((cls) => (
                <Link
                  key={cls.id}
                  to={`/teacher/classes/${cls.id}`}
                  className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{cls.name}</div>
                      <div className="text-sm text-gray-500">
                        {cls.subject_name} · Form {cls.form_level}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge variant={cls.is_active ? 'success' : 'secondary'}>
                        {cls.student_count} students
                      </Badge>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Assignments */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Recent Assignments</h2>
            <Link to="/teacher/assignments" className="text-sm text-blue-600 hover:underline">
              View all
            </Link>
          </div>

          {assignmentsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : assignmentList.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No assignments yet.</p>
              <Button variant="secondary" size="sm" className="mt-2" onClick={() => setShowCreateAssignmentModal(true)}>
                Create your first assignment
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {assignmentList.slice(0, 5).map((assignment) => (
                <Link
                  key={assignment.id}
                  to={`/teacher/assignments/${assignment.id}`}
                  className="block p-3 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{assignment.title}</div>
                      <div className="text-sm text-gray-500">
                        Due: {new Date(assignment.due_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={assignment.is_published ? 'success' : 'warning'}>
                        {assignment.is_published ? 'Published' : 'Draft'}
                      </Badge>
                      <span className="text-sm text-gray-500">
                        {assignment.submission_count}/{assignment.class_count * 30}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <CreateClassModal
        isOpen={showCreateClassModal}
        onClose={() => setShowCreateClassModal(false)}
        onSuccess={() => {}}
      />
      <CreateAssignmentModal
        isOpen={showCreateAssignmentModal}
        onClose={() => setShowCreateAssignmentModal(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
