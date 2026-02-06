import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { progressApi, OverallProgress, StudyStreak } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'

export function ProgressPage() {
  const { data: progressData, isLoading: progressLoading } = useQuery({
    queryKey: ['overall-progress'],
    queryFn: () => progressApi.getOverall(),
  })

  const { data: streakData, isLoading: streakLoading } = useQuery({
    queryKey: ['study-streak'],
    queryFn: () => progressApi.getStreak(),
  })

  const { data: weakTopicsData } = useQuery({
    queryKey: ['weak-topics'],
    queryFn: () => progressApi.getWeakTopics(),
  })

  const progress: OverallProgress | undefined = progressData?.data
  const streak: StudyStreak | undefined = streakData?.data
  const weakTopics = weakTopicsData?.data || []

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) {
      return `${hours}h ${minutes}m`
    }
    return `${minutes}m`
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Your Progress</h1>
        <p className="text-gray-600">Track your learning journey and identify areas to improve</p>
      </div>

      {/* Streak Banner */}
      {streak && streak.current_streak > 0 && (
        <Card className="p-4 bg-gradient-to-r from-orange-500 to-yellow-500 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-4xl">🔥</span>
              <div>
                <div className="text-2xl font-bold">{streak.current_streak} Day Streak!</div>
                <div className="text-orange-100">Keep it going! Study today to maintain your streak.</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm text-orange-100">Longest Streak</div>
              <div className="font-bold">{streak.longest_streak} days</div>
            </div>
          </div>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {progressLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)
        ) : progress ? (
          <>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Questions Attempted</div>
              <div className="text-2xl font-bold text-gray-900">
                {progress.total_questions_attempted}
              </div>
              <div className="text-sm text-green-600">
                {progress.total_questions_correct} correct
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Overall Accuracy</div>
              <div className="text-2xl font-bold text-gray-900">
                {progress.overall_accuracy}%
              </div>
              <div className="h-2 bg-gray-100 rounded-full mt-2">
                <div
                  className="h-2 bg-blue-500 rounded-full"
                  style={{ width: `${progress.overall_accuracy}%` }}
                />
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Topics Started</div>
              <div className="text-2xl font-bold text-gray-900">{progress.topics_started}</div>
              <div className="text-sm text-purple-600">
                {progress.topics_mastered} mastered
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Total Study Time</div>
              <div className="text-2xl font-bold text-gray-900">
                {formatTime(progress.total_study_time_seconds)}
              </div>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Subject Progress */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Progress by Subject</h2>
            <Link to="/progress/topics" className="text-sm text-blue-600 hover:underline">
              View all topics
            </Link>
          </div>

          {progressLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : progress && progress.subjects_studied.length > 0 ? (
            <div className="space-y-4">
              {progress.subjects_studied.map((subject) => (
                <div key={subject.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{subject.name}</span>
                    <span className="text-sm text-gray-500">
                      {subject.topics_count} topics · {subject.average_mastery.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full">
                    <div
                      className={`h-2 rounded-full ${
                        subject.average_mastery >= 80
                          ? 'bg-green-500'
                          : subject.average_mastery >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{ width: `${subject.average_mastery}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Start practicing to see your subject progress.</p>
            </div>
          )}
        </Card>

        {/* Weak Topics */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Topics to Review</h2>
            <Badge variant="warning">{weakTopics.length} need work</Badge>
          </div>

          {weakTopics.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p className="text-green-600 font-medium">Great job!</p>
              <p className="text-sm">No weak topics identified yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {weakTopics.slice(0, 5).map((tp: any) => (
                <div
                  key={tp.id}
                  className="p-3 rounded-lg border border-gray-200 hover:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{tp.topic.name}</div>
                      <div className="text-sm text-gray-500">
                        {tp.questions_attempted} questions · {tp.accuracy}% accuracy
                      </div>
                    </div>
                    <Badge
                      variant={
                        tp.mastery_level === 'beginner'
                          ? 'warning'
                          : tp.mastery_level === 'developing'
                          ? 'info'
                          : 'secondary'
                      }
                    >
                      {tp.mastery_level_display}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Recent Activity */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h2>

          {streakLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          ) : streak && streak.recent_sessions.length > 0 ? (
            <div className="space-y-3">
              {streak.recent_sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {new Date(session.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-gray-500">
                      {session.questions_attempted} questions · {session.time_spent_formatted}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium text-gray-900">{session.accuracy.toFixed(0)}%</div>
                    {session.streak_maintained && <span className="text-orange-500">🔥</span>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>No recent study sessions.</p>
              <Link to="/subjects" className="text-blue-600 hover:underline text-sm">
                Start practicing now
              </Link>
            </div>
          )}
        </Card>

        {/* Achievements Preview */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Milestones</h2>

          {progress ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    progress.total_questions_attempted >= 100
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {progress.total_questions_attempted >= 100 ? '✓' : '?'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Century Club</div>
                  <div className="text-sm text-gray-500">
                    Answer 100 questions ({Math.min(progress.total_questions_attempted, 100)}/100)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    streak && streak.longest_streak >= 7
                      ? 'bg-orange-100 text-orange-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {streak && streak.longest_streak >= 7 ? '🔥' : '?'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Week Warrior</div>
                  <div className="text-sm text-gray-500">
                    Maintain a 7-day streak ({Math.min(streak?.longest_streak || 0, 7)}/7)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    progress.topics_mastered >= 5
                      ? 'bg-purple-100 text-purple-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {progress.topics_mastered >= 5 ? '⭐' : '?'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Topic Master</div>
                  <div className="text-sm text-gray-500">
                    Master 5 topics ({Math.min(progress.topics_mastered, 5)}/5)
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    progress.overall_accuracy >= 80
                      ? 'bg-blue-100 text-blue-600'
                      : 'bg-gray-100 text-gray-400'
                  }`}
                >
                  {progress.overall_accuracy >= 80 ? '🎯' : '?'}
                </div>
                <div>
                  <div className="font-medium text-gray-900">Sharpshooter</div>
                  <div className="text-sm text-gray-500">
                    Achieve 80% overall accuracy ({progress.overall_accuracy.toFixed(0)}/80%)
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p>Start practicing to unlock achievements.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
