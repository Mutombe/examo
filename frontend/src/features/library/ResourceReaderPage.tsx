import { useState, useCallback, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Star, Share2, BookOpen, Clock, Eye, MessageSquare,
  StickyNote, X, Copy, Check, Bookmark as BookmarkIcon
} from 'lucide-react'
import { Card, Button, Badge, Modal, PDFViewer } from '@/components/ui'
import { libraryApi, progressApi, type LibraryResource } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useGuestStore } from '@/stores/guestStore'

function StarRating({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  const [hover, setHover] = useState(0)
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onRate(n)}
          className="p-0.5 transition-transform hover:scale-110"
        >
          <Star
            className={cn(
              'h-6 w-6 transition-colors',
              n <= (hover || rating)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300'
            )}
          />
        </button>
      ))}
    </div>
  )
}

export function ResourceReaderPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { isResourceBookmarked, addResourceBookmark, removeResourceBookmark } = useGuestStore()

  const [showNoteModal, setShowNoteModal] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [showShareModal, setShowShareModal] = useState(false)
  const [copied, setCopied] = useState(false)
  const readingStartTime = useRef<number>(Date.now())
  const lastSyncPage = useRef<number>(1)

  const { data: resourceData, isLoading } = useQuery({
    queryKey: ['library-resource', slug],
    queryFn: () => libraryApi.getResource(slug!),
    enabled: !!slug,
  })

  const resource: LibraryResource | undefined = resourceData?.data

  // Save reading progress
  const progressMutation = useMutation({
    mutationFn: (data: { current_page: number; time_spent_seconds?: number }) =>
      libraryApi.updateProgress(resource!.id, data),
  })

  // Rate resource
  const rateMutation = useMutation({
    mutationFn: (rating: number) => libraryApi.rateResource(resource!.id, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-resource', slug] })
    },
  })

  // Share resource
  const shareMutation = useMutation({
    mutationFn: () => libraryApi.shareResource(slug!),
  })

  // Add highlight/note
  const highlightMutation = useMutation({
    mutationFn: (data: { page_number: number; note: string }) =>
      libraryApi.addHighlight(resource!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['library-resource', slug] })
      setShowNoteModal(false)
      setNoteText('')
    },
  })

  // Bookmark
  const { data: bookmarkData } = useQuery({
    queryKey: ['resource-bookmark', resource?.id],
    queryFn: () => progressApi.checkResourceBookmark(resource!.id),
    enabled: !!resource && isAuthenticated,
  })

  const toggleBookmarkMutation = useMutation({
    mutationFn: () => progressApi.toggleResourceBookmark(resource!.id),
    onSuccess: (data) => {
      bookmarkData && (bookmarkData.data = data.data)
    },
  })

  const resourceBookmarked = isAuthenticated
    ? bookmarkData?.data?.is_bookmarked
    : resource ? isResourceBookmarked(resource.id) : false

  const handleToggleBookmark = () => {
    if (!resource) return
    if (isAuthenticated) {
      toggleBookmarkMutation.mutate()
    } else {
      if (isResourceBookmarked(resource.id)) {
        removeResourceBookmark(resource.id)
      } else {
        addResourceBookmark(resource.id, resource.title)
      }
    }
  }

  // Handle page changes in the PDF viewer
  const handlePageChange = useCallback((page: number, total: number) => {
    setCurrentPage(page)
    setTotalPages(total)

    // Save progress periodically (every 3 pages or when navigating)
    if (isAuthenticated && resource && Math.abs(page - lastSyncPage.current) >= 3) {
      const timeSpent = Math.floor((Date.now() - readingStartTime.current) / 1000)
      progressMutation.mutate({
        current_page: page,
        time_spent_seconds: timeSpent,
      })
      readingStartTime.current = Date.now()
      lastSyncPage.current = page
    }
  }, [resource, isAuthenticated])

  // Save progress on unmount
  useEffect(() => {
    return () => {
      if (isAuthenticated && resource) {
        const timeSpent = Math.floor((Date.now() - readingStartTime.current) / 1000)
        if (timeSpent > 5) {
          // Fire and forget
          libraryApi.updateProgress(resource.id, {
            current_page: currentPage,
            time_spent_seconds: timeSpent,
          }).catch(() => {})
        }
      }
    }
  }, [resource, isAuthenticated, currentPage])

  const handleShare = async () => {
    shareMutation.mutate()
    const shareUrl = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title: resource?.title,
          text: `Check out "${resource?.title}" on ExamRevise`,
          url: shareUrl,
        })
      } catch {
        setShowShareModal(true)
      }
    } else {
      setShowShareModal(true)
    }
  }

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!resource) {
    return (
      <div className="text-center py-12">
        <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
        <p className="text-gray-500">Resource not found</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/library')}>
          Back to Library
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/library')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{resource.title}</h1>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <Badge variant="info">{resource.type_display}</Badge>
              {resource.subject_name && (
                <Badge variant="secondary">{resource.subject_name}</Badge>
              )}
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <BookOpen className="h-3.5 w-3.5" />
                {resource.page_count} pages
              </span>
              <span className="text-sm text-gray-500 flex items-center gap-1">
                <Eye className="h-3.5 w-3.5" />
                {resource.view_count} views
              </span>
              <span className="text-sm text-gray-500">{resource.file_size_display}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={handleToggleBookmark}>
            <BookmarkIcon className={`h-4 w-4 mr-1 ${resourceBookmarked ? 'fill-current' : ''}`} />
            {resourceBookmarked ? 'Saved' : 'Save'}
          </Button>
          <Button variant="secondary" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
          {isAuthenticated && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowNoteModal(true)}
              title="Add a note on this page"
            >
              <StickyNote className="h-4 w-4 mr-1" />
              Note
            </Button>
          )}
        </div>
      </div>

      {/* Description */}
      {resource.description && (
        <p className="text-gray-600">{resource.description}</p>
      )}

      {/* PDF Reader */}
      {resource.file_url ? (
        <div className="rounded-xl overflow-hidden shadow-lg" style={{ height: '80vh' }}>
          <PDFViewer
            url={resource.file_url}
            title={resource.title}
            initialPage={resource.reading_progress?.current_page || 1}
            onPageChange={handlePageChange}
          />
        </div>
      ) : (
        <Card className="p-12 text-center">
          <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">PDF file not available</p>
        </Card>
      )}

      {/* Bottom bar - rating, notes */}
      <Card className="p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">Rate this resource</p>
            <div className="flex items-center gap-3">
              <StarRating
                rating={resource.user_rating || 0}
                onRate={(rating) => {
                  if (isAuthenticated) {
                    rateMutation.mutate(rating)
                  }
                }}
              />
              <span className="text-sm text-gray-500">
                {resource.avg_rating > 0 && (
                  <>
                    {Number(resource.avg_rating).toFixed(1)} avg
                    ({resource.total_ratings} {resource.total_ratings === 1 ? 'rating' : 'ratings'})
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Tags */}
          {resource.tags && resource.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {resource.tags.map((tag: string) => (
                <span key={tag} className="px-3 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* User highlights/notes */}
        {resource.highlights && resource.highlights.length > 0 && (
          <div className="mt-6 border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Your Notes ({resource.highlights.length})
            </h3>
            <div className="space-y-2">
              {resource.highlights.map((h: any) => (
                <div key={h.id} className="flex items-start gap-3 p-3 bg-yellow-50 rounded-lg">
                  <span className="text-xs font-medium text-yellow-700 bg-yellow-200 px-2 py-0.5 rounded">
                    p.{h.page_number}
                  </span>
                  <p className="text-sm text-gray-700 flex-1">{h.note}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Note Modal */}
      <Modal
        isOpen={showNoteModal}
        onClose={() => setShowNoteModal(false)}
        title={`Add Note (Page ${currentPage})`}
      >
        <div className="space-y-4">
          <textarea
            className="input min-h-[120px]"
            placeholder="Write your note about this page..."
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowNoteModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={() => highlightMutation.mutate({
                page_number: currentPage,
                note: noteText,
              })}
              disabled={!noteText.trim() || highlightMutation.isPending}
            >
              {highlightMutation.isPending ? 'Saving...' : 'Save Note'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Resource"
      >
        <div className="space-y-4">
          <p className="text-gray-600">Share "{resource.title}" with others</p>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={window.location.href}
              className="input flex-1 text-sm bg-gray-50"
            />
            <Button onClick={handleCopyLink} variant="secondary">
              {copied ? <Check className="h-4 w-4 text-success-600" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-xs text-gray-500 text-center">
            Anyone with this link can read this resource
          </p>
        </div>
      </Modal>
    </div>
  )
}
