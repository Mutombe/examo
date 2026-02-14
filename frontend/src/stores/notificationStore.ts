import { create } from 'zustand'
import { notificationsApi } from '@/lib/api'

interface NotificationState {
  unreadCount: number
  fetchUnreadCount: () => Promise<void>
  decrementCount: () => void
  resetCount: () => void
}

export const useNotificationStore = create<NotificationState>()((set) => ({
  unreadCount: 0,

  fetchUnreadCount: async () => {
    try {
      const { data } = await notificationsApi.getUnreadCount()
      set({ unreadCount: data.count })
    } catch {
      // Silently fail — user may not be authenticated
    }
  },

  decrementCount: () =>
    set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),

  resetCount: () => set({ unreadCount: 0 }),
}))
