import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { teacherApi, Class } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { CreateClassModal } from '@/components/ui/CreateClassModal'

export function ClassesPage() {
  const queryClient = useQueryClient()
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['teacher-classes', page],
    queryFn: () => teacherApi.getClasses({ page }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => teacherApi.deleteClass(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-classes'] })
      setDeleteId(null)
    },
  })

  const classList: Class[] = data?.data?.results || data?.data || []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Classes</h1>
          <p className="text-gray-600">Manage your classes and students</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>Create Class</Button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : classList.length === 0 ? (
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
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No classes yet</h3>
          <p className="text-gray-500 mb-4">Create your first class to start managing students.</p>
          <Button onClick={() => setShowCreateModal(true)}>Create your first class</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {classList.map((cls) => (
            <Card key={cls.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{cls.name}</h3>
                  <p className="text-sm text-gray-500">{cls.subject_name}</p>
                </div>
                <Badge variant={cls.is_active ? 'success' : 'secondary'}>
                  {cls.is_active ? 'Active' : 'Archived'}
                </Badge>
              </div>

              <div className="space-y-2 text-sm text-gray-600 mb-4">
                <div className="flex justify-between">
                  <span>Form Level</span>
                  <span className="font-medium">Form {cls.form_level}</span>
                </div>
                <div className="flex justify-between">
                  <span>Students</span>
                  <span className="font-medium">{cls.student_count}</span>
                </div>
                <div className="flex justify-between">
                  <span>Academic Year</span>
                  <span className="font-medium">{cls.academic_year}</span>
                </div>
                <div className="flex justify-between">
                  <span>Term</span>
                  <span className="font-medium">{cls.term}</span>
                </div>
              </div>

              {cls.allow_join && (
                <div className="mb-4 p-2 bg-gray-50 rounded text-center">
                  <span className="text-xs text-gray-500">Join Code</span>
                  <div className="font-mono font-bold text-lg tracking-wider">{cls.join_code}</div>
                </div>
              )}

              <div className="flex gap-2">
                <Link to={`/teacher/classes/${cls.id}`} className="flex-1">
                  <Button variant="secondary" size="sm" className="w-full">
                    View
                  </Button>
                </Link>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteId(cls.id)}
                  className="text-red-600 hover:bg-red-50"
                >
                  Archive
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalCount={data?.data?.count || classList.length}
        onPageChange={setPage}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Archive Class"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to archive this class? Students will no longer be able to access it.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" onClick={() => setDeleteId(null)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            disabled={deleteMutation.isPending}
            className="bg-red-600 hover:bg-red-700"
          >
            {deleteMutation.isPending ? 'Archiving...' : 'Archive'}
          </Button>
        </div>
      </Modal>

      <CreateClassModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {}}
      />
    </div>
  )
}
