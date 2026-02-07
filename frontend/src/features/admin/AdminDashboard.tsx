import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  LayoutDashboard,
  FileText,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Upload,
  Search,
  Filter,
  MoreVertical,
  AlertCircle,
  TrendingUp,
  BookOpen,
} from 'lucide-react'
import { Card, Button, Badge, Modal } from '@/components/ui'
import { adminApi } from '@/lib/api'
import { useUIStore } from '@/stores/uiStore'
import { cn } from '@/lib/utils'

type TabType = 'overview' | 'pending' | 'approved' | 'rejected' | 'users'

// Helper to extract array from API response (handles both paginated and non-paginated)
const getDataArray = (response: any): any[] => {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.data.results)) return response.data.results
  return []
}

export function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedPaper, setSelectedPaper] = useState<any>(null)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [showRejectModal, setShowRejectModal] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const queryClient = useQueryClient()
  const openPaperUploadModal = useUIStore((state) => state.openPaperUploadModal)

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
  })

  // Fetch pending papers
  const { data: pendingPapers, isLoading: pendingLoading } = useQuery({
    queryKey: ['admin', 'papers', 'pending'],
    queryFn: () => adminApi.getPendingPapers(),
    enabled: activeTab === 'pending' || activeTab === 'overview',
  })

  // Fetch all papers
  const { data: allPapers } = useQuery({
    queryKey: ['admin', 'papers', 'all', activeTab],
    queryFn: () => adminApi.getPapers({ status: activeTab === 'approved' ? 'approved' : activeTab === 'rejected' ? 'rejected' : undefined }),
    enabled: activeTab === 'approved' || activeTab === 'rejected',
  })

  // Fetch users
  const { data: users } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers(),
    enabled: activeTab === 'users',
  })

  // Approve paper mutation
  const approveMutation = useMutation({
    mutationFn: (paperId: number) => adminApi.approvePaper(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setShowPreviewModal(false)
    },
  })

  // Reject paper mutation
  const rejectMutation = useMutation({
    mutationFn: ({ paperId, reason }: { paperId: number; reason: string }) =>
      adminApi.rejectPaper(paperId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      setShowPreviewModal(false)
      setShowRejectModal(false)
      setRejectionReason('')
    },
  })

  // Process paper with AI mutation
  const processMutation = useMutation({
    mutationFn: (paperId: number) => adminApi.processPaperWithAI(paperId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin'] })
    },
  })

  // Map stats from backend format to frontend format
  const rawStats = stats?.data || {}
  const statsData = {
    total_papers: rawStats.papers?.total || 0,
    pending_papers: rawStats.papers?.pending || 0,
    approved_papers: rawStats.papers?.approved || 0,
    rejected_papers: rawStats.papers?.rejected || 0,
    total_users: rawStats.users?.total || 0,
    total_questions: rawStats.questions?.total || 0,
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'pending', label: 'Pending Review', icon: Clock, count: statsData.pending_papers },
    { id: 'approved', label: 'Approved', icon: CheckCircle },
    { id: 'rejected', label: 'Rejected', icon: XCircle },
    { id: 'users', label: 'Users', icon: Users },
  ]

  const handlePreview = (paper: any) => {
    setSelectedPaper(paper)
    setShowPreviewModal(true)
  }

  const handleApprove = () => {
    if (selectedPaper) {
      approveMutation.mutate(selectedPaper.id)
    }
  }

  const handleReject = () => {
    if (selectedPaper) {
      setShowRejectModal(true)
    }
  }

  const confirmReject = () => {
    if (selectedPaper && rejectionReason.trim()) {
      rejectMutation.mutate({ paperId: selectedPaper.id, reason: rejectionReason })
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Manage papers, users, and content</p>
        </div>
        <Button onClick={openPaperUploadModal} className="self-start sm:self-auto">
          <Upload className="h-4 w-4 mr-2" />
          Upload Paper
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1 sm:gap-4 overflow-x-auto -mx-1 px-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                'flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              )}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Total Papers</p>
                  <p className="text-3xl font-bold mt-1">{statsData.total_papers}</p>
                </div>
                <FileText className="h-10 w-10 text-blue-200" />
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Pending Review</p>
                  <p className="text-3xl font-bold mt-1">{statsData.pending_papers}</p>
                </div>
                <Clock className="h-10 w-10 text-yellow-200" />
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-green-500 to-emerald-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Total Questions</p>
                  <p className="text-3xl font-bold mt-1">{statsData.total_questions}</p>
                </div>
                <BookOpen className="h-10 w-10 text-green-200" />
              </div>
            </Card>
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-100 text-sm">Total Users</p>
                  <p className="text-3xl font-bold mt-1">{statsData.total_users}</p>
                </div>
                <Users className="h-10 w-10 text-purple-200" />
              </div>
            </Card>
          </div>

          {/* Recent Pending Papers */}
          {getDataArray(pendingPapers).length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Papers Awaiting Review</h2>
                <Button variant="ghost" size="sm" onClick={() => setActiveTab('pending')}>
                  View All
                </Button>
              </div>
              <div className="space-y-3">
                {getDataArray(pendingPapers).slice(0, 5).map((paper: any) => (
                  <div
                    key={paper.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-gray-50 rounded-lg gap-2"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900 truncate">{paper.title}</p>
                        <p className="text-sm text-gray-500">
                          {paper.syllabus?.subject} - {paper.syllabus?.board} - {paper.year}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Badge variant="warning">Pending</Badge>
                      <Button size="sm" variant="secondary" onClick={() => handlePreview(paper)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          {/* Search and Filter */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search papers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-10 w-full"
              />
            </div>
            <Button variant="secondary" className="self-start sm:self-auto">
              <Filter className="h-4 w-4 mr-2" />
              Filter
            </Button>
          </div>

          {/* Papers List */}
          {pendingLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
            </div>
          ) : getDataArray(pendingPapers).length === 0 ? (
            <Card className="text-center py-12">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
              <p className="text-gray-500 mt-1">No papers pending review.</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {getDataArray(pendingPapers)
                .filter((paper: any) =>
                  paper.title?.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((paper: any) => (
                  <Card key={paper.id}>
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                      <div className="flex items-start gap-4 min-w-0">
                        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                          <FileText className="h-6 w-6 text-gray-400" />
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900">{paper.title}</h3>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Badge variant="secondary">{paper.syllabus?.board}</Badge>
                            <Badge variant="secondary">{paper.syllabus?.subject}</Badge>
                            <Badge variant="info">{paper.syllabus?.level}</Badge>
                            <Badge variant="secondary">{paper.year} {paper.session}</Badge>
                          </div>
                          <p className="text-sm text-gray-500 mt-2">
                            Uploaded by {paper.uploaded_by_name || 'Unknown'} on{' '}
                            {new Date(paper.created_at).toLocaleDateString()}
                          </p>
                          {paper.question_count > 0 && (
                            <p className="text-sm text-green-600 mt-1">
                              {paper.question_count} questions extracted by AI
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                        {paper.question_count === 0 && (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => processMutation.mutate(paper.id)}
                            disabled={processMutation.isPending}
                          >
                            Process with AI
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => handlePreview(paper)}>
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        <Button size="sm" variant="success" onClick={() => {
                          setSelectedPaper(paper)
                          approveMutation.mutate(paper.id)
                        }}>
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}

      {/* Approved Tab */}
      {activeTab === 'approved' && (
        <div className="space-y-4">
          {getDataArray(allPapers).length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500">No approved papers yet.</p>
            </Card>
          ) : (
            getDataArray(allPapers).map((paper: any) => (
              <Card key={paper.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{paper.title}</h3>
                      <p className="text-sm text-gray-500">
                        {paper.syllabus?.subject || paper.subject_name} - {paper.syllabus?.board || paper.board_name} - {paper.year}
                      </p>
                      {paper.question_count === 0 && (
                        <p className="text-sm text-amber-600 mt-1">No questions extracted yet</p>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    {paper.question_count === 0 && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => processMutation.mutate(paper.id)}
                        disabled={processMutation.isPending}
                      >
                        Extract Questions
                      </Button>
                    )}
                    <Button size="sm" variant="secondary" onClick={() => handlePreview(paper)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Badge variant="success">Approved</Badge>
                    <span className="text-sm text-gray-500">
                      {paper.question_count || 0} questions
                    </span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Rejected Tab */}
      {activeTab === 'rejected' && (
        <div className="space-y-4">
          {getDataArray(allPapers).length === 0 ? (
            <Card className="text-center py-12">
              <p className="text-gray-500">No rejected papers.</p>
            </Card>
          ) : (
            getDataArray(allPapers).map((paper: any) => (
              <Card key={paper.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-4 min-w-0">
                    <FileText className="h-8 w-8 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <h3 className="font-medium text-gray-900 truncate">{paper.title}</h3>
                      <p className="text-sm text-gray-500">
                        {paper.syllabus?.subject || paper.subject_name} - {paper.syllabus?.board || paper.board_name} - {paper.year}
                      </p>
                      {paper.rejection_reason && (
                        <p className="text-sm text-red-600 mt-1">
                          Reason: {paper.rejection_reason}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button size="sm" variant="secondary" onClick={() => handlePreview(paper)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Badge variant="danger">Rejected</Badge>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Users Tab */}
      {activeTab === 'users' && (
        <div className="space-y-4">
          <Card>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
            <table className="min-w-[600px] w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Joined</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {getDataArray(users).map((user: any) => (
                  <tr key={user.id} className="border-b border-gray-100">
                    <td className="py-3 px-4">
                      <div>
                        <p className="font-medium text-gray-900">
                          {user.first_name} {user.last_name}
                        </p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant={
                          user.role === 'admin' ? 'danger' :
                          user.role === 'teacher' ? 'info' :
                          user.role === 'parent' ? 'warning' :
                          'secondary'
                        }
                      >
                        {user.role}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {new Date(user.date_joined).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={user.is_active ? 'success' : 'secondary'}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <Button variant="ghost" size="sm">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </Card>
        </div>
      )}

      {/* Paper Preview Modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Review Paper"
      >
        {selectedPaper && (
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold text-lg text-gray-900">{selectedPaper.title}</h3>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">{selectedPaper.syllabus?.board}</Badge>
                <Badge variant="secondary">{selectedPaper.syllabus?.subject}</Badge>
                <Badge variant="info">{selectedPaper.syllabus?.level}</Badge>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 space-y-1">
              <p className="text-sm text-gray-600">
                <strong>Year:</strong> {selectedPaper.year} {selectedPaper.session}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Paper Type:</strong> {selectedPaper.paper_type}
              </p>
              <p className="text-sm text-gray-600">
                <strong>Uploaded by:</strong> {selectedPaper.uploaded_by_name || 'Unknown'}
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
              <p className="text-sm text-gray-600">
                <strong>Questions extracted:</strong>{' '}
                <span className={selectedPaper.question_count > 0 ? 'text-green-600' : 'text-amber-600'}>
                  {selectedPaper.question_count || 0}
                </span>
              </p>
            </div>

            {selectedPaper.pdf_url && (
              <div className="border rounded-lg overflow-hidden">
                <iframe
                  src={selectedPaper.pdf_url}
                  className="w-full h-64"
                  title="Paper Preview"
                />
              </div>
            )}

            {selectedPaper.question_count > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Extracted Questions Preview</h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {selectedPaper.questions?.slice(0, 5).map((q: any, i: number) => (
                    <div key={i} className="p-3 bg-gray-50 rounded text-sm">
                      <span className="font-medium">Q{q.question_number}:</span> {q.question_text?.slice(0, 100)}...
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3 pt-4 border-t">
              {/* Extract Questions Button - always available */}
              <Button
                variant="secondary"
                onClick={() => {
                  processMutation.mutate(selectedPaper.id)
                }}
                disabled={processMutation.isPending}
              >
                {processMutation.isPending ? 'Processing...' : (
                  selectedPaper.question_count > 0 ? 'Re-extract Questions' : 'Extract Questions'
                )}
              </Button>

              {/* Approve/Reject only for pending papers */}
              {selectedPaper.status === 'pending' && (
                <>
                  <Button
                    variant="danger"
                    onClick={handleReject}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Reject
                  </Button>
                  <Button
                    variant="success"
                    onClick={handleApprove}
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

      {/* Rejection Modal */}
      <Modal
        isOpen={showRejectModal}
        onClose={() => {
          setShowRejectModal(false)
          setRejectionReason('')
        }}
        title="Reject Paper"
      >
        <div className="space-y-4">
          <p className="text-gray-600">
            Please provide a reason for rejecting this paper. This will be visible to the uploader.
          </p>
          {selectedPaper && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-medium text-gray-900">{selectedPaper.title}</p>
              <p className="text-sm text-gray-500">
                {selectedPaper.syllabus?.subject} - {selectedPaper.year}
              </p>
            </div>
          )}
          <div>
            <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Rejection Reason
            </label>
            <textarea
              id="rejection-reason"
              className="input min-h-[100px]"
              placeholder="e.g., Poor quality scan, missing pages, wrong paper..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button
              variant="secondary"
              onClick={() => {
                setShowRejectModal(false)
                setRejectionReason('')
              }}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={confirmReject}
              disabled={!rejectionReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending ? 'Rejecting...' : 'Reject Paper'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
