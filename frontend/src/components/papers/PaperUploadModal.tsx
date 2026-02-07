import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Upload, FileText, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { examsApi, papersApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

const uploadSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  board_id: z.string().min(1, 'Please select an examination board'),
  subject_id: z.string().min(1, 'Please select a subject'),
  level: z.string().min(1, 'Please select a level'),
  year: z.string().regex(/^\d{4}$/, 'Enter a valid year'),
  session: z.string().min(1, 'Please select a session'),
  paper_type: z.string().min(1, 'Please select paper type'),
})

type UploadForm = z.infer<typeof uploadSchema>

interface PaperUploadModalProps {
  isOpen: boolean
  onClose: () => void
}

export function PaperUploadModal({ isOpen, onClose }: PaperUploadModalProps) {
  const [paperFile, setPaperFile] = useState<File | null>(null)
  const [markingSchemeFile, setMarkingSchemeFile] = useState<File | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle')
  const [uploadMessage, setUploadMessage] = useState('')
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const openAuthModal = useUIStore((state) => state.openAuthModal)

  const form = useForm<UploadForm>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      title: '',
      board_id: '',
      subject_id: '',
      level: '',
      year: new Date().getFullYear().toString(),
      session: '',
      paper_type: '',
    },
  })

  // Fetch boards and subjects
  const { data: boards } = useQuery({
    queryKey: ['boards'],
    queryFn: () => examsApi.getBoards(),
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => examsApi.getSubjects(),
  })

  const uploadMutation = useMutation({
    mutationFn: async (data: UploadForm) => {
      const formData = new FormData()
      formData.append('title', data.title)
      formData.append('board_id', data.board_id)
      formData.append('subject_id', data.subject_id)
      formData.append('level', data.level)
      formData.append('year', data.year)
      formData.append('session', data.session)
      formData.append('paper_type', data.paper_type)

      if (paperFile) {
        formData.append('paper_file', paperFile)
      }
      if (markingSchemeFile) {
        formData.append('marking_scheme_file', markingSchemeFile)
      }

      return papersApi.uploadPaper(formData)
    },
    onSuccess: () => {
      setUploadStatus('success')
      setUploadMessage('Paper uploaded successfully! It will be reviewed by our team.')
      setTimeout(() => {
        handleClose()
      }, 2000)
    },
    onError: (error: any) => {
      setUploadStatus('error')
      setUploadMessage(error.response?.data?.detail || 'Upload failed. Please try again.')
    },
  })

  const handlePaperFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setPaperFile(file)
      // Auto-fill title from filename if empty
      if (!form.getValues('title')) {
        const nameWithoutExt = file.name.replace('.pdf', '')
        form.setValue('title', nameWithoutExt)
      }
    }
  }

  const handleMarkingSchemeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type === 'application/pdf') {
      setMarkingSchemeFile(file)
    }
  }

  const handleSubmit = form.handleSubmit((data) => {
    if (!paperFile) {
      setUploadMessage('Please select a paper PDF file')
      setUploadStatus('error')
      return
    }

    if (!isAuthenticated) {
      onClose()
      openAuthModal('register')
      return
    }

    setUploadStatus('uploading')
    setUploadMessage('Uploading paper...')
    uploadMutation.mutate(data)
  })

  const handleClose = () => {
    setPaperFile(null)
    setMarkingSchemeFile(null)
    setUploadStatus('idle')
    setUploadMessage('')
    form.reset()
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Upload Exam Paper">
      <div className="space-y-4">
        {/* Status Message */}
        {uploadStatus !== 'idle' && (
          <div className={`p-4 rounded-lg flex items-center gap-3 ${
            uploadStatus === 'success' ? 'bg-green-50 text-green-800' :
            uploadStatus === 'error' ? 'bg-red-50 text-red-800' :
            'bg-blue-50 text-blue-800'
          }`}>
            {uploadStatus === 'success' && <CheckCircle className="h-5 w-5 text-green-500" />}
            {uploadStatus === 'error' && <AlertCircle className="h-5 w-5 text-red-500" />}
            {(uploadStatus === 'uploading' || uploadStatus === 'processing') && (
              <Loader2 className="h-5 w-5 animate-spin" />
            )}
            <span className="text-sm">{uploadMessage}</span>
          </div>
        )}

        {uploadStatus !== 'success' && (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Paper PDF Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paper PDF *
              </label>
              <div className={`border-2 border-dashed rounded-lg p-6 text-center ${
                paperFile ? 'border-primary-300 bg-primary-50' : 'border-gray-300 hover:border-gray-400'
              }`}>
                {paperFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-8 w-8 text-primary-600" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{paperFile.name}</p>
                      <p className="text-sm text-gray-500">
                        {(paperFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaperFile(null)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <Upload className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-600">
                      Click to upload or drag and drop
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF only (max 20MB)</p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handlePaperFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Marking Scheme PDF Upload (Optional) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Marking Scheme PDF <span className="text-gray-400">(Optional)</span>
              </label>
              <div className={`border-2 border-dashed rounded-lg p-4 text-center ${
                markingSchemeFile ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'
              }`}>
                {markingSchemeFile ? (
                  <div className="flex items-center justify-center gap-3">
                    <FileText className="h-6 w-6 text-green-600" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{markingSchemeFile.name}</p>
                      <p className="text-xs text-gray-500">
                        {(markingSchemeFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMarkingSchemeFile(null)}
                      className="p-1 hover:bg-gray-200 rounded"
                    >
                      <X className="h-4 w-4 text-gray-500" />
                    </button>
                  </div>
                ) : (
                  <label className="cursor-pointer">
                    <p className="text-sm text-gray-500">
                      Upload marking scheme (helps with AI accuracy)
                    </p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleMarkingSchemeFileChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Paper Details */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paper Title *
                </label>
                <Input
                  placeholder="e.g., Mathematics Paper 1"
                  {...form.register('title')}
                  error={form.formState.errors.title?.message}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Examination Board *
                </label>
                <select className="input w-full" {...form.register('board_id')}>
                  <option value="">Select board</option>
                  {boards?.data?.map((board: any) => (
                    <option key={board.id} value={board.id}>
                      {board.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.board_id && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.board_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Subject *
                </label>
                <select className="input w-full" {...form.register('subject_id')}>
                  <option value="">Select subject</option>
                  {subjects?.data?.map((subject: any) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
                {form.formState.errors.subject_id && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.subject_id.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Level *
                </label>
                <select className="input w-full" {...form.register('level')}>
                  <option value="">Select level</option>
                  <option value="o_level">O Level</option>
                  <option value="a_level">A Level</option>
                  <option value="igcse">IGCSE</option>
                  <option value="as_level">AS Level</option>
                </select>
                {form.formState.errors.level && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.level.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year *
                </label>
                <Input
                  type="number"
                  placeholder="2024"
                  {...form.register('year')}
                  error={form.formState.errors.year?.message}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Session *
                </label>
                <select className="input w-full" {...form.register('session')}>
                  <option value="">Select session</option>
                  <option value="june">June</option>
                  <option value="november">November</option>
                  <option value="march">March</option>
                </select>
                {form.formState.errors.session && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.session.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Paper Type *
                </label>
                <select className="input w-full" {...form.register('paper_type')}>
                  <option value="">Select type</option>
                  <option value="paper_1">Paper 1</option>
                  <option value="paper_2">Paper 2</option>
                  <option value="paper_3">Paper 3</option>
                  <option value="practical">Practical</option>
                  <option value="theory">Theory</option>
                </select>
                {form.formState.errors.paper_type && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.paper_type.message}</p>
                )}
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>How it works:</strong> Once uploaded, our AI will automatically extract
                questions from the PDF. An admin will review and approve the paper before it
                becomes available to students.
              </p>
            </div>

            {/* Submit Button */}
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={handleClose} className="flex-1">
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1"
                disabled={uploadMutation.isPending || !paperFile}
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  'Upload Paper'
                )}
              </Button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
