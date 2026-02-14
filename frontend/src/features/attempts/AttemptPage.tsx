import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Clock, ChevronLeft, ChevronRight, Send, Bookmark, FileText, AlertCircle, Pause, Play, Eye } from 'lucide-react'
import { Card, Button, Badge, Modal, PDFViewerModal, MathText } from '@/components/ui'
import type { SourcePosition } from '@/components/ui/PDFViewer'
import { examsApi, attemptsApi, type Question, type TrackingData } from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useGuestStore } from '@/stores/guestStore'
import { useAttemptSessionStore } from '@/stores/attemptSessionStore'
import { useUIStore } from '@/stores/uiStore'
import { AuthPromptModal } from '@/components/auth/AuthPromptModal'
import { CheckCircle, XCircle } from 'lucide-react'

export function AttemptPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const paperId = parseInt(id!)

  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const {
    addAnswer: addGuestAnswer,
    addBookmark: addGuestBookmark,
    removeBookmark: removeGuestBookmark,
    isBookmarked: isGuestBookmarked,
    shouldShowAuthModal,
    dismissAuthModal,
  } = useGuestStore()

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<number, { text: string; option: string }>>({})
  const [attemptId, setAttemptId] = useState<number | null>(null)
  const [totalTimeSpent, setTotalTimeSpent] = useState(0)
  const [showSubmitModal, setShowSubmitModal] = useState(false)
  const [showGuestSubmitModal, setShowGuestSubmitModal] = useState(false)
  const [showPDFViewer, setShowPDFViewer] = useState(false)
  const [pdfInitialPage, setPdfInitialPage] = useState(1)
  const [pdfInitialPosition, setPdfInitialPosition] = useState<SourcePosition>('')
  const [pdfQuestionNumber, setPdfQuestionNumber] = useState<string>('')
  const [isPaused, setIsPaused] = useState(false)

  // Per-question time tracking - stored as accumulated seconds
  const [questionTimes, setQuestionTimes] = useState<Record<number, number>>({})
  const [currentQuestionTime, setCurrentQuestionTime] = useState(0)
  const questionStartTime = useRef<number>(Date.now())
  const lastTrackingTime = useRef<number>(Date.now())

  // Fetch paper details
  const { data: paper, isLoading: paperLoading } = useQuery({
    queryKey: ['paper', paperId],
    queryFn: () => examsApi.getPaper(paperId),
  })

  // Create attempt on mount (only for authenticated users)
  const createAttemptMutation = useMutation({
    mutationFn: () => attemptsApi.createAttempt(paperId),
    onSuccess: (response) => {
      const newAttemptId = response.data.id
      setAttemptId(newAttemptId)

      // A8: If pendingSync, bulk sync guest answers to the new attempt
      const session = useAttemptSessionStore.getState()
      if (session.pendingSync && session.paperId === paperId) {
        const syncData = Object.entries(session.answers).map(([qId, ans]) => ({
          question_id: parseInt(qId),
          answer_text: ans.text,
          selected_option: ans.option,
        }))
        const qTimes: Record<string, number> = {}
        for (const [qId, time] of Object.entries(session.questionTimes)) {
          qTimes[qId] = time
        }
        syncAnswersMutation.mutate({
          attemptId: newAttemptId,
          answers: syncData,
          time_spent_seconds: session.totalTimeSpent,
          question_times: qTimes,
        })
      }
    },
  })

  // Save answer mutation (for authenticated users)
  const saveAnswerMutation = useMutation({
    mutationFn: (data: { question: number; answer_text?: string; selected_option?: string }) =>
      attemptsApi.saveAnswer({ attempt: attemptId!, ...data }),
  })

  // Tracking mutation
  const trackMutation = useMutation({
    mutationFn: (data: TrackingData) =>
      attemptsApi.trackActivity(attemptId!, data),
  })

  // Submit attempt mutation — fire-and-forget, navigate immediately
  const submitAttemptMutation = useMutation({
    mutationFn: () => attemptsApi.submitAttempt(attemptId!, totalTimeSpent),
  })

  // Sync mutation for bulk syncing guest answers after registration
  const syncAnswersMutation = useMutation({
    mutationFn: (data: { attemptId: number; answers: { question_id: number; answer_text: string; selected_option: string }[]; time_spent_seconds: number; question_times: Record<string, number> }) =>
      attemptsApi.syncAnswers(data.attemptId, {
        answers: data.answers,
        time_spent_seconds: data.time_spent_seconds,
        question_times: data.question_times,
      }),
    onSuccess: () => {
      useAttemptSessionStore.getState().clearSession()
      useGuestStore.getState().clearGuestData()
    },
  })

  const questions: Question[] = paper?.data?.questions || []
  const currentQuestion = questions[currentQuestionIndex]

  // Restore state from session store on mount if pendingSync
  const hasRestoredRef = useRef(false)
  useEffect(() => {
    if (hasRestoredRef.current) return
    const session = useAttemptSessionStore.getState()
    if (session.pendingSync && session.paperId === paperId) {
      hasRestoredRef.current = true
      setAnswers(session.answers)
      setCurrentQuestionIndex(session.currentQuestionIndex)
      setTotalTimeSpent(session.totalTimeSpent)
      setQuestionTimes(session.questionTimes)
      setIsPaused(session.isPaused)
    }
  }, [paperId])

  // Create attempt on mount (only if authenticated)
  useEffect(() => {
    if (isAuthenticated) {
      createAttemptMutation.mutate()
    }
  }, [isAuthenticated])

  // Main timer - updates every second when not paused
  useEffect(() => {
    if (isPaused) return

    const timer = setInterval(() => {
      // Update total time
      setTotalTimeSpent((prev) => prev + 1)

      // Update current question time
      setCurrentQuestionTime((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(timer)
  }, [isPaused])

  // Send tracking data to server every 10 seconds
  useEffect(() => {
    if (!isAuthenticated || !attemptId || isPaused || !currentQuestion) return

    const trackingInterval = setInterval(() => {
      const now = Date.now()
      const timeSinceLastTrack = Math.floor((now - lastTrackingTime.current) / 1000)

      if (timeSinceLastTrack >= 10) {
        trackMutation.mutate({
          action: 'view_question',
          question_id: currentQuestion.id,
          question_index: currentQuestionIndex,
          time_on_previous_seconds: timeSinceLastTrack,
          previous_question_id: currentQuestion.id,
        })
        lastTrackingTime.current = now
      }
    }, 10000)

    return () => clearInterval(trackingInterval)
  }, [attemptId, isAuthenticated, isPaused, currentQuestion, currentQuestionIndex])

  // A4: Mirror attempt state to session store for guest users
  useEffect(() => {
    if (!isAuthenticated && paperId) {
      useAttemptSessionStore.getState().saveSession({
        paperId,
        answers,
        currentQuestionIndex,
        totalTimeSpent,
        questionTimes,
        isPaused,
      })
    }
  }, [isAuthenticated, paperId, answers, currentQuestionIndex, totalTimeSpent, questionTimes, isPaused])

  // Save question time when changing questions
  const saveCurrentQuestionTime = useCallback(() => {
    if (!currentQuestion) return

    const questionId = currentQuestion.id
    setQuestionTimes((prev) => ({
      ...prev,
      [questionId]: (prev[questionId] || 0) + currentQuestionTime,
    }))

    // Send to server if authenticated
    if (isAuthenticated && attemptId && currentQuestionTime > 0) {
      trackMutation.mutate({
        action: 'view_question',
        question_id: questionId,
        question_index: currentQuestionIndex,
        time_on_previous_seconds: currentQuestionTime,
        previous_question_id: questionId,
      })
    }
  }, [currentQuestion, currentQuestionTime, attemptId, isAuthenticated, currentQuestionIndex])

  // Handle question navigation
  const handleQuestionChange = useCallback((newIndex: number) => {
    if (newIndex < 0 || newIndex >= questions.length) return

    // Save time for current question before switching
    saveCurrentQuestionTime()

    // Reset timer for new question
    setCurrentQuestionTime(0)
    questionStartTime.current = Date.now()
    lastTrackingTime.current = Date.now()

    setCurrentQuestionIndex(newIndex)

    // Track the navigation
    if (isAuthenticated && attemptId) {
      const newQuestion = questions[newIndex]
      trackMutation.mutate({
        action: 'view_question',
        question_id: newQuestion.id,
        question_index: newIndex,
      })
    }
  }, [questions, saveCurrentQuestionTime, attemptId, isAuthenticated])

  const handleAnswerChange = useCallback(
    (questionId: number, text: string, option: string) => {
      setAnswers((prev) => ({
        ...prev,
        [questionId]: { text, option },
      }))

      if (isAuthenticated && attemptId) {
        saveAnswerMutation.mutate({
          question: questionId,
          answer_text: text,
          selected_option: option,
        })
      } else {
        addGuestAnswer({
          questionId,
          answerText: text,
          selectedOption: option,
          answeredAt: new Date().toISOString(),
        })
      }
    },
    [attemptId, isAuthenticated]
  )

  const handleBookmarkToggle = (questionId: number) => {
    if (isGuestBookmarked(questionId)) {
      removeGuestBookmark(questionId)
    } else {
      addGuestBookmark({
        questionId,
        bookmarkType: 'question',
        folder: 'default',
        createdAt: new Date().toISOString(),
      })
    }
  }

  // Handle pause/resume
  const handlePauseToggle = useCallback(() => {
    if (isPaused) {
      // Resume - reset start times
      questionStartTime.current = Date.now()
      lastTrackingTime.current = Date.now()
      if (isAuthenticated && attemptId) {
        trackMutation.mutate({ action: 'resume' })
      }
    } else {
      // Pause - save current question time
      saveCurrentQuestionTime()
      setCurrentQuestionTime(0)
      if (isAuthenticated && attemptId) {
        trackMutation.mutate({ action: 'pause' })
      }
    }
    setIsPaused(!isPaused)
  }, [isPaused, attemptId, isAuthenticated, saveCurrentQuestionTime])

  // Track PDF view with position
  const handlePDFView = useCallback((question?: Question) => {
    const page = question?.source_page || 1
    const position = (question?.source_position as SourcePosition) || ''
    const questionNum = question?.question_number || ''

    setPdfInitialPage(page)
    setPdfInitialPosition(position)
    setPdfQuestionNumber(questionNum)
    setShowPDFViewer(true)

    if (isAuthenticated && attemptId) {
      trackMutation.mutate({
        action: 'view_pdf',
        page_number: page,
        question_id: currentQuestion?.id,
      })
    }
  }, [attemptId, isAuthenticated, currentQuestion])

  // Handle PDF page change for tracking
  const handlePDFPageChange = useCallback((page: number) => {
    if (isAuthenticated && attemptId) {
      trackMutation.mutate({
        action: 'view_pdf',
        page_number: page,
        question_id: currentQuestion?.id,
      })
    }
  }, [attemptId, isAuthenticated, currentQuestion])

  const handleSubmit = () => {
    if (isAuthenticated) {
      // Save final question time
      saveCurrentQuestionTime()

      // Update final time on server
      if (attemptId) {
        trackMutation.mutate({
          action: 'update_time',
          time_spent_seconds: totalTimeSpent,
        })
      }

      // Fire submit in background and navigate immediately
      submitAttemptMutation.mutate()
      navigate(`/papers/${paperId}/marking/${attemptId}`)
    } else {
      setShowSubmitModal(false)
      setShowGuestSubmitModal(true)
    }
  }

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Get total time for a question (accumulated + current)
  const getQuestionTime = (questionId: number) => {
    const accumulated = questionTimes[questionId] || 0
    if (currentQuestion?.id === questionId) {
      return accumulated + currentQuestionTime
    }
    return accumulated
  }

  if (paperLoading || !paper?.data) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        {/* Header bar */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-3">
              <div className="h-5 w-48 bg-gray-200 rounded" />
              <div className="h-3 w-20 bg-gray-200 rounded mt-2" />
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-20 bg-gray-200 rounded-lg" />
              <div className="h-8 w-8 bg-gray-200 rounded-lg" />
              <div className="h-8 w-20 bg-gray-200 rounded-lg" />
            </div>
          </div>
        </div>

        {/* Question navigator */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="h-4 w-32 bg-gray-200 rounded" />
            <div className="h-3 w-24 bg-gray-200 rounded" />
          </div>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-10 h-10 bg-gray-200 rounded-lg" />
            ))}
          </div>
        </Card>

        {/* Question card */}
        <Card className="border-l-4 border-l-gray-200">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="h-5 w-16 bg-gray-200 rounded-full" />
              <div className="h-5 w-20 bg-gray-200 rounded-full" />
            </div>
            <div className="h-4 w-16 bg-gray-200 rounded" />
          </div>
          <div className="mb-6 space-y-2">
            <div className="h-5 w-32 bg-gray-200 rounded" />
            <div className="h-4 w-full bg-gray-200 rounded" />
            <div className="h-4 w-5/6 bg-gray-200 rounded" />
            <div className="h-4 w-3/4 bg-gray-200 rounded" />
          </div>
          <div className="h-32 bg-gray-100 rounded-lg" />
        </Card>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <div className="h-10 w-28 bg-gray-200 rounded-lg" />
          <div className="h-10 w-20 bg-gray-200 rounded-lg" />
        </div>
      </div>
    )
  }

  const answeredCount = Object.keys(answers).length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Guest banner */}
      {!isAuthenticated && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-blue-800 font-medium text-sm sm:text-base">You're practicing as a guest</p>
            <p className="text-blue-600 text-xs sm:text-sm">
              Sign up to save your progress and get AI feedback
            </p>
          </div>
          <Button size="sm" className="self-start sm:self-auto" onClick={() => useUIStore.getState().openAuthModal('register')}>
            Sign Up Free
          </Button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="min-w-0 flex-1 mr-3">
            <h1 className="font-bold text-sm sm:text-lg truncate">{paper.data.title}</h1>
            <p className="text-xs sm:text-sm text-gray-500">
              Q {currentQuestionIndex + 1} / {questions.length}
            </p>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-3">
            {/* Timer with pause state */}
            <div className={cn(
              "flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-sm",
              isPaused ? "bg-yellow-100 text-yellow-700" : "text-gray-600"
            )}>
              <Clock className="h-4 w-4" />
              <span className="font-mono font-medium">{formatTime(totalTimeSpent)}</span>
            </div>
            {/* Pause/Resume button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePauseToggle}
              title={isPaused ? "Resume" : "Pause"}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </Button>
            {paper.data.pdf_url && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handlePDFView(currentQuestion)}
                title="View Original PDF"
              >
                <FileText className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">View PDF</span>
              </Button>
            )}
            <Button size="sm" onClick={() => setShowSubmitModal(true)}>
              <Send className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Submit</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Question navigation */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-gray-500">Question Navigator</p>
          <p className="text-xs text-gray-400 font-mono">
            This question: {formatTime(currentQuestion ? getQuestionTime(currentQuestion.id) : 0)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {questions.map((q, index) => (
            <button
              key={q.id}
              onClick={() => handleQuestionChange(index)}
              className={cn(
                'w-10 h-10 rounded-lg font-medium text-sm transition-colors relative',
                currentQuestionIndex === index
                  ? 'bg-primary-600 text-white'
                  : answers[q.id]
                  ? 'bg-success-100 text-success-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )}
              title={`Q${index + 1}${q.source_page ? ` - Page ${q.source_page}` : ''} - ${formatTime(getQuestionTime(q.id))}`}
            >
              {index + 1}
              {/* Indicator for questions with diagrams */}
              {q.has_diagram && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-amber-400 rounded-full" />
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-success-100 rounded" /> Answered
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 bg-primary-600 rounded" /> Current
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 bg-amber-400 rounded-full" /> Has diagram
          </span>
        </div>
      </Card>

      {/* Paused overlay */}
      {isPaused && (
        <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center">
          <Card className="p-4 sm:p-8 text-center max-w-sm sm:max-w-md mx-4">
            <Pause className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Exam Paused</h2>
            <p className="text-gray-600 mb-4">
              Your timer is paused. Click resume when you're ready to continue.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Time spent: {formatTime(totalTimeSpent)}
            </p>
            <Button onClick={handlePauseToggle} className="w-full">
              <Play className="h-4 w-4 mr-2" />
              Resume
            </Button>
          </Card>
        </div>
      )}

      {/* Question */}
      {currentQuestion && (
        <Card className={cn(
          'border-l-4',
          currentQuestion.question_type === 'mcq' && 'border-l-blue-400',
          currentQuestion.question_type === 'short_answer' && 'border-l-green-400',
          currentQuestion.question_type === 'long_answer' && 'border-l-purple-400',
          currentQuestion.question_type === 'structured' && 'border-l-amber-400',
          currentQuestion.question_type === 'essay' && 'border-l-rose-400',
        )}>
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="info">{currentQuestion.type_display}</Badge>
              {currentQuestion.topic_text && (
                <Badge variant="secondary">{currentQuestion.topic_text}</Badge>
              )}
              {currentQuestion.source_page && (
                <Badge
                  variant="secondary"
                  className="cursor-pointer hover:bg-gray-200"
                  onClick={() => handlePDFView(currentQuestion)}
                >
                  <Eye className="h-3 w-3 mr-1" />
                  Page {currentQuestion.source_page}
                  {currentQuestion.source_position && ` (${currentQuestion.source_position})`}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => handleBookmarkToggle(currentQuestion.id)}
                className={cn(
                  'p-1.5 rounded-lg transition-colors',
                  isGuestBookmarked(currentQuestion.id)
                    ? 'text-yellow-500 bg-yellow-50'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                )}
              >
                <Bookmark
                  className="h-5 w-5"
                  fill={isGuestBookmarked(currentQuestion.id) ? 'currentColor' : 'none'}
                />
              </button>
              <span className="text-sm text-gray-500">{currentQuestion.marks} marks</span>
            </div>
          </div>

          <div className="mb-6">
            <h2 className="text-lg font-medium mb-2">
              Question {currentQuestion.question_number}
            </h2>
            <MathText text={currentQuestion.question_text} as="div" className="text-gray-700" />
            {currentQuestion.image && (
              <img
                src={currentQuestion.image}
                alt="Question diagram"
                className="mt-4 max-w-full rounded-lg"
              />
            )}
            {/* Diagram notice */}
            {(currentQuestion.has_diagram ||
              currentQuestion.question_text?.toLowerCase().includes('diagram') ||
              currentQuestion.question_text?.toLowerCase().includes('figure') ||
              currentQuestion.question_text?.toLowerCase().includes('graph') ||
              currentQuestion.question_text?.toLowerCase().includes('table') ||
              currentQuestion.question_text?.toLowerCase().includes('structure')) &&
              !currentQuestion.image &&
              paper.data.pdf_url && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-amber-800 font-medium">
                      This question references a diagram or figure
                    </p>
                    {currentQuestion.diagram_description && (
                      <p className="text-sm text-amber-700 mt-1">
                        {currentQuestion.diagram_description}
                      </p>
                    )}
                    <p className="text-sm text-amber-700 mt-1">
                      {currentQuestion.source_page
                        ? `View page ${currentQuestion.source_page}${currentQuestion.source_position ? ` (${currentQuestion.source_position} section)` : ''} of the original PDF.`
                        : 'Click "View PDF" to see the original paper with all diagrams.'}
                    </p>
                    <Button
                      size="sm"
                      variant="secondary"
                      className="mt-2"
                      onClick={() => handlePDFView(currentQuestion)}
                    >
                      <FileText className="h-4 w-4 mr-1" />
                      {currentQuestion.source_page
                        ? `View Page ${currentQuestion.source_page}`
                        : 'View Original PDF'}
                    </Button>
                  </div>
                </div>
              )}
          </div>

          {/* Answer input */}
          {currentQuestion.question_type === 'mcq' && currentQuestion.options ? (
            <div className="space-y-3">
              {currentQuestion.options.map((option) => (
                <label
                  key={option.key}
                  className={cn(
                    'flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors',
                    answers[currentQuestion.id]?.option === option.key
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  )}
                >
                  <input
                    type="radio"
                    name={`question-${currentQuestion.id}`}
                    value={option.key}
                    checked={answers[currentQuestion.id]?.option === option.key}
                    onChange={(e) =>
                      handleAnswerChange(currentQuestion.id, '', e.target.value)
                    }
                    className="w-4 h-4 text-primary-600"
                  />
                  <span className="font-medium">{option.key}.</span>
                  <MathText text={option.text} />
                </label>
              ))}
            </div>
          ) : (
            <div>
              <textarea
                className={cn(
                  "input",
                  currentQuestion.question_type === 'essay' ? 'min-h-[200px] sm:min-h-[300px]' : 'min-h-[120px] sm:min-h-[200px]'
                )}
                placeholder={
                  currentQuestion.question_type === 'essay'
                    ? 'Write your essay here...'
                    : currentQuestion.question_type === 'structured'
                    ? 'Answer each part clearly, labelling (a), (b), (c) etc...'
                    : 'Type your answer here...'
                }
                value={answers[currentQuestion.id]?.text || ''}
                onChange={(e) =>
                  handleAnswerChange(currentQuestion.id, e.target.value, '')
                }
              />
              {currentQuestion.question_type === 'essay' && (
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {(answers[currentQuestion.id]?.text || '').split(/\s+/).filter(Boolean).length} words
                </p>
              )}
            </div>
          )}
        </Card>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <Button
          variant="secondary"
          onClick={() => handleQuestionChange(currentQuestionIndex - 1)}
          disabled={currentQuestionIndex === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-2" />
          Previous
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleQuestionChange(currentQuestionIndex + 1)}
          disabled={currentQuestionIndex === questions.length - 1}
        >
          Next
          <ChevronRight className="h-4 w-4 ml-2" />
        </Button>
      </div>

      {/* Submit confirmation modal */}
      <Modal
        isOpen={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        title="Submit Paper"
      >
        <div className="space-y-4">
          <p>Are you sure you want to submit your paper?</p>
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Questions answered:</span>
              <span className="font-medium">
                {answeredCount} / {questions.length}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time spent:</span>
              <span className="font-medium">{formatTime(totalTimeSpent)}</span>
            </div>
            {questions.length - answeredCount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Unanswered questions:</span>
                <span className="font-medium">{questions.length - answeredCount}</span>
              </div>
            )}
          </div>
          {questions.length - answeredCount > 0 && (
            <p className="text-sm text-amber-600">
              You have {questions.length - answeredCount} unanswered question(s).
            </p>
          )}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowSubmitModal(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitAttemptMutation.isPending}
            >
              {submitAttemptMutation.isPending ? 'Submitting...' : 'Submit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Guest submit modal - shows limited results */}
      <Modal
        isOpen={showGuestSubmitModal}
        onClose={() => setShowGuestSubmitModal(false)}
        title="Your Results (Preview)"
      >
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500">Questions answered:</span>
              <span className="font-medium">{answeredCount} / {questions.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time spent:</span>
              <span className="font-medium">{formatTime(totalTimeSpent)}</span>
            </div>
          </div>

          {/* MCQ results - client-side check */}
          {questions.filter(q => q.question_type === 'mcq' && answers[q.id]).length > 0 && (
            <div>
              <h4 className="font-medium text-gray-700 mb-2">Multiple Choice Results</h4>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {questions
                  .filter(q => q.question_type === 'mcq' && answers[q.id])
                  .map(q => {
                    const userAnswer = answers[q.id]?.option
                    const isCorrect = userAnswer === (q as any).correct_answer
                    return (
                      <div key={q.id} className={cn(
                        'flex items-center justify-between p-2 rounded text-sm',
                        isCorrect ? 'bg-green-50' : 'bg-red-50'
                      )}>
                        <span className="font-medium">Q{q.question_number}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-600">Your answer: {userAnswer}</span>
                          {isCorrect ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}

          {/* Written answers notice */}
          {questions.filter(q => q.question_type !== 'mcq' && answers[q.id]).length > 0 && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
              You have {questions.filter(q => q.question_type !== 'mcq' && answers[q.id]).length} written answer(s).
              Register to get AI-powered feedback on these.
            </div>
          )}

          {/* CTA */}
          <div className="flex flex-col gap-3 pt-2">
            <Button
              className="w-full"
              onClick={() => {
                setShowGuestSubmitModal(false)
                useUIStore.getState().openAuthModal('register')
              }}
            >
              Create Free Account to See Full Results
            </Button>
            <Button
              variant="secondary"
              onClick={() => setShowGuestSubmitModal(false)}
              className="w-full"
            >
              Continue Practicing
            </Button>
          </div>
        </div>
      </Modal>

      {/* Auth prompt modal */}
      <AuthPromptModal isOpen={shouldShowAuthModal} onClose={dismissAuthModal} />

      {/* PDF Viewer Modal */}
      {paper.data.pdf_url && (
        <PDFViewerModal
          isOpen={showPDFViewer}
          onClose={() => setShowPDFViewer(false)}
          url={paper.data.pdf_url}
          title={paper.data.title}
          initialPage={pdfInitialPage}
          initialPosition={pdfInitialPosition}
          questionNumber={pdfQuestionNumber}
          onPageChange={handlePDFPageChange}
        />
      )}
    </div>
  )
}
