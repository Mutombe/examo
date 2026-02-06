import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { studentApi, Assignment } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Pagination } from '@/components/ui/Pagination'

export function StudentAssignmentsPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['student-assignments', page],
    queryFn: () => studentApi.getAssignments({ page }),
  })

  const assignments: Assignment[] = data?.data?.results || data?.data || []

  const now = new Date()
  const activeAssignments = assignments.filter((a) => new Date(a.due_date) > now)
  const pastAssignments = assignments.filter((a) => new Date(a.due_date) <= now)

  const renderAssignmentCard = (assignment: Assignment) => {
    const dueDate = new Date(assignment.due_date)
    const isOverdue = dueDate < now
    const isDueSoon = !isOverdue && dueDate.getTime() - now.getTime() < 24 * 60 * 60 * 1000

    return (
      <Card key={assignment.id} className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-900">{assignment.title}</h3>
            <p className="text-sm text-gray-500">{assignment.type_display}</p>
          </div>
          <Badge
            variant={
              isOverdue ? 'secondary' : isDueSoon ? 'warning' : assignment.is_mandatory ? 'info' : 'success'
            }
          >
            {isOverdue ? 'Closed' : isDueSoon ? 'Due Soon' : assignment.is_mandatory ? 'Mandatory' : 'Optional'}
          </Badge>
        </div>

        {assignment.description && (
          <p className="text-sm text-gray-600 mb-3 line-clamp-2">{assignment.description}</p>
        )}

        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex justify-between">
            <span>Due Date</span>
            <span className={`font-medium ${isDueSoon ? 'text-orange-600' : ''}`}>
              {dueDate.toLocaleDateString()} at {dueDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Total Marks</span>
            <span className="font-medium">{assignment.total_marks}</span>
          </div>
          {assignment.time_limit_minutes > 0 && (
            <div className="flex justify-between">
              <span>Time Limit</span>
              <span className="font-medium">{assignment.time_limit_minutes} minutes</span>
            </div>
          )}
        </div>

        <Link to={`/assignments/${assignment.id}`}>
          <Button variant={isOverdue ? 'secondary' : 'primary'} size="sm" className="w-full">
            {isOverdue ? 'View Results' : 'Start Assignment'}
          </Button>
        </Link>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">My Assignments</h1>
        <p className="text-gray-600">View and complete assignments from your teachers</p>
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
          <p className="text-gray-500">
            You don't have any assignments from your teachers yet.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Active Assignments */}
          {activeAssignments.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">
                Active Assignments ({activeAssignments.length})
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
                Past Assignments ({pastAssignments.length})
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
    </div>
  )
}
