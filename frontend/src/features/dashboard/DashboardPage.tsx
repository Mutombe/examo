import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen, FileText, Clock, Trophy } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Badge, CardSkeleton } from '@/components/ui'
import { examsApi, attemptsApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { formatDate, formatPercentage, getScoreColor } from '@/lib/utils'

export function DashboardPage() {
  const user = useAuthStore((state) => state.user)

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => examsApi.getSubjects(),
  })

  const { data: attempts, isLoading: attemptsLoading } = useQuery({
    queryKey: ['attempts'],
    queryFn: () => attemptsApi.getAttempts(),
  })

  const recentAttempts = attempts?.data?.results?.slice(0, 5) || attempts?.data?.slice(0, 5) || []
  const subjectList = subjects?.data || []

  return (
    <div className="space-y-6">
      {/* Welcome section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-4 sm:p-6 text-white">
        <h1 className="text-xl sm:text-2xl font-bold">
          Welcome back, {user?.first_name || user?.username || 'Student'}!
        </h1>
        <p className="mt-2 text-primary-100">
          Ready to ace your exams? Let's get started with some practice.
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-primary-100">
              <BookOpen className="h-6 w-6 text-primary-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{subjectList.length}</p>
              <p className="text-sm text-gray-500">Subjects Available</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-success-50">
              <Trophy className="h-6 w-6 text-success-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{recentAttempts.length}</p>
              <p className="text-sm text-gray-500">Papers Attempted</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-warning-50">
              <Clock className="h-6 w-6 text-warning-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {recentAttempts.filter((a: any) => a.status === 'in_progress').length}
              </p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subjects */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Browse Subjects</CardTitle>
              <Link to="/subjects" className="text-sm text-primary-600 hover:underline">
                View all
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {subjectsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {subjectList.slice(0, 5).map((subject: any) => (
                  <Link
                    key={subject.id}
                    to={`/papers?subject=${subject.id}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${subject.color}20` }}
                    >
                      <BookOpen className="h-5 w-5" style={{ color: subject.color }} />
                    </div>
                    <div>
                      <p className="font-medium">{subject.name}</p>
                      {subject.code && (
                        <p className="text-xs text-gray-500">{subject.code}</p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent attempts */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Attempts</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {attemptsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
                ))}
              </div>
            ) : recentAttempts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                <p>No attempts yet</p>
                <Link to="/papers" className="text-primary-600 hover:underline text-sm">
                  Start practicing
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {recentAttempts.map((attempt: any) => (
                  <Link
                    key={attempt.id}
                    to={
                      attempt.status === 'marked'
                        ? `/papers/${attempt.paper.id}/results/${attempt.id}`
                        : `/papers/${attempt.paper.id}/attempt`
                    }
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-medium text-sm">{attempt.paper.title}</p>
                      <p className="text-xs text-gray-500">
                        {formatDate(attempt.started_at)}
                      </p>
                    </div>
                    <div className="text-right">
                      {attempt.status === 'marked' ? (
                        <p className={`font-bold ${getScoreColor(attempt.percentage)}`}>
                          {formatPercentage(attempt.percentage)}
                        </p>
                      ) : (
                        <Badge variant="warning">In Progress</Badge>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
