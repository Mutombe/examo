import { useRef, useEffect, useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useAttemptSessionStore } from '@/stores/attemptSessionStore'

interface GoogleSignInButtonProps {
  onSuccess?: () => void
  onError?: (message: string) => void
  text?: 'signin_with' | 'signup_with' | 'continue_with'
}

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
}: GoogleSignInButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null)
  const [rendered, setRendered] = useState(false)
  const login = useAuthStore((state) => state.login)

  const googleMutation = useMutation({
    mutationFn: (credential: string) => authApi.googleLogin(credential),
    onSuccess: (response) => {
      const session = useAttemptSessionStore.getState()
      if (session.paperId) session.markPendingSync()
      login(response.data.user, response.data.access, response.data.refresh)
      onSuccess?.()
    },
    onError: (err: any) => {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        'Google sign-in failed'
      onError?.(message)
    },
  })

  const tryRender = useCallback(() => {
    if (!window.google?.accounts?.id || !buttonRef.current || !GOOGLE_CLIENT_ID) return false

    // Need a real width for the button — skip if container is hidden/collapsed
    const width = buttonRef.current.offsetWidth
    if (width < 100) return false

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response: GoogleCredentialResponse) => {
        googleMutation.mutate(response.credential)
      },
    })

    window.google.accounts.id.renderButton(buttonRef.current, {
      type: 'standard',
      theme: 'outline',
      size: 'large',
      text,
      shape: 'rectangular',
      logo_alignment: 'left',
      width: width,
    })

    setRendered(true)
    return true
  }, [text])

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    // Try immediately
    if (tryRender()) return

    // Poll until script loads AND container has width (modal animation done)
    const interval = setInterval(() => {
      if (tryRender()) clearInterval(interval)
    }, 250)

    const timeout = setTimeout(() => clearInterval(interval), 10000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [tryRender])

  // No client ID configured — hide completely
  if (!GOOGLE_CLIENT_ID) return null

  return (
    <div className="w-full">
      <div ref={buttonRef} className="w-full flex justify-center" />
      {!rendered && (
        <button
          type="button"
          disabled={googleMutation.isPending}
          className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-md bg-white hover:bg-gray-50 text-sm font-medium text-gray-700 transition-colors"
        >
          {googleMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
          )}
          {googleMutation.isPending ? 'Signing in...' : 'Continue with Google'}
        </button>
      )}
    </div>
  )
}
