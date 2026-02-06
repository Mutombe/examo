import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useGuestStore } from '@/stores/guestStore'
import { useUIStore } from '@/stores/uiStore'

interface AuthPromptModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthPromptModal({ isOpen, onClose }: AuthPromptModalProps) {
  const { getAnswerCount, bookmarks } = useGuestStore()
  const openAuthModal = useUIStore((state) => state.openAuthModal)
  const answerCount = getAnswerCount()

  const handleOpenAuth = (tab: 'register' | 'login') => {
    onClose()
    openAuthModal(tab)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create a Free Account">
      <div className="text-center">
        <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg
            className="w-8 h-8 text-primary-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          You're doing great!
        </h3>

        <p className="text-gray-600 mb-4">
          You've answered {answerCount} questions{bookmarks.length > 0 && ` and saved ${bookmarks.length} bookmarks`}.
          Create a free account to:
        </p>

        <ul className="text-left text-gray-600 mb-6 space-y-2">
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Save your progress and track your improvement
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Get AI-powered feedback on your answers
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Access unlimited questions and past papers
          </li>
          <li className="flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            Keep your bookmarks synced across devices
          </li>
        </ul>

        <div className="flex flex-col gap-3">
          <Button className="w-full" onClick={() => handleOpenAuth('register')}>
            Create Free Account
          </Button>
          <Button variant="secondary" className="w-full" onClick={() => handleOpenAuth('login')}>
            Already have an account? Sign in
          </Button>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Continue as guest (limited)
          </button>
        </div>
      </div>
    </Modal>
  )
}
