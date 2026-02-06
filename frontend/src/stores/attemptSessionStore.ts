import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AttemptSessionState {
  paperId: number | null
  answers: Record<number, { text: string; option: string }>
  currentQuestionIndex: number
  totalTimeSpent: number
  questionTimes: Record<number, number>
  isPaused: boolean
  pendingSync: boolean

  saveSession: (data: {
    paperId: number
    answers: Record<number, { text: string; option: string }>
    currentQuestionIndex: number
    totalTimeSpent: number
    questionTimes: Record<number, number>
    isPaused: boolean
  }) => void
  markPendingSync: () => void
  clearSession: () => void
}

export const useAttemptSessionStore = create<AttemptSessionState>()(
  persist(
    (set) => ({
      paperId: null,
      answers: {},
      currentQuestionIndex: 0,
      totalTimeSpent: 0,
      questionTimes: {},
      isPaused: false,
      pendingSync: false,

      saveSession: (data) =>
        set({
          paperId: data.paperId,
          answers: data.answers,
          currentQuestionIndex: data.currentQuestionIndex,
          totalTimeSpent: data.totalTimeSpent,
          questionTimes: data.questionTimes,
          isPaused: data.isPaused,
        }),

      markPendingSync: () => set({ pendingSync: true }),

      clearSession: () =>
        set({
          paperId: null,
          answers: {},
          currentQuestionIndex: 0,
          totalTimeSpent: 0,
          questionTimes: {},
          isPaused: false,
          pendingSync: false,
        }),
    }),
    {
      name: 'attempt-session',
    }
  )
)
