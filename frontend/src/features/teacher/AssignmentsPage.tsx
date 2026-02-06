import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { teacherApi, Assignment } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'
import { CreateAssignmentModal } from '@/components/ui/CreateAssignmentModal'

export function AssignmentsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-assignments', page],
    queryFn: () => teacherApi.getAssignments({ page }),
  })

  const publishMutation = useMutation({
    mutationFn: (id: number) => teacherApi.publishAssignment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] })
    },
  })

  const assignments: Assignment[] = data?.data?.results || data?.data || []

  const now = new Date()
  const activeAssignments = assignments.filter(
    (a) => a.is_published && new Date(a.due_date) > now
  )
  const pastAssignments = assignments.filter(
    (a) => a.is_published && new Date(a.due_date) <= now
  )
  const draftAssignments = assignments.filter((a) => !a.is_published)

  const renderAssignmentCard = (assignment: Assignment) => (
    <Card key={assignment.id} className="p-5">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
          <p className="text-sm text-gray-500">{assignment.type_display}</p>
        </div>
        <Badge
          variant={
            assignment.is_published
              ? new Date(assignment.due_date) > now
                ? 'success'
                : 'secondary'
              : 'warning'
          }
        >
          {assignment.is_published
            ? new Date(assignment.due_date) > now
              ? 'Active'
              : 'Closed'
            : 'Draft'}
        </Badge>
      </div>

      <div className="space-y-2 text-sm text-gray-600 mb-4">
        <div className="flex justify-between">
          <span>Due Date</span>
          <span className="font-medium">
            {new Date(assignment.due_date).toLocaleDateString()}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Classes</span>
          <span className="font-medium">{assignment.class_count}</span>
        </div>
        <div className="flex justify-between">
          <span>Submissions</span>
          <span className="font-medium">{assignment.submission_count}</span>
        </div>
        <div className="flex justify-between">
          <span>Total Marks</span>
          <span className="font-medium">{assignment.total_marks}</span>
        </div>
      </div>

      <div className="flex gap-2">
        <Link to={`/teacher/assignments/${assignment.id}`} className="flex-1">
          <Button variant="secondary" size="sm" className="w-full">
            View
          </Button>
        </Link>
        {!assignment.is_published && (
          <Button
            size="sm"
            onClick={() => publishMutation.mutate(assignment.id)}
            disabled={publishMutation.isPending}
          >
            Publish
          </Button>
        )}
      </div>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Assignments</h1>
          <p className="text-gray-600">Create and manage assignments for your classes</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create Assignment</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="text-gray-500 mb-4">
            <svg
              className="w-16 h-16 mx-auto text-gray-300"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No assignments yet</h3>
          <p className="text-gray-500 mb-4">
            Create your first assignment to start assigning work to students.
          </p>
          <Button onClick={() => setShowCreateModal(true)}>Create your first assignment</Button>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Draft Assignments */}
          {draftAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Drafts ({draftAssignments.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {draftAssignments.map(renderAssignmentCard)}
              </div>
            </div>
          )}

          {/* Active Assignments */}
          {activeAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Active ({activeAssignments.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeAssignments.map(renderAssignmentCard)}
              </div>
            </div>
          )}

          {/* Past Assignments */}
          {pastAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Past ({pastAssignments.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {pastAssignments.map(renderAssignmentCard)}
              </div>
            </div>
          )}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalCount={data?.data?.count || assignments.length}
        onPageChange={setPage}
      />

      <CreateAssignmentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
