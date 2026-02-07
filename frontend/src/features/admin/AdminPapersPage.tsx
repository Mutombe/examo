import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Upload,
  Search,
  Filter,
  AlertCircle,
  ExternalLink,
  Loader2,
  Sparkles,
  RefreshCw,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Pagination } from '@/components/ui'
import { adminApi } from '@/lib/api'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

type FilterType = 'all' | 'pending' | 'approved' | 'rejected'

// Helper to extract array from API response (handles both paginated and non-paginated)
const getDataArray = (response: any): any[] => {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.data.results)) return response.data.results
  return []
}

export function AdminPapersPage() {
  const [filter, setFilter] = useState<FilterType>('pending')
  const [selectedPaper, setSelectedPaper] = useState<any>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [processingPaperId, setProcessingPaperId] = useState<number | null>(null)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const openPaperUploadModal = useUIStore((state) => state.openPaperUploadModal)

  // Fetch papers based on filter
  const { data: papers, isLoading, refetch } = useQuery({
    queryKey: ['admin', 'papers', filter, page],
    queryFn: () => {
      if (filter === 'pending') {
        return adminApi.getPendingPapers()
      }
      return adminApi.getPapers({ status: filter === 'all' ? undefined : filter, page })
    },
  })

  // Approve paper mutation
  const approveMutation = useMutation({
    mutationFn: (paperId: number) => adminApi.approvePaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'papers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setShowPreviewModal(false)
    },
  })

  // Reject paper mutation
  const rejectMutation = useMutation({
    mutationFn: ({ paperId, reason }: { paperId: number; reason: string }) =>
      adminApi.rejectPaper(paperId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'papers'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setShowPreviewModal(false)
      setShowRejectModal(false)
      setRejectReason('')
    },
  })

  // Process paper with AI mutation
  const processMutation = useMutation({
    mutationFn: (paperId: number) => {
      setProcessingPaperId(paperId)
      return adminApi.processPaperWithAI(paperId)
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'papers'] })
      setProcessingPaperId(null)
      // Show success message
      alert(`Successfully extracted ${data?.data?.questions_extracted || 0} questions!`)
    },
    onError: (error: any) => {
      setProcessingPaperId(null)
      alert(error?.response?.data?.error || 'Failed to process paper')
    },
  })

  const filters = [
    { id: 'pending', label: 'Pending Review', icon: Clock },
    { id: 'approved', label: 'Approved', icon: CheckCircle },
    { id: 'rejected', label: 'Rejected', icon: XCircle },
    { id: 'all', label: 'All Papers', icon: FileText },
  ]

  const handlePreview = (paper: any) => {
    setSelectedPaper(paper)
    setShowPreviewModal(true)
  }

  const handleApprove = (paper?: any) => {
    const paperToApprove = paper || selectedPaper
    if (paperToApprove) {
      approveMutation.mutate(paperToApprove.id)
    }
  }

  const handleRejectClick = (paper?: any) => {
    const paperToReject = paper || selectedPaper
    if (paperToReject) {
      setSelectedPaper(paperToReject)
      setShowRejectModal(true)
    }
  }

  const handleRejectConfirm = () => {
    if (selectedPaper && rejectReason.trim()) {
      rejectMutation.mutate({ paperId: selectedPaper.id, reason: rejectReason })
    }
  }

  const handleProcessWithAI = (paper: any) => {
    if (!processMutation.isPending) {
      processMutation.mutate(paper.id)
    }
  }

  // Helper to get display values from paper object
  const getPaperBoard = (paper: any) => paper.syllabus?.board || paper.board_name || 'Unknown'
  const getPaperSubject = (paper: any) => paper.syllabus?.subject || paper.subject_name || 'Unknown'
  const getPaperLevel = (paper: any) => paper.syllabus?.level || paper.level_display || ''

  const filteredPapers = getDataArray(papers).filter((paper: any) =>
    paper.title?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Paper Management</h1>
          <p className="text-gray-500 mt-1">Review, approve, and manage uploaded papers</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openPaperUploadModal}>
            <Upload className="h-4 w-4 mr-2" />
            Upload Paper
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => { setFilter(f.id as FilterType); setPage(1) }}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-primary-100 text-primary-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            )}
          >
            <f.icon className="h-4 w-4" />
            {f.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search papers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Papers List */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : filteredPapers?.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No papers found</h3>
          <p className="text-gray-500 mt-1">
            {filter === 'pending' ? 'All papers have been reviewed!' : 'No papers match your criteria.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPapers?.map((paper: any) => (
            <Card key={paper.id}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="flex items-start gap-4 min-w-0">
                  <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="h-6 w-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{paper.title}</h3>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <Badge variant="secondary">{getPaperBoard(paper)}</Badge>
                      <Badge variant="secondary">{getPaperSubject(paper)}</Badge>
                      {getPaperLevel(paper) && (
                        <Badge variant="info">{getPaperLevel(paper)}</Badge>
                      )}
                      <Badge variant="secondary">{paper.year} {paper.session}</Badge>
                    </div>
                    <p className="text-sm text-gray-500 mt-2">
                      Uploaded by {paper.uploaded_by_name || 'Unknown'} on{' '}
                      {new Date(paper.created_at).toLocaleDateString()}
                    </p>
                    {paper.question_count > 0 ? (
                      <p className="text-sm text-green-600 mt-1 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {paper.question_count} questions extracted
                      </p>
                    ) : (
                      <p className="text-sm text-amber-600 mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3.5 w-3.5" />
                        No questions extracted yet
                      </p>
                    )}
                    {paper.rejection_reason && (
                      <p className="text-sm text-red-600 mt-1">
                        Rejected: {paper.rejection_reason}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end self-end sm:self-auto">
                  {/* View PDF Button */}
                  {paper.pdf_url && (
                    <a
                      href={paper.pdf_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View PDF
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}

                  {/* Process with AI - Available for ANY paper with no questions */}
                  {paper.question_count === 0 && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleProcessWithAI(paper)}
                      disabled={processingPaperId === paper.id}
                      className="bg-purple-50 text-purple-700 hover:bg-purple-100 border-purple-200"
                    >
                      {processingPaperId === paper.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4 mr-1" />
                          Extract Questions
                        </>
                      )}
                    </Button>
                  )}

                  {/* Re-process option for papers with questions */}
                  {paper.question_count > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleProcessWithAI(paper)}
                      disabled={processingPaperId === paper.id}
                      title="Re-extract questions"
                    >
                      {processingPaperId === paper.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="h-4 w-4" />
                      )}
                    </Button>
                  )}

                  {/* Approve/Reject for pending papers */}
                  {paper.status === 'pending' && (
                    <>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleRejectClick(paper)}
                        disabled={rejectMutation.isPending}
                      >
                        <XCircle className="h-4 w-4 mr-1" />
                        Reject
                      </Button>
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() => handleApprove(paper)}
                        disabled={approveMutation.isPending}
                      >
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Approve
                      </Button>
                    </>
                  )}

                  {/* View Details */}
                  <Button size="sm" variant="secondary" onClick={() => handlePreview(paper)}>
                    <Eye className="h-4 w-4 mr-1" />
                    Details
                  </Button>

                  {/* Status Badge */}
                  <Badge
                    variant={
                      paper.status === 'approved' ? 'success' :
                      paper.status === 'rejected' ? 'danger' :
                      'warning'
                    }
                  >
                    {paper.status || 'pending'}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalCount={papers?.data?.count || getDataArray(papers).length}
        onPageChange={setPage}
      />

      {/* Paper Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Paper Details"
      >
        {selectedPaper && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">{selectedPaper.title}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{getPaperBoard(selectedPaper)}</Badge>
                <Badge variant="secondary">{getPaperSubject(selectedPaper)}</Badge>
                {getPaperLevel(selectedPaper) && (
                  <Badge variant="info">{getPaperLevel(selectedPaper)}</Badge>
                )}
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <p className="text-sm text-gray-600">
                <strong>Year:</strong> {selectedPaper.year} {selectedPaper.session}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Paper Type:</strong> {selectedPaper.paper_type}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Duration:</strong> {selectedPaper.duration_minutes} minutes
              </p>
              <p className="text-sm text-gray-600">
                <strong>Total Marks:</strong> {selectedPaper.total_marks}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Uploaded by:</strong> {selectedPaper.uploaded_by_name || 'Unknown'}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Questions extracted:</strong>{' '}
                <span className={selectedPaper.question_count > 0 ? 'text-green-600' : 'text-amber-600'}>
                  {selectedPaper.question_count || 0}
                </span>
              </p>
              <p className="text-sm text-gray-600">
                <strong>Status:</strong>{' '}
                <Badge
                  variant={
                    selectedPaper.status === 'approved' ? 'success' :
                    selectedPaper.status === 'rejected' ? 'danger' :
                    'warning'
                  }
                >
                  {selectedPaper.status || 'pending'}
                </Badge>
              </p>
            </div>

            {/* PDF Preview */}
            {selectedPaper.pdf_url && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-medium text-gray-900">PDF Preview</h4>
                  <a
                    href={selectedPaper.pdf_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                  >
                    Open in new tab <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <div className="border rounded-lg overflow-hidden">
                  <iframe
                    src={selectedPaper.pdf_url}
                    className="w-full h-64"
                    title="Paper Preview"
                  />
                </div>
              </div>
            )}

            {/* Extracted Questions Preview */}
            {selectedPaper.questions?.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Extracted Questions</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedPaper.questions?.slice(0, 10).map((q: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded text-sm">
                      <span className="font-medium">Q{q.question_number}:</span>{' '}
                      {q.question_text?.slice(0, 150)}...
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {/* Process with AI button */}
              <Button
                variant="secondary"
                onClick={() => handleProcessWithAI(selectedPaper)}
                disabled={processingPaperId === selectedPaper.id}
                className="bg-purple-50 text-purple-700 hover:bg-purple-100"
              >
                {processingPaperId === selectedPaper.id ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {selectedPaper.question_count > 0 ? 'Re-extract Questions' : 'Extract Questions'}
                  </>
                )}
              </Button>

              {selectedPaper.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    onClick={() => handleRejectClick()}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    onClick={() => handleApprove()}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setRejectReason('')
        }}
        title="Reject Paper"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for rejecting "{selectedPaper?.title}":
          </p>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Enter rejection reason..."
            className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            rows={4}
          />
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={() => {
                setShowRejectModal(false)
                setRejectReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircle className="h-4 w-4 mr-2" />
                  Confirm Rejection
                </>
              )}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
