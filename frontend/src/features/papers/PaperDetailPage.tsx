import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { FileText, Clock, Award, Play, ArrowLeft, Eye, Bookmark as BookmarkIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Skeleton, PDFViewerModal } from '@/components/ui'
import { examsApi, attemptsApi, progressApi, type Question } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useGuestStore } from '@/stores/guestStore'

export function PaperDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [showPDFViewer, setShowPDFViewer] = useState(false)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isPaperBookmarked, addPaperBookmark, removePaperBookmark } = useGuestStore()

  const { data: paper, isLoading } = useQuery({
    queryKey: ['paper', id],
    queryFn: () => examsApi.getPaper(parseInt(id!)),
    enabled: !!id,
  })

  const startAttemptMutation = useMutation({
    mutationFn: () => attemptsApi.createAttempt(parseInt(id!)),
    onSuccess: () => {
      navigate(`/papers/${id}/attempt`)
    },
  })

  const handleStartPaper = () => {
    if (isAuthenticated) {
      startAttemptMutation.mutate()
    } else {
      // Guests skip attempt creation - AttemptPage handles them directly
      navigate(`/papers/${id}/attempt`)
    }
  }

  const { data: bookmarkData } = useQuery({
    queryKey: ['paper-bookmark', id],
    queryFn: () => progressApi.checkPaperBookmark(parseInt(id!)),
    enabled: !!id && isAuthenticated,
  })

  const toggleBookmarkMutation = useMutation({
    mutationFn: () => progressApi.togglePaperBookmark(parseInt(id!)),
    onSuccess: (data) => {
      bookmarkData && (bookmarkData.data = data.data)
    },
  })

  const paperData = paper?.data
  const isBookmarked = isAuthenticated
    ? bookmarkData?.data?.is_bookmarked
    : isPaperBookmarked(parseInt(id || '0'))

  const handleToggleBookmark = () => {
    if (isAuthenticated) {
      toggleBookmarkMutation.mutate()
    } else {
      if (isPaperBookmarked(parseInt(id!))) {
        removePaperBookmark(parseInt(id!))
      } else {
        addPaperBookmark(parseInt(id!), paperData?.title)
      }
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Card>
          <Skeleton className="h-40" />
        </Card>
      </div>
    )
  }

  if (!paperData) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Paper not found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Paper info */}
      <Card>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge>{paperData.year}</Badge>
              <Badge variant="info">{paperData.session_display}</Badge>
              <Badge>{paperData.paper_type_display}</Badge>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{paperData.title}</h1>
            <p className="text-gray-500 mt-1">
              {paperData.syllabus.subject_name} - {paperData.syllabus.board_name} -{' '}
              {paperData.syllabus.level_display}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="lg"
              variant="secondary"
              onClick={handleToggleBookmark}
            >
              <BookmarkIcon className={`h-5 w-5 mr-2 ${isBookmarked ? 'fill-current' : ''}`} />
              {isBookmarked ? 'Bookmarked' : 'Bookmark'}
            </Button>
            {paperData.pdf_url && (
              <Button
                size="lg"
                variant="secondary"
                onClick={() => setShowPDFViewer(true)}
              >
                <Eye className="h-5 w-5 mr-2" />
                View Original PDF
              </Button>
            )}
            <Button
              size="lg"
              onClick={handleStartPaper}
              isLoading={startAttemptMutation.isPending}
            >
              <Play className="h-5 w-5 mr-2" />
              Start Paper
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Duration</span>
            </div>
            <p className="text-xl font-bold">{paperData.duration_minutes} min</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
              <Award className="h-4 w-4" />
              <span className="text-sm">Total Marks</span>
            </div>
            <p className="text-xl font-bold">{paperData.total_marks}</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">Questions</span>
            </div>
            <p className="text-xl font-bold">{paperData.question_count}</p>
          </div>
        </div>

        {paperData.instructions && (
          <div className="mt-6 pt-6 border-t">
            <h3 className="font-semibold mb-2">Instructions</h3>
            <p className="text-gray-600 whitespace-pre-line">{paperData.instructions}</p>
          </div>
        )}
      </Card>

      {/* Questions preview */}
      <Card>
        <CardHeader>
          <CardTitle>Questions Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {paperData.questions?.map((question: Question, index: number) => (
              <div
                key={question.id}
                className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-500">Q{question.question_number}</span>
                  <span className="text-sm text-gray-600 line-clamp-1">
                    {question.question_text.substring(0, 80)}
                    {question.question_text.length > 80 ? '...' : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      question.question_type === 'mcq'
                        ? 'info'
                        : question.question_type === 'short_answer'
                        ? 'default'
                        : 'warning'
                    }
                  >
                    {question.type_display}
                  </Badge>
                  <span className="text-sm text-gray-500">{question.marks} marks</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* PDF Viewer Modal */}
      {paperData.pdf_url && (
        <PDFViewerModal
          isOpen={showPDFViewer}
          onClose={() => setShowPDFViewer(false)}
          url={paperData.pdf_url}
          title={paperData.title}
        />
      )}
    </div>
  )
}
