import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck } from 'lucide-react'
import { notificationsApi, type NotificationData } from '@/lib/api'
import { useNotificationStore } from '@/stores/notificationStore'
import { cn } from '@/lib/utils'

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function NotificationSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-2 h-2 rounded-full bg-gray-200" />
                <div className="h-4 bg-gray-200 rounded" style={{ width: `${50 + i * 8}%` }} />
              </div>
              <div className="h-3.5 w-3/4 bg-gray-200 rounded" />
            </div>
            <div className="h-3 w-12 bg-gray-200 rounded shrink-0" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function NotificationsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { fetchUnreadCount } = useNotificationStore()

  const { data, isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await notificationsApi.getNotifications()
      return data.results as NotificationData[]
    },
  })

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      fetchUnreadCount()
    },
  })

  const markAllReadMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
      fetchUnreadCount()
    },
  })

  const handleClick = (notification: NotificationData) => {
    if (!notification.is_read) {
      markReadMutation.mutate(notification.id)
    }
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const unreadCount = data?.filter((n) => !n.is_read).length || 0

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header — always rendered (static) */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Notifications</h1>
          {!isLoading && unreadCount > 0 && (
            <p className="text-sm text-gray-500 mt-1">{unreadCount} unread</p>
          )}
        </div>
        {!isLoading && unreadCount > 0 && (
          <button
            onClick={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        )}
      </div>

      {/* Skeleton loading state */}
      {isLoading && <NotificationSkeleton />}

      {/* Empty state */}
      {!isLoading && (!data || data.length === 0) && (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Bell className="h-10 w-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No notifications yet</p>
          <p className="text-sm text-gray-400 mt-1">
            You'll be notified when your papers are marked.
          </p>
        </div>
      )}

      {/* Notification list */}
      {!isLoading && data && data.length > 0 && (
        <div className="space-y-2">
          {data.map((notification) => (
            <button
              key={notification.id}
              onClick={() => handleClick(notification)}
              className={cn(
                'w-full text-left bg-white rounded-xl border p-4 transition-colors hover:bg-gray-50',
                notification.is_read
                  ? 'border-gray-200'
                  : 'border-primary-200 bg-primary-50/30'
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!notification.is_read && (
                      <div className="w-2 h-2 rounded-full bg-primary-500 shrink-0" />
                    )}
                    <h3
                      className={cn(
                        'text-sm truncate',
                        notification.is_read ? 'text-gray-700' : 'text-gray-900 font-medium'
                      )}
                    >
                      {notification.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                    {notification.message}
                  </p>
                </div>
                <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">
                  {timeAgo(notification.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
