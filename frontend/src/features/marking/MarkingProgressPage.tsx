import { useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Mail,
  Sparkles,
  BookOpen,
  MessageSquare,
  AlertTriangle,
  Trophy,
} from 'lucide-react'
import { attemptsApi, type MarkingProgressData, type MarkingMessage } from '@/lib/api'
import { cn } from '@/lib/utils'

function MessageIcon({ type }: { type: MarkingMessage['type'] }) {
  switch (type) {
    case 'info':
      return <BookOpen className="h-4 w-4 text-gray-400 shrink-0" />
    case 'progress':
      return <Loader2 className="h-4 w-4 text-blue-500 shrink-0 animate-spin" />
    case 'result':
      return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
    case 'fun':
      return <Sparkles className="h-4 w-4 text-purple-500 shrink-0" />
    case 'error':
      return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
    case 'complete':
      return <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
    default:
      return <MessageSquare className="h-4 w-4 text-gray-400 shrink-0" />
  }
}

function MessageBubble({ message }: { message: MarkingMessage }) {
  const typeStyles: Record<string, string> = {
    info: 'text-gray-700',
    progress: 'text-blue-700',
    result: 'text-emerald-700 font-medium',
    fun: 'text-purple-600 italic',
    error: 'text-red-700',
    complete: 'text-amber-700 font-semibold',
  }

  return (
    <div className="flex items-start gap-2.5 py-1.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="mt-0.5">
        <MessageIcon type={message.type} />
      </div>
      <p className={cn('text-sm leading-relaxed', typeStyles[message.type] || 'text-gray-700')}>
        {message.text}
      </p>
    </div>
  )
}

function ProgressBarSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4 animate-pulse">
      <div className="flex items-center justify-between mb-2">
        <div className="h-4 w-40 bg-gray-200 rounded" />
        <div className="h-4 w-10 bg-gray-200 rounded" />
      </div>
      <div className="h-3 bg-gray-100 rounded-full" />
      <div className="h-3 w-48 bg-gray-200 rounded mt-2" />
    </div>
  )
}

function FeedSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Live Feed
      </h2>
      <div className="space-y-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-start gap-2.5 py-1.5">
            <div className="w-4 h-4 bg-gray-200 rounded mt-0.5" />
            <div className="h-4 bg-gray-200 rounded" style={{ width: `${60 + i * 10}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export function MarkingProgressPage() {
  const { paperId, attemptId } = useParams<{ paperId: string; attemptId: string }>()
  const navigate = useNavigate()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const hasRedirected = useRef(false)

  const attemptIdNum = parseInt(attemptId!)
  const paperIdNum = parseInt(paperId!)

  const { data: progress, isLoading } = useQuery<MarkingProgressData>({
    queryKey: ['marking-progress', attemptIdNum],
    queryFn: async () => {
      const { data } = await attemptsApi.getMarkingProgress(attemptIdNum)
      return data
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status
      if (status === 'completed' || status === 'failed') return false
      return 2000
    },
    enabled: !!attemptIdNum,
  })

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [progress?.messages?.length])

  // Auto-redirect to results 2s after completion
  useEffect(() => {
    if (progress?.status === 'completed' && !hasRedirected.current) {
      hasRedirected.current = true
      const timer = setTimeout(() => {
        navigate(`/papers/${paperIdNum}/results/${attemptIdNum}`)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [progress?.status, paperIdNum, attemptIdNum, navigate])

  const isComplete = progress?.status === 'completed'
  const isFailed = progress?.status === 'failed'
  const isActive = !isComplete && !isFailed

  const progressPercent =
    progress && progress.total_questions > 0
      ? Math.round((progress.questions_marked / progress.total_questions) * 100)
      : 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header — always rendered (static) */}
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
          {isComplete ? 'Marking Complete!' : isFailed ? 'Marking Failed' : 'Marking Your Paper...'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {isActive && 'AI is reviewing your answers — sit tight!'}
          {isComplete && 'Redirecting to your results...'}
          {isFailed && 'Something went wrong during marking.'}
        </p>
      </div>

      {/* Progress bar — skeleton while loading, then live */}
      {isLoading ? (
        <ProgressBarSkeleton />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {isComplete
                ? 'All questions marked'
                : `${progress?.questions_marked || 0} of ${progress?.total_questions || 0} questions`}
            </span>
            <span className="text-sm font-medium text-primary-600">{progressPercent}%</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700 ease-out',
                isComplete
                  ? 'bg-emerald-500'
                  : isFailed
                    ? 'bg-red-400'
                    : 'bg-primary-500'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          {isActive && progress?.current_question_number && (
            <p className="text-xs text-gray-500 mt-2 truncate">
              Currently marking: Q{progress.current_question_number}
            </p>
          )}
        </div>
      )}

      {/* Score card (shown on complete) */}
      {isComplete && progress?.percentage != null && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4 text-center animate-in fade-in duration-500">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary-50 mb-3">
            <span className="text-3xl font-bold text-primary-700">
              {Math.round(progress.percentage)}%
            </span>
          </div>
          <p className="text-gray-500 text-sm mb-1">
            Redirecting to full results...
          </p>
          <Loader2 className="h-4 w-4 animate-spin text-gray-400 mx-auto" />
        </div>
      )}

      {/* Failed card */}
      {isFailed && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 mb-4 text-center">
          <XCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <p className="text-red-800 font-medium mb-1">Marking encountered an error</p>
          <p className="text-red-600 text-sm mb-4">
            {progress?.error_message || 'Please try submitting your paper again.'}
          </p>
          <Link
            to={`/papers/${paperIdNum}`}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors"
          >
            Back to Paper
          </Link>
        </div>
      )}

      {/* Message feed — skeleton while loading, then live */}
      {isLoading ? (
        <FeedSkeleton />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Live Feed
          </h2>
          <div className="max-h-[400px] overflow-y-auto space-y-0.5 pr-1">
            {(!progress?.messages || progress.messages.length === 0) && (
              <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                <Loader2 className="h-4 w-4 animate-spin" />
                Waiting for marking to start...
              </div>
            )}
            {progress?.messages?.map((msg, idx) => (
              <MessageBubble key={idx} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* "You can leave" hint — static text, always visible when active */}
      {isActive && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-500">
          <Mail className="h-4 w-4" />
          <span>You can leave this page — we'll email you when done.</span>
        </div>
      )}
    </div>
  )
}
