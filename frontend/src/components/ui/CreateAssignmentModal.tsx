import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teacherApi, examsApi, CreateAssignmentData, Class, Paper } from '@/lib/api'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'

interface CreateAssignmentModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateAssignmentModal({ isOpen, onClose, onSuccess }: CreateAssignmentModalProps) {
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignment_type: 'homework',
    class_ids: [] as number[],
    paper_ids: [] as number[],
    total_marks: 100,
    time_limit_minutes: 60,
    attempts_allowed: 1,
    available_from: new Date().toISOString().slice(0, 16),
    due_date: '',
    is_mandatory: true,
  })
  const [error, setError] = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        title: '',
        description: '',
        assignment_type: 'homework',
        class_ids: [],
        paper_ids: [],
        total_marks: 100,
        time_limit_minutes: 60,
        attempts_allowed: 1,
        available_from: new Date().toISOString().slice(0, 16),
        due_date: '',
        is_mandatory: true,
      })
      setError('')
    }
  }, [isOpen])

  const { data: classesData } = useQuery({
    queryKey: ['teacher-classes'],
    queryFn: () => teacherApi.getClasses(),
  })

  const { data: papersData } = useQuery({
    queryKey: ['papers'],
    queryFn: () => examsApi.getPapers(),
  })

  const classes: Class[] = classesData?.data?.results || classesData?.data || []
  const papers: Paper[] = papersData?.data?.results || papersData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: CreateAssignmentData) => teacherApi.createAssignment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] })
      onClose()
      onSuccess()
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create assignment')
    },
  })

  const handleClassToggle = (classId: number) => {
    setFormData((prev) => ({
      ...prev,
      class_ids: prev.class_ids.includes(classId)
        ? prev.class_ids.filter((id) => id !== classId)
        : [...prev.class_ids, classId],
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.title.trim()) {
      setError('Assignment title is required')
      return
    }
    if (formData.class_ids.length === 0) {
      setError('Please select at least one class')
      return
    }
    if (!formData.due_date) {
      setError('Due date is required')
      return
    }

    const submitData: CreateAssignmentData = {
      title: formData.title,
      description: formData.description,
      assignment_type: formData.assignment_type,
      class_ids: formData.class_ids,
      paper_ids: formData.paper_ids.length > 0 ? formData.paper_ids : undefined,
      total_marks: formData.total_marks,
      time_limit_minutes: formData.time_limit_minutes,
      attempts_allowed: formData.attempts_allowed,
      available_from: new Date(formData.available_from).toISOString(),
      due_date: new Date(formData.due_date).toISOString(),
      is_mandatory: formData.is_mandatory,
    }

    createMutation.mutate(submitData)
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
                placeholder="e.g., Week 5 Homework - Algebra"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Instructions for students..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  value={formData.assignment_type}
                  onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="homework">Homework</option>
                  <option value="quiz">Quiz</option>
                  <option value="test">Test</option>
                  <option value="exam">Exam</option>
                  <option value="practice">Practice</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Total Marks</label>
                <Input
                  type="number"
                  value={formData.total_marks}
                  onChange={(e) => setFormData({ ...formData, total_marks: Number(e.target.value) })}
                  min={1}
                />
              </div>
            </div>
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Assign to Classes */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-3">Assign to Classes *</h3>
          {classes.length === 0 ? (
            <p className="text-gray-500 text-sm">No classes available. Create a class first.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {classes.map((cls) => (
                <label
                  key={cls.id}
                  className={`flex items-center p-3 rounded-lg border cursor-pointer transition ${
                    formData.class_ids.includes(cls.id)
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={formData.class_ids.includes(cls.id)}
                    onChange={() => handleClassToggle(cls.id)}
                    className="mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900">{cls.name}</div>
                    <div className="text-sm text-gray-500">
                      {cls.subject_name} · {cls.student_count} students
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <hr className="border-gray-200" />

        {/* Content (Optional) */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-1">Content (Optional)</h3>
          <p className="text-sm text-gray-500 mb-3">Select past papers to include in this assignment</p>
          {papers.length === 0 ? (
            <p className="text-gray-500 text-sm">No papers available.</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {papers.slice(0, 10).map((paper) => (
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Limit (minutes)</label>
              <Input
                type="number"
                value={formData.time_limit_minutes}
                onChange={(e) => setFormData({ ...formData, time_limit_minutes: Number(e.target.value) })}
                min={0}
                placeholder="0 for no limit"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Attempts Allowed</label>
              <Input
                type="number"
                value={formData.attempts_allowed}
                onChange={(e) => setFormData({ ...formData, attempts_allowed: Number(e.target.value) })}
                min={1}
                max={10}
              />
            </div>
          </div>

          <div className="mt-4">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.is_mandatory}
                onChange={(e) => setFormData({ ...formData, is_mandatory: e.target.checked })}
                className="mr-2"
              />
              <span className="text-sm text-gray-700">This assignment is mandatory</span>
            </label>
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
