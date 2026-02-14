import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle, XCircle, Clock, Award, Target, Eye, FileText, Pause, BarChart3, ShieldCheck, ShieldAlert, Info, Download, Loader2 } from 'lucide-react'
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

  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  const generatePdf = useCallback(async () => {
    if (!attempt) return
    setIsGeneratingPdf(true)
    try {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF({ unit: 'mm', format: 'a4' })
      const pw = doc.internal.pageSize.getWidth()
      const margin = 16
      const contentWidth = pw - margin * 2
      let y = 18

      const addPage = () => { doc.addPage(); y = 18 }
      const checkPage = (need: number) => { if (y + need > 275) addPage() }

      // --- Header ---
      doc.setFillColor(79, 70, 229) // primary-600
      doc.rect(0, 0, pw, 36, 'F')
      doc.setTextColor(255, 255, 255)
      doc.setFontSize(18)
      doc.setFont('helvetica', 'bold')
      doc.text('ExamRevise — Results Report', pw / 2, 14, { align: 'center' })
      doc.setFontSize(11)
      doc.setFont('helvetica', 'normal')
      doc.text(attempt.paper.title, pw / 2, 22, { align: 'center' })
      const meta = `${attempt.paper.syllabus?.subject_name || ''} | ${attempt.paper.syllabus?.board_name || ''} | ${new Date(attempt.submitted_at || '').toLocaleDateString()}`
      doc.setFontSize(9)
      doc.text(meta, pw / 2, 29, { align: 'center' })
      y = 44

      // --- Score box ---
      const pct = attempt.percentage ?? 0
      const grade = pct >= 80 ? 'A' : pct >= 60 ? 'B' : pct >= 40 ? 'C' : 'D'
      const scoreColor: [number, number, number] = pct >= 60 ? [22, 163, 74] : pct >= 40 ? [202, 138, 4] : [220, 38, 38]
      doc.setFillColor(249, 250, 251)
      doc.roundedRect(margin, y, contentWidth, 28, 3, 3, 'F')
      doc.setFontSize(28)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(scoreColor[0], scoreColor[1], scoreColor[2])
      doc.text(`${Math.round(pct)}%`, margin + 12, y + 18)
      doc.setFontSize(11)
      doc.setTextColor(55, 65, 81)
      doc.text(`${attempt.total_score} / ${attempt.paper.total_marks} marks`, margin + 50, y + 12)
      doc.text(`Grade: ${grade}`, margin + 50, y + 20)
      const correctCt = attempt.answers.filter((a: Answer) => a.is_correct).length
      doc.text(`${correctCt} / ${attempt.answers.length} correct`, margin + contentWidth - 50, y + 12)
      doc.text(`Time: ${formatTime(attempt.time_spent_seconds)}`, margin + contentWidth - 50, y + 20)
      y += 36

      // --- Per-question results ---
      doc.setFontSize(13)
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(17, 24, 39)
      doc.text('Detailed Results', margin, y)
      y += 8

      attempt.answers.forEach((answer: ExtendedAnswer, idx: number) => {
        checkPage(45)
        const q = answer.question
        const correct = answer.is_correct
        // Question header bar
        doc.setFillColor(correct ? 240 : 254, correct ? 253 : 242, correct ? 244 : 242)
        doc.roundedRect(margin, y, contentWidth, 8, 2, 2, 'F')
        doc.setFontSize(10)
        doc.setFont('helvetica', 'bold')
        doc.setTextColor(correct ? 22 : 220, correct ? 163 : 38, correct ? 74 : 38)
        doc.text(`${correct ? '✓' : '✗'} Q${q.question_number}  —  ${answer.score ?? 0}/${q.marks} marks  (${q.type_display})`, margin + 3, y + 5.5)
        y += 12

        // Question text (wrapped)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(55, 65, 81)
        doc.setFontSize(9)
        const qTextClean = (q.question_text || '').replace(/\$[^$]*\$/g, '[formula]').replace(/\\[a-zA-Z]+\{[^}]*\}/g, '[formula]')
        const qLines = doc.splitTextToSize(qTextClean, contentWidth - 4)
        checkPage(qLines.length * 4 + 20)
        doc.text(qLines, margin + 2, y)
        y += qLines.length * 4 + 2

        // Student answer
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(8.5)
        doc.setTextColor(107, 114, 128)
        doc.text('Your answer:', margin + 2, y)
        doc.setFont('helvetica', 'normal')
        doc.setTextColor(55, 65, 81)
        const ansText = answer.selected_option
          ? answer.selected_option
          : (answer.answer_text || 'No answer provided').replace(/\$[^$]*\$/g, '[formula]').replace(/\\[a-zA-Z]+\{[^}]*\}/g, '[formula]')
        const ansLines = doc.splitTextToSize(ansText, contentWidth - 6)
        y += 4
        checkPage(ansLines.length * 3.5 + 14)
        doc.text(ansLines.slice(0, 4), margin + 4, y) // cap at 4 lines
        y += Math.min(ansLines.length, 4) * 3.5 + 2

        // Feedback
        if (answer.feedback) {
          doc.setFillColor(255, 255, 255)
          doc.setDrawColor(229, 231, 235)
          const fbClean = answer.feedback.replace(/\$[^$]*\$/g, '[formula]').replace(/\\[a-zA-Z]+\{[^}]*\}/g, '[formula]').replace(/\*\*/g, '')
          const fbLines = doc.splitTextToSize(fbClean, contentWidth - 10)
          const fbHeight = Math.min(fbLines.length, 8) * 3.5 + 6
          checkPage(fbHeight + 4)
          doc.roundedRect(margin + 2, y, contentWidth - 4, fbHeight, 2, 2, 'FD')
          doc.setFontSize(8)
          doc.setFont('helvetica', 'italic')
          doc.setTextColor(75, 85, 99)
          doc.text(fbLines.slice(0, 8), margin + 5, y + 4)
          y += fbHeight + 3
        }

        y += 4
      })

      // --- Footer ---
      checkPage(16)
      y += 4
      doc.setDrawColor(209, 213, 219)
      doc.line(margin, y, pw - margin, y)
      y += 6
      doc.setFontSize(8)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(156, 163, 175)
      doc.text('Generated by ExamRevise Zimbabwe — examrevise.co.zw', pw / 2, y, { align: 'center' })
      doc.text(`Report date: ${new Date().toLocaleDateString()}`, pw / 2, y + 4, { align: 'center' })

      // Save
      const filename = `ExamRevise_${attempt.paper.title.replace(/[^a-zA-Z0-9]/g, '_')}_${Math.round(pct)}pct.pdf`
      doc.save(filename)
    } catch (err) {
      console.error('PDF generation failed:', err)
    } finally {
      setIsGeneratingPdf(false)
    }
  }, [attempt])

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-9 w-36 bg-gray-200 rounded-lg" />
        <Card className="text-center py-6">
          <div className="h-6 w-64 bg-gray-200 rounded mx-auto mb-2" />
          <div className="h-4 w-48 bg-gray-200 rounded mx-auto mb-6" />
          <div className="h-16 w-32 bg-gray-200 rounded mx-auto mb-2" />
          <div className="h-4 w-36 bg-gray-200 rounded mx-auto" />
        </Card>
        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <div className="h-4 w-4 bg-gray-200 rounded" />
                <div className="h-4 w-14 bg-gray-200 rounded" />
              </div>
              <div className="h-7 w-20 bg-gray-200 rounded mx-auto" />
            </Card>
          ))}
        </div>
        <Card>
          <div className="mb-4"><div className="h-6 w-36 bg-gray-200 rounded" /></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-lg bg-gray-50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-5 w-5 bg-gray-200 rounded-full" />
                  <div className="h-4 w-24 bg-gray-200 rounded" />
                  <div className="h-5 w-20 bg-gray-200 rounded-full" />
                </div>
                <div className="h-4 w-full bg-gray-200 rounded mb-2" />
                <div className="h-4 w-3/4 bg-gray-200 rounded" />
              </div>
            ))}
          </div>
        </Card>
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
          <h1 className="text-lg sm:text-2xl font-bold text-gray-900 mb-2">{attempt.paper.title}</h1>
          <p className="text-gray-500 mb-6">
            {attempt.paper.syllabus.subject_name} - {attempt.paper.syllabus.board_name}
          </p>

          <div className={cn('text-4xl sm:text-6xl font-bold mb-2', getScoreColor(attempt.percentage))}>
            {formatPercentage(attempt.percentage)}
          </div>
          <p className="text-gray-600">
            {attempt.total_score} / {attempt.paper.total_marks} marks
          </p>
        </div>
      </Card>

      {/* Primary Stats */}
      <div className="grid grid-cols-3 gap-3 sm:gap-4">
        <Card className="text-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-gray-500 mb-1">
            <Target className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Correct</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold text-success-600">
            {correctCount} / {totalQuestions}
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-gray-500 mb-1">
            <Clock className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Time Spent</span>
          </div>
          <p className="text-xl sm:text-2xl font-bold">
            {attempt.time_spent_formatted || formatTime(attempt.time_spent_seconds)}
          </p>
        </Card>

        <Card className="text-center">
          <div className="flex items-center justify-center gap-1.5 sm:gap-2 text-gray-500 mb-1">
            <Award className="h-4 w-4" />
            <span className="text-xs sm:text-sm">Grade</span>
          </div>
          <p className={cn('text-xl sm:text-2xl font-bold', getScoreColor(attempt.percentage))}>
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
                <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
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
                  <div className="flex items-center gap-2 flex-wrap">
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
                    {answer.selected_option ? (
                      <span className="text-gray-700">{answer.selected_option}</span>
                    ) : answer.answer_text ? (
                      <MathText text={answer.answer_text} className="text-gray-700" />
                    ) : (
                      <span className="text-gray-700">No answer provided</span>
                    )}
                  </div>

                  {answer.feedback && (
                    <div className="mt-3 p-3 rounded-lg bg-white">
                      <span className="font-medium text-gray-700">Feedback: </span>
                      <MathText text={answer.feedback} as="div" className="text-gray-600 mt-1" />
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
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="secondary" className="flex-1" onClick={() => navigate('/papers')}>
          Try Another Paper
        </Button>
        <Button
          variant="secondary"
          className="flex-1"
          onClick={generatePdf}
          disabled={isGeneratingPdf}
        >
          {isGeneratingPdf ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Generating PDF...</>
          ) : (
            <><Download className="h-4 w-4 mr-2" />Download Report</>
          )}
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
