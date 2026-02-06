import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface GuestAnswer {
  questionId: number
  answerText?: string
  selectedOption?: string
  answeredAt: string
}

interface GuestBookmark {
  questionId?: number
  paperId?: number
  resourceId?: number
  bookmarkType: 'question' | 'paper' | 'resource'
  title?: string
  note?: string
  folder: string
  createdAt: string
}

interface GuestState {
  // Track questions answered as guest
  questionsAnswered: GuestAnswer[]
  // Track bookmarks as guest
  bookmarks: GuestBookmark[]
  // Track papers viewed
  papersViewed: number[]
  // Flag to show auth modal
  shouldShowAuthModal: boolean
  // Number of questions before prompting auth
  freeQuestionLimit: number
  // Track when modal was last dismissed to show again every 2 answers
  lastDismissedAtCount: number

  // Actions
  addAnswer: (answer: GuestAnswer) => void
  // Question bookmarks
  addBookmark: (bookmark: GuestBookmark) => void
  removeBookmark: (questionId: number) => void
  isBookmarked: (questionId: number) => boolean
  getBookmark: (questionId: number) => GuestBookmark | undefined
  // Paper bookmarks
  addPaperBookmark: (paperId: number, title?: string) => void
  removePaperBookmark: (paperId: number) => void
  isPaperBookmarked: (paperId: number) => boolean
  // Resource bookmarks
  addResourceBookmark: (resourceId: number, title?: string) => void
  removeResourceBookmark: (resourceId: number) => void
  isResourceBookmarked: (resourceId: number) => boolean
  // Helpers
  getBookmarksByType: (type?: 'question' | 'paper' | 'resource') => GuestBookmark[]
  addPaperViewed: (paperId: number) => void
  checkShouldPromptAuth: () => boolean
  dismissAuthModal: () => void
  clearGuestData: () => void
  getAnswerCount: () => number
}

export const useGuestStore = create<GuestState>()(
  persist(
    (set, get) => ({
      questionsAnswered: [],
      bookmarks: [],
      papersViewed: [],
      shouldShowAuthModal: false,
      freeQuestionLimit: 2,
      lastDismissedAtCount: 0,

      addAnswer: (answer) => {
        set((state) => {
          const existing = state.questionsAnswered.find(
            (a) => a.questionId === answer.questionId
          )
          if (existing) {
            return {
              questionsAnswered: state.questionsAnswered.map((a) =>
                a.questionId === answer.questionId ? answer : a
              ),
            }
          }
          const newAnswers = [...state.questionsAnswered, answer]
          const newCount = newAnswers.length
          // Show modal at 2 answers, then every 2 answers after last dismiss
          const shouldShow =
            newCount >= state.freeQuestionLimit &&
            (state.lastDismissedAtCount === 0 ||
              newCount - state.lastDismissedAtCount >= 2)
          return {
            questionsAnswered: newAnswers,
            shouldShowAuthModal: shouldShow,
          }
        })
      },

      // Question bookmarks
      addBookmark: (bookmark) => {
        set((state) => {
          const existing = state.bookmarks.find(
            (b) => b.bookmarkType === 'question' && b.questionId === bookmark.questionId
          )
          if (existing) {
            return state
          }
          return {
            bookmarks: [...state.bookmarks, { ...bookmark, bookmarkType: bookmark.bookmarkType || 'question' }],
          }
        })
      },

      removeBookmark: (questionId) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter(
            (b) => !(b.bookmarkType === 'question' && b.questionId === questionId)
          ),
        }))
      },

      isBookmarked: (questionId) => {
        return get().bookmarks.some(
          (b) => b.bookmarkType === 'question' && b.questionId === questionId
        )
      },

      getBookmark: (questionId) => {
        return get().bookmarks.find(
          (b) => b.bookmarkType === 'question' && b.questionId === questionId
        )
      },

      // Paper bookmarks
      addPaperBookmark: (paperId, title) => {
        set((state) => {
          const existing = state.bookmarks.find(
            (b) => b.bookmarkType === 'paper' && b.paperId === paperId
          )
          if (existing) return state
          return {
            bookmarks: [...state.bookmarks, {
              paperId,
              bookmarkType: 'paper',
              title,
              folder: 'default',
              createdAt: new Date().toISOString(),
            }],
          }
        })
      },

      removePaperBookmark: (paperId) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter(
            (b) => !(b.bookmarkType === 'paper' && b.paperId === paperId)
          ),
        }))
      },

      isPaperBookmarked: (paperId) => {
        return get().bookmarks.some(
          (b) => b.bookmarkType === 'paper' && b.paperId === paperId
        )
      },

      // Resource bookmarks
      addResourceBookmark: (resourceId, title) => {
        set((state) => {
          const existing = state.bookmarks.find(
            (b) => b.bookmarkType === 'resource' && b.resourceId === resourceId
          )
          if (existing) return state
          return {
            bookmarks: [...state.bookmarks, {
              resourceId,
              bookmarkType: 'resource',
              title,
              folder: 'default',
              createdAt: new Date().toISOString(),
            }],
          }
        })
      },

      removeResourceBookmark: (resourceId) => {
        set((state) => ({
          bookmarks: state.bookmarks.filter(
            (b) => !(b.bookmarkType === 'resource' && b.resourceId === resourceId)
          ),
        }))
      },

      isResourceBookmarked: (resourceId) => {
        return get().bookmarks.some(
          (b) => b.bookmarkType === 'resource' && b.resourceId === resourceId
        )
      },

      // Helpers
      getBookmarksByType: (type) => {
        const bookmarks = get().bookmarks
        if (!type) return bookmarks
        return bookmarks.filter((b) => b.bookmarkType === type)
      },

      addPaperViewed: (paperId) => {
        set((state) => {
          if (state.papersViewed.includes(paperId)) {
            return state
          }
          return {
            papersViewed: [...state.papersViewed, paperId],
          }
        })
      },

      checkShouldPromptAuth: () => {
        const state = get()
        const count = state.questionsAnswered.length
        return (
          count >= state.freeQuestionLimit &&
          (state.lastDismissedAtCount === 0 ||
            count - state.lastDismissedAtCount >= 2)
        )
      },

      dismissAuthModal: () => {
        set((state) => ({
          shouldShowAuthModal: false,
          lastDismissedAtCount: state.questionsAnswered.length,
        }))
      },

      clearGuestData: () => {
        set({
          questionsAnswered: [],
          bookmarks: [],
          papersViewed: [],
          shouldShowAuthModal: false,
          lastDismissedAtCount: 0,
        })
      },

      getAnswerCount: () => {
        return get().questionsAnswered.length
      },
    }),
    {
      name: 'guest-storage',
    }
  )
)
