import { useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { teacherApi, examsApi, CreateClassData } from '@/lib/api'
import { Modal } from './Modal'
import { Button } from './Button'
import { Input } from './Input'

interface CreateClassModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
}

export function CreateClassModal({ isOpen, onClose, onSuccess }: CreateClassModalProps) {
  const queryClient = useQueryClient()

  const [formData, setFormData] = useState<CreateClassData>({
    name: '',
    subject: 0,
    form_level: 4,
    academic_year: new Date().getFullYear(),
    term: 1,
    max_students: 40,
  })
  const [error, setError] = useState('')

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        name: '',
        subject: 0,
        form_level: 4,
        academic_year: new Date().getFullYear(),
        term: 1,
        max_students: 40,
      })
      setError('')
    }
  }, [isOpen])

  const { data: subjectsData } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => examsApi.getSubjects(),
  })

  const subjects = subjectsData?.data?.results || subjectsData?.data || []

  const createMutation = useMutation({
    mutationFn: (data: CreateClassData) => teacherApi.createClass(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['teacher-classes'] })
      onClose()
      onSuccess()
    },
    onError: (err: any) => {
      setError(err.response?.data?.detail || 'Failed to create class')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.name.trim()) {
      setError('Class name is required')
      return
    }
    if (!formData.subject) {
      setError('Please select a subject')
      return
    }

    createMutation.mutate(formData)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Class" className="max-w-2xl">
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Class Name *
          </label>
          <Input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Form 4 Mathematics A"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Subject *
          </label>
          <select
            value={formData.subject}
            onChange={(e) => setFormData({ ...formData, subject: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>Select a subject</option>
            {subjects.map((subject: any) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Form Level
            </label>
            <select
              value={formData.form_level}
              onChange={(e) => setFormData({ ...formData, form_level: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Form 1</option>
              <option value={2}>Form 2</option>
              <option value={3}>Form 3</option>
              <option value={4}>Form 4</option>
              <option value={5}>Form 5 (Lower 6)</option>
              <option value={6}>Form 6 (Upper 6)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Term
            </label>
            <select
              value={formData.term}
              onChange={(e) => setFormData({ ...formData, term: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Academic Year
            </label>
            <Input
              type="number"
              value={formData.academic_year}
              onChange={(e) => setFormData({ ...formData, academic_year: Number(e.target.value) })}
              min={2020}
              max={2030}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Students
            </label>
            <Input
              type="number"
              value={formData.max_students}
              onChange={(e) => setFormData({ ...formData, max_students: Number(e.target.value) })}
              min={1}
              max={100}
            />
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={createMutation.isPending}>
            {createMutation.isPending ? 'Creating...' : 'Create Class'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
