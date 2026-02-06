import { create } from 'zustand'

interface UIState {
  // Auth Modal
  isAuthModalOpen: boolean
  authModalTab: 'login' | 'register'
  openAuthModal: (tab?: 'login' | 'register') => void
  closeAuthModal: () => void

  // Paper Upload Modal
  isPaperUploadModalOpen: boolean
  openPaperUploadModal: () => void
  closePaperUploadModal: () => void
}

export const useUIStore = create<UIState>((set) => ({
  // Auth Modal
  isAuthModalOpen: false,
  authModalTab: 'login',
  openAuthModal: (tab = 'login') => set({ isAuthModalOpen: true, authModalTab: tab }),
  closeAuthModal: () => set({ isAuthModalOpen: false }),

  // Paper Upload Modal
  isPaperUploadModalOpen: false,
  openPaperUploadModal: () => set({ isPaperUploadModalOpen: true }),
  closePaperUploadModal: () => set({ isPaperUploadModalOpen: false }),
}))
