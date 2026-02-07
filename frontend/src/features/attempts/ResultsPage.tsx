import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle, Clock, Award, Target, Eye, FileText, Pause, BarChart3, ShieldCheck, ShieldAlert, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, MathText } from '@/components/ui'
import { attemptsApi, type Answer } from '@/lib/api'
import { formatTime, formatPercentage, getScoreColor, getScoreBgColor, cn } from '@/lib/utils'

interface ExtendedAnswer extends Answer {
  time_spent_seconds?: number
  time_spent_formatted?: string
  view_count?: number
  pdf_reference_clicks?: number
}

interface ExtendedAttempt {
  id: number
  paper: any
  status: string
  started_at: string
  submitted_at: string | null
  marked_at: string | null
  total_score: number
  percentage: number
  time_spent_seconds: number
  time_spent_formatted?: string
  total_pause_time_seconds?: number
  total_pause_time_formatted?: string
  active_time_seconds?: number
  active_time_formatted?: string
  questions_viewed?: number[]
  pdf_views?: number
  pdf_last_page_viewed?: number
  answers: ExtendedAnswer[]
}

export function ResultsPage() {
  const { paperId, attemptId } = useParams<{ paperId: string; attemptId: string }>()
  const navigate = useNavigate()

  const { data: results, isLoading } = useQuery({
    queryKey: ['results', attemptId],
    queryFn: () => attemptsApi.getResults(parseInt(attemptId!)),
    enabled: !!attemptId,
  })

  const attempt = results?.data as ExtendedAttempt | undefined

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600" />
      </div>
    )
  }

  if (!attempt) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Results not found</p>
      </div>
    )
  }

  const correctCount = attempt.answers.filter((a: Answer) => a.is_correct).length
  const totalQuestions = attempt.answers.length
  const questionsViewed = attempt.questions_viewed?.length || totalQuestions

  // Find the question with most time spent
  const sortedByTime = [...attempt.answers].sort(
    (a, b) => (b.time_spent_seconds || 0) - (a.time_spent_seconds || 0)
  )
  const mostTimeQuestion = sortedByTime[0]

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back button */}
      <Button variant="ghost" onClick={() => navigate('/dashboard')}>
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Dashboard
      </Button>

      {/* Score summary */}
      <Card className={cn('text-center', getScoreBgColor(attempt.percentage))}>
        <div className="py-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{attempt.paper.title}</h1>
          <p className="text-gray-500 mb-6">
            {attempt.paper.syllabus.subject_name} - {attempt.paper.syllabus.board_name}
          </p>

          <div className={cn('text-6xl font-bold mb-2', getScoreColor(attempt.percentage))}>
            {formatPercentage(attempt.percentage)}
          </div>
          <p className="text-gray-600">
            {attempt.total_score} / {attempt.paper.total_marks} marks
          </p>
        </div>
      </Card>

      {/* Primary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
            <Target className="h-4 w-4" />
            <span className="text-sm">Correct</span>
          </div>
          <p className="text-2xl font-bold text-success-600">
            {correctCount} / {totalQuestions}
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-sm">Time Spent</span>
          </div>
          <p className="text-2xl font-bold">
            {attempt.time_spent_formatted || formatTime(attempt.time_spent_seconds)}
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex items-center justify-center gap-2 text-gray-500 mb-1">
            <Award className="h-4 w-4" />
            <span className="text-sm">Grade</span>
          </div>
          <p className={cn('text-2xl font-bold', getScoreColor(attempt.percentage))}>
            {attempt.percentage >= 80
              ? 'A'
              : attempt.percentage >= 60
              ? 'B'
              : attempt.percentage >= 40
              ? 'C'
              : 'D'}
          </p>
        </Card>
      </div>

      {/* Detailed Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Session Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Active Time */}
            {attempt.active_time_formatted && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Clock className="h-3 w-3" />
                  Active Time
                </div>
                <p className="text-lg font-semibold">{attempt.active_time_formatted}</p>
              </div>
            )}

            {/* Pause Time */}
            {(attempt.total_pause_time_seconds || 0) > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Pause className="h-3 w-3" />
                  Pause Time
                </div>
                <p className="text-lg font-semibold">{attempt.total_pause_time_formatted}</p>
              </div>
            )}

            {/* Questions Viewed */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Eye className="h-3 w-3" />
                Questions Viewed
              </div>
              <p className="text-lg font-semibold">{questionsViewed} / {totalQuestions}</p>
            </div>

            {/* PDF Views */}
            {(attempt.pdf_views || 0) > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <FileText className="h-3 w-3" />
                  PDF Views
                </div>
                <p className="text-lg font-semibold">{attempt.pdf_views}</p>
              </div>
            )}

            {/* Avg Time Per Question */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                <Clock className="h-3 w-3" />
                Avg Time/Question
              </div>
              <p className="text-lg font-semibold">
                {formatTime(Math.floor(attempt.time_spent_seconds / totalQuestions))}
              </p>
            </div>

            {/* Most Time Spent Question */}
            {mostTimeQuestion && mostTimeQuestion.time_spent_seconds && mostTimeQuestion.time_spent_seconds > 0 && (
              <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                <div className="flex items-center gap-2 text-gray-500 text-xs mb-1">
                  <Clock className="h-3 w-3" />
                  Most Time Spent
                </div>
                <p className="text-lg font-semibold">
                  Q{mostTimeQuestion.question.question_number} ({mostTimeQuestion.time_spent_formatted})
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Detailed results */}
      <Card>
        <CardHeader>
          <CardTitle>Detailed Results</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Confidence info */}
          {attempt.answers.some((a: ExtendedAnswer) => a.ai_marked && a.confidence_level) && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2 text-sm text-blue-700">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">About AI Confidence Levels</p>
                <p className="mt-1 text-blue-600">
                  <span className="text-green-700 font-medium">High</span>: Marking scheme available, answer clearly matched.{' '}
                  <span className="text-yellow-700 font-medium">Medium</span>: No marking scheme or partial match.{' '}
                  <span className="text-red-700 font-medium">Low</span>: AI is uncertain - verify with your teacher.
                </p>
              </div>
            </div>
          )}
          <div className="space-y-4">
            {attempt.answers.map((answer: ExtendedAnswer, index: number) => (
              <div
                key={answer.id}
                className={cn(
                  'p-4 rounded-lg border',
                  answer.is_correct ? 'border-success-200 bg-success-50' : 'border-danger-200 bg-danger-50'
                )}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    {answer.is_correct ? (
                      <CheckCircle className="h-5 w-5 text-success-600" />
                    ) : (
                      <XCircle className="h-5 w-5 text-danger-600" />
                    )}
                    <span className="font-medium">
                      Question {answer.question.question_number}
                    </span>
                    <Badge variant={answer.is_correct ? 'success' : 'danger'}>
                      {answer.score} / {answer.question.marks} marks
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {answer.time_spent_seconds && answer.time_spent_seconds > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {answer.time_spent_formatted}
                      </span>
                    )}
                    {answer.view_count && answer.view_count > 1 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {answer.view_count}x viewed
                      </span>
                    )}
                    {answer.pdf_reference_clicks && answer.pdf_reference_clicks > 0 && (
                      <span className="text-xs text-gray-500 flex items-center gap-1">
                        <FileText className="h-3 w-3" />
                        {answer.pdf_reference_clicks}x PDF
                      </span>
                    )}
                    <Badge>{answer.question.type_display}</Badge>
                  </div>
                </div>

                <div className="mb-3">
                  <MathText text={answer.question.question_text} as="div" className="text-gray-700" />
                </div>

                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-500">Your answer: </span>
                    <span className="text-gray-700">
                      {answer.selected_option || answer.answer_text || 'No answer provided'}
                    </span>
                  </div>

                  {answer.feedback && (
                    <div className="mt-3 p-3 rounded-lg bg-white">
                      <span className="font-medium text-gray-700">Feedback: </span>
                      <p className="text-gray-600 mt-1 whitespace-pre-line">{answer.feedback}</p>
                    </div>
                  )}

                  {answer.ai_marked && (
                    <div className="flex items-center gap-2 mt-2">
                      <p className="text-xs text-gray-400">Marked by AI</p>
                      {answer.confidence_level && (
                        <span className={cn(
                          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium',
                          answer.confidence_level === 'high' && 'bg-green-100 text-green-700',
                          answer.confidence_level === 'medium' && 'bg-yellow-100 text-yellow-700',
                          answer.confidence_level === 'low' && 'bg-red-100 text-red-700',
                        )}>
                          {answer.confidence_level === 'high' && <ShieldCheck className="h-3 w-3" />}
                          {answer.confidence_level === 'medium' && <ShieldAlert className="h-3 w-3" />}
                          {answer.confidence_level === 'low' && <ShieldAlert className="h-3 w-3" />}
                          {answer.confidence_level === 'high' && 'High confidence'}
                          {answer.confidence_level === 'medium' && 'Medium confidence'}
                          {answer.confidence_level === 'low' && 'Low confidence - verify with teacher'}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Time breakdown by question */}
      {attempt.answers.some(a => (a.time_spent_seconds || 0) > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Time Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attempt.answers.map((answer: ExtendedAnswer) => {
                const percentage = attempt.time_spent_seconds > 0
                  ? ((answer.time_spent_seconds || 0) / attempt.time_spent_seconds) * 100
                  : 0
                return (
                  <div key={answer.id} className="flex items-center gap-3">
                    <span className="text-sm text-gray-600 w-12">Q{answer.question.question_number}</span>
                    <div className="flex-1 h-6 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          answer.is_correct ? 'bg-success-400' : 'bg-danger-400'
                        )}
                        style={{ width: `${Math.max(percentage, 1)}%` }}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-16 text-right">
                      {answer.time_spent_formatted || '0:00'}
                    </span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-4">
        <Button variant="secondary" className="flex-1" onClick={() => navigate('/papers')}>
          Try Another Paper
        </Button>
        <Button
          className="flex-1"
          onClick={() => navigate(`/papers/${paperId}/attempt`)}
        >
          Retry This Paper
        </Button>
      </div>
    </div>
  )
}
