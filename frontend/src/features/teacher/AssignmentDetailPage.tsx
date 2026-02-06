import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { teacherApi, Assignment, AssignmentSubmission } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'

export function AssignmentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  const [feedbackModal, setFeedbackModal] = useState<AssignmentSubmission | null>(null)
  const [feedbackText, setFeedbackText] = useState('')

  const { data: assignmentData, isLoading } = useQuery({
    queryKey: ['teacher-assignment', id],
    queryFn: () => teacherApi.getAssignment(Number(id)),
    enabled: !!id,
  })

  const { data: submissionsData, isLoading: submissionsLoading } = useQuery({
    queryKey: ['assignment-submissions', id],
    queryFn: () => teacherApi.getSubmissions(Number(id)),
    enabled: !!id,
  })

  const publishMutation = useMutation({
    mutationFn: () => teacherApi.publishAssignment(Number(id)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignment', id] })
    },
  })

  const feedbackMutation = useMutation({
    mutationFn: ({ submissionId, feedback }: { submissionId: number; feedback: string }) =>
      teacherApi.addFeedback(submissionId, feedback),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assignment-submissions', id] })
      setFeedbackModal(null)
      setFeedbackText('')
    },
  })

  const assignment: Assignment | undefined = assignmentData?.data
  const submissions: AssignmentSubmission[] =
    submissionsData?.data?.results || submissionsData?.data || []

  const now = new Date()
  const isActive = assignment?.is_published && new Date(assignment.due_date) > now
  const isPast = assignment?.is_published && new Date(assignment.due_date) <= now

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (!assignment) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Assignment not found</h2>
        <Link to="/teacher/assignments" className="text-blue-600 hover:underline">
          Back to assignments
        </Link>
      </div>
    )
  }

  const submittedCount = submissions.filter((s) =>
    ['submitted', 'graded'].includes(s.status)
  ).length
  const gradedCount = submissions.filter((s) => s.status === 'graded').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">{assignment.title}</h1>
            <Badge
              variant={
                !assignment.is_published ? 'warning' : isActive ? 'success' : 'secondary'
              }
            >
              {!assignment.is_published ? 'Draft' : isActive ? 'Active' : 'Closed'}
            </Badge>
          </div>
          <p className="text-gray-600">{assignment.type_display}</p>
        </div>
        <div className="flex gap-3">
          {!assignment.is_published && (
            <Button
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              {publishMutation.isPending ? 'Publishing...' : 'Publish'}
            </Button>
          )}
          <Link to={`/teacher/assignments/${id}/edit`}>
            <Button variant="secondary">Edit</Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-gray-500">Total Marks</div>
          <div className="text-2xl font-bold">{assignment.total_marks}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Classes</div>
          <div className="text-2xl font-bold">{assignment.class_count}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Submissions</div>
          <div className="text-2xl font-bold text-blue-600">{submittedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Graded</div>
          <div className="text-2xl font-bold text-green-600">{gradedCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-gray-500">Due Date</div>
          <div className="text-lg font-bold">
            {new Date(assignment.due_date).toLocaleDateString()}
          </div>
        </Card>
      </div>

      {/* Assignment Details */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Available From:</span>
            <span className="ml-2 font-medium">
              {new Date(assignment.available_from).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Due Date:</span>
            <span className="ml-2 font-medium">
              {new Date(assignment.due_date).toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Time Limit:</span>
            <span className="ml-2 font-medium">
              {assignment.time_limit_minutes
                ? `${assignment.time_limit_minutes} minutes`
                : 'No limit'}
            </span>
          </div>
          <div>
            <span className="text-gray-500">Mandatory:</span>
            <span className="ml-2 font-medium">
              {assignment.is_mandatory ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        {assignment.description && (
          <div className="mt-4 pt-4 border-t">
            <div className="text-gray-500 text-sm mb-1">Description:</div>
            <p className="text-gray-900">{assignment.description}</p>
          </div>
        )}
      </Card>

      {/* Submissions */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Submissions ({submissions.length})
        </h2>

        {submissionsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No submissions yet.</p>
            {!assignment.is_published && (
              <p className="text-sm mt-2">Publish the assignment to start receiving submissions.</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-500 border-b">
                  <th className="pb-2">Student</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2">Submitted</th>
                  <th className="pb-2">Score</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {submissions.map((submission) => (
                  <tr key={submission.id} className="text-sm">
                    <td className="py-3">
                      <div className="font-medium text-gray-900">
                        {submission.student.display_name}
                      </div>
                      <div className="text-gray-500">{submission.student.email}</div>
                    </td>
                    <td className="py-3">
                      <Badge
                        variant={
                          submission.status === 'graded'
                            ? 'success'
                            : submission.status === 'submitted'
                            ? 'info'
                            : submission.status === 'in_progress'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {submission.status_display}
                      </Badge>
                    </td>
                    <td className="py-3">
                      {submission.submitted_at
                        ? new Date(submission.submitted_at).toLocaleString()
                        : '-'}
                    </td>
                    <td className="py-3">
                      {submission.marks_earned !== null ? (
                        <span className="font-medium">
                          {submission.marks_earned}/{submission.marks_possible}
                          {submission.percentage_score !== null && (
                            <span className="text-gray-500 ml-1">
                              ({submission.percentage_score.toFixed(0)}%)
                            </span>
                          )}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setFeedbackModal(submission)
                          setFeedbackText(submission.teacher_feedback || '')
                        }}
                      >
                        {submission.teacher_feedback ? 'Edit Feedback' : 'Add Feedback'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Feedback Modal */}
      <Modal
        isOpen={feedbackModal !== null}
        onClose={() => {
          setFeedbackModal(null)
          setFeedbackText('')
        }}
        title={`Feedback for ${feedbackModal?.student.display_name}`}
      >
        <div className="space-y-4">
          <textarea
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Enter feedback for the student..."
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setFeedbackModal(null)
                setFeedbackText('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() =>
                feedbackModal &&
                feedbackMutation.mutate({
                  submissionId: feedbackModal.id,
                  feedback: feedbackText,
                })
              }
              disabled={feedbackMutation.isPending}
            >
              {feedbackMutation.isPending ? 'Saving...' : 'Save Feedback'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
