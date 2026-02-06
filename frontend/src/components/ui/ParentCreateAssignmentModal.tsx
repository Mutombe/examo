import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parentApi, examsApi, libraryApi, CreateParentAssignmentData } from '@/lib/api'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'

interface ParentCreateAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function ParentCreateAssignmentModal({ isOpen, onClose, onSuccess }: ParentCreateAssignmentModalProps) {
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignment_type: 'paper' as string,
    child_ids: [] as number[],
    paper_ids: [] as number[],
    resource_ids: [] as number[],
    available_from: new Date().toISOString().slice(0, 16),
    due_date: '',
  })
  const [error, setError] = useState('')

  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        assignment_type: 'paper',
        child_ids: [],
        paper_ids: [],
        resource_ids: [],
        available_from: new Date().toISOString().slice(0, 16),
        due_date: '',
      })
      setError('')
    }
  }, [isOpen])

  const { data: childrenData } = useQuery({
    queryKey: ['parent', 'children'],
    queryFn: () => parentApi.getChildren(),
    enabled: isOpen,
  })

  const { data: papersData } = useQuery({
    queryKey: ['papers'],
    queryFn: () => examsApi.getPapers(),
    enabled: isOpen,
  })

  const { data: resourcesData } = useQuery({
    queryKey: ['library-resources'],
    queryFn: () => libraryApi.getResources(),
    enabled: isOpen,
  })

  const children: any[] = childrenData?.data?.children || []
  const papers: any[] = papersData?.data?.results || papersData?.data || []
  const resources: any[] = resourcesData?.data?.results || resourcesData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: CreateParentAssignmentData) => parentApi.createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['parent', 'assignments'] })
      onClose()
      onSuccess()
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Failed to create assignment')
    },
  })

  const handleChildToggle = (childId: number) => {
    setFormData((prev) => ({
      ...prev,
      child_ids: prev.child_ids.includes(childId)
        ? prev.child_ids.filter((id) => id !== childId)
        : [...prev.child_ids, childId],
    }))
  }

  const handlePaperToggle = (paperId: number) => {
    setFormData((prev) => ({
      ...prev,
      paper_ids: prev.paper_ids.includes(paperId)
        ? prev.paper_ids.filter((id) => id !== paperId)
        : [...prev.paper_ids, paperId],
    }))
  }

  const handleResourceToggle = (resourceId: number) => {
    setFormData((prev) => ({
      ...prev,
      resource_ids: prev.resource_ids.includes(resourceId)
        ? prev.resource_ids.filter((id) => id !== resourceId)
        : [...prev.resource_ids, resourceId],
    }))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Title is required')
      return
    }
    if (formData.child_ids.length === 0) {
      setError('Please select at least one child')
      return
    }
    if (!formData.due_date) {
      setError('Due date is required')
      return
    }
    if (formData.paper_ids.length === 0 && formData.resource_ids.length === 0) {
      setError('Please select at least one paper or resource')
      return
    }

    createMutation.mutate({
      title: formData.title,
      description: formData.description,
      assignment_type: formData.assignment_type,
      child_ids: formData.child_ids,
      paper_ids: formData.paper_ids.length > 0 ? formData.paper_ids : undefined,
      resource_ids: formData.resource_ids.length > 0 ? formData.resource_ids : undefined,
      available_from: new Date(formData.available_from).toISOString(),
      due_date: new Date(formData.due_date).toISOString(),
    })
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create Assignment" className="max-w-3xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        {/* Basic Information */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Basic Information</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
              <Input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Chemistry Practice - Organic Reactions"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Instructions or notes for your child..."
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Assign to Children */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Assign to Children *</h3>
          {children.length === 0 ? (
            <p className="text-gray-500 text-sm">No children linked. Link a child account first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {children.map((child: any) => (
                <label
                  key={child.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                    formData.child_ids.includes(child.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.child_ids.includes(child.id)}
                    onChange={() => handleChildToggle(child.id)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">
                      {child.first_name} {child.last_name}
                    </div>
                    <div className="text-sm text-gray-500">
                      Form {child.current_form || '?'}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Papers */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">Papers</h3>
          <p className="text-sm text-gray-500 mb-3">Select past papers for your child to practice</p>
          {papers.length === 0 ? (
            <p className="text-gray-500 text-sm">No papers available.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {papers.slice(0, 15).map((paper: any) => (
                <label
                  key={paper.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                    formData.paper_ids.includes(paper.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.paper_ids.includes(paper.id)}
                    onChange={() => handlePaperToggle(paper.id)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{paper.title}</div>
                    <div className="text-sm text-gray-500">
                      {paper.question_count} questions · {paper.total_marks} marks
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Resources */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">Resources</h3>
          <p className="text-sm text-gray-500 mb-3">Select study resources to assign</p>
          {resources.length === 0 ? (
            <p className="text-gray-500 text-sm">No resources available.</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {resources.slice(0, 15).map((resource: any) => (
                <label
                  key={resource.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                    formData.resource_ids.includes(resource.id)
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.resource_ids.includes(resource.id)}
                    onChange={() => handleResourceToggle(resource.id)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{resource.title}</div>
                    <div className="text-sm text-gray-500">
                      {resource.type_display} · {resource.page_count} pages
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Schedule */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Schedule</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Available From</label>
              <Input
                type="datetime-local"
                value={formData.available_from}
                onChange={(e) => setFormData({ ...formData, available_from: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Due Date *</label>
              <Input
                type="datetime-local"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Assignment'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
