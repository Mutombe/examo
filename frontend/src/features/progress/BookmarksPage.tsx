import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Bookmark as BookmarkIcon, FileText, BookOpen, HelpCircle } from 'lucide-react'
import { progressApi, Bookmark } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { Modal } from '@/components/ui/Modal'
import { Pagination } from '@/components/ui/Pagination'
import { useAuthStore } from '@/stores/authStore'
import { useGuestStore } from '@/stores/guestStore'
import { cn } from '@/lib/utils'

const FOLDER_OPTIONS = [
  { value: 'default', label: 'Saved Questions' },
  { value: 'review', label: 'Review Later' },
  { value: 'difficult', label: 'Difficult Questions' },
  { value: 'favorite', label: 'Favorites' },
]

type BookmarkType = '' | 'question' | 'paper' | 'resource'

const TYPE_TABS = [
  { value: '' as BookmarkType, label: 'All', icon: BookmarkIcon },
  { value: 'question' as BookmarkType, label: 'Questions', icon: HelpCircle },
  { value: 'paper' as BookmarkType, label: 'Papers', icon: FileText },
  { value: 'resource' as BookmarkType, label: 'Resources', icon: BookOpen },
]

export function BookmarksPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const guestStore = useGuestStore()
  const queryClient = useQueryClient()
  const [selectedFolder, setSelectedFolder] = useState<string>('')
  const [selectedType, setSelectedType] = useState<BookmarkType>('')
  const [deleteId, setDeleteId] = useState<number | null>(null)
  const [page, setPage] = useState(1)

  // API data for authenticated users
  const { data, isLoading } = useQuery({
    queryKey: ['bookmarks', selectedFolder, selectedType, page],
    queryFn: () => progressApi.getBookmarks({
      folder: selectedFolder || undefined,
      type: selectedType || undefined,
      page,
    }),
    enabled: isAuthenticated,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => progressApi.deleteBookmark(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bookmarks'] })
      setDeleteId(null)
    },
  })

  // Get data from the appropriate source
  const getBookmarks = (): Bookmark[] => {
    if (isAuthenticated) {
      return data?.data?.results || data?.data || []
    }
    // Guest bookmarks - convert to Bookmark-like objects
    let guestBookmarks = guestStore.bookmarks
    if (selectedType) {
      guestBookmarks = guestBookmarks.filter((b) => b.bookmarkType === selectedType)
    }
    if (selectedFolder) {
      guestBookmarks = guestBookmarks.filter((b) => b.folder === selectedFolder)
    }
    return guestBookmarks.map((b, index) => ({
      id: index,
      bookmark_type: b.bookmarkType,
      question: b.questionId ? { id: b.questionId, question_number: '', question_text: b.title || 'Saved question', question_type: '', type_display: '', marks: 0, options: null, topic: '', difficulty: '', image: null } : null,
      paper: b.paperId ? { id: b.paperId, title: b.title || 'Saved paper', year: 0, session_display: '', subject_name: '', level_display: '' } : null,
      resource: b.resourceId ? { id: b.resourceId, title: b.title || 'Saved resource', slug: '', resource_type: '', type_display: '' } : null,
      note: b.note || '',
      folder: b.folder,
      folder_display: FOLDER_OPTIONS.find((f) => f.value === b.folder)?.label || 'Saved',
      created_at: b.createdAt,
    })) as Bookmark[]
  }

  const bookmarks = getBookmarks()
  const totalCount = isAuthenticated ? (data?.data?.count || bookmarks.length) : bookmarks.length
  const loading = isAuthenticated && isLoading

  const handleRemoveGuestBookmark = (bookmark: Bookmark) => {
    if (bookmark.bookmark_type === 'question' && bookmark.question) {
      guestStore.removeBookmark(bookmark.question.id)
    } else if (bookmark.bookmark_type === 'paper' && bookmark.paper) {
      guestStore.removePaperBookmark(bookmark.paper.id)
    } else if (bookmark.bookmark_type === 'resource' && bookmark.resource) {
      guestStore.removeResourceBookmark(bookmark.resource.id)
    }
  }

  const handleFilterChange = (type: BookmarkType) => {
    setSelectedType(type)
    setPage(1)
  }

  const handleFolderChange = (folder: string) => {
    setSelectedFolder(folder)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bookmarks</h1>
          <p className="text-gray-600">
            {isAuthenticated
              ? 'Your saved questions, papers, and resources'
              : 'Your locally saved items (sign in to sync across devices)'}
          </p>
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-3">
        {TYPE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => handleFilterChange(tab.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              selectedType === tab.value
                ? 'bg-primary-100 text-primary-700'
                : 'text-gray-600 hover:bg-gray-100'
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Folder Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button
          variant={selectedFolder === '' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => handleFolderChange('')}
        >
          All
        </Button>
        {FOLDER_OPTIONS.map((folder) => (
          <Button
            key={folder.value}
            variant={selectedFolder === folder.value ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => handleFolderChange(folder.value)}
          >
            {folder.label}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : bookmarks.length === 0 ? (
        <Card className="p-12 text-center">
          <BookmarkIcon className="h-16 w-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {selectedType || selectedFolder ? 'No bookmarks match your filters' : 'No bookmarks yet'}
          </h3>
          <p className="text-gray-500">
            Save questions, papers, and resources while browsing to review them later.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookmarks.map((bookmark) => (
            <BookmarkCard
              key={`${bookmark.bookmark_type}-${bookmark.id}`}
              bookmark={bookmark}
              isAuthenticated={isAuthenticated}
              onDelete={() => {
                if (isAuthenticated) {
                  setDeleteId(bookmark.id)
                } else {
                  handleRemoveGuestBookmark(bookmark)
                }
              }}
            />
          ))}
        </div>
      )}

      <Pagination
        currentPage={page}
        totalCount={totalCount}
        onPageChange={setPage}
      />

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteId !== null}
        onClose={() => setDeleteId(null)}
        title="Remove Bookmark"
      >
        <p className="text-gray-600 mb-4">
          Are you sure you want to remove this bookmark?
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
            {deleteMutation.isPending ? 'Removing...' : 'Remove'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}

function BookmarkCard({
  bookmark,
  isAuthenticated,
  onDelete,
}: {
  bookmark: Bookmark
  isAuthenticated: boolean
  onDelete: () => void
}) {
  if (bookmark.bookmark_type === 'paper' && bookmark.paper) {
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="info">Paper</Badge>
              {bookmark.paper.subject_name && (
                <Badge variant="secondary">{bookmark.paper.subject_name}</Badge>
              )}
              {bookmark.paper.year > 0 && (
                <span className="text-sm text-gray-500">{bookmark.paper.year}</span>
              )}
            </div>
            <p className="text-gray-900 font-medium mb-1">{bookmark.paper.title}</p>
            {bookmark.note && (
              <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                <span className="font-medium">Note:</span> {bookmark.note}
              </div>
            )}
            <div className="mt-2 flex items-center gap-3">
              <Link to={`/papers/${bookmark.paper.id}`}>
                <Button variant="secondary" size="sm">View Paper</Button>
              </Link>
              <span className="text-xs text-gray-500">
                Saved {new Date(bookmark.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-50">
            Remove
          </Button>
        </div>
      </Card>
    )
  }

  if (bookmark.bookmark_type === 'resource' && bookmark.resource) {
    return (
      <Card className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="success">Resource</Badge>
              {bookmark.resource.type_display && (
                <Badge variant="secondary">{bookmark.resource.type_display}</Badge>
              )}
            </div>
            <p className="text-gray-900 font-medium mb-1">{bookmark.resource.title}</p>
            {bookmark.note && (
              <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
                <span className="font-medium">Note:</span> {bookmark.note}
              </div>
            )}
            <div className="mt-2 flex items-center gap-3">
              {bookmark.resource.slug && (
                <Link to={`/library/${bookmark.resource.slug}`}>
                  <Button variant="secondary" size="sm">Read</Button>
                </Link>
              )}
              <span className="text-xs text-gray-500">
                Saved {new Date(bookmark.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-red-600 hover:bg-red-50">
            Remove
          </Button>
        </div>
      </Card>
    )
  }

  // Default: question bookmark
  const question = bookmark.question
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="info">{question?.type_display || 'Question'}</Badge>
            {question && (
              <span className="text-sm text-gray-500">
                Q{question.question_number} · {question.marks} marks
              </span>
            )}
            {question?.topic && (
              <Badge variant="secondary">{question.topic}</Badge>
            )}
          </div>

          <p className="text-gray-900 mb-2">{question?.question_text || 'Saved question'}</p>

          {bookmark.note && (
            <div className="mt-2 p-2 bg-yellow-50 rounded text-sm text-yellow-800">
              <span className="font-medium">Note:</span> {bookmark.note}
            </div>
          )}

          <div className="mt-2 text-xs text-gray-500">
            Saved {new Date(bookmark.created_at).toLocaleDateString()}
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onDelete}
          className="text-red-600 hover:bg-red-50"
        >
          Remove
        </Button>
      </div>
    </Card>
  )
}
