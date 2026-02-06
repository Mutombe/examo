import { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  GraduationCap, ArrowLeft, Eye, EyeOff, Loader2, XCircle
} from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { authApi, type InvitationInfo } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const acceptSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

type AcceptForm = z.infer<typeof acceptSchema>

export function AcceptInvitationPage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check invitation validity
  const { data: invitation, isLoading, isError, error: fetchError } = useQuery({
    queryKey: ['invitation', token],
    queryFn: () => authApi.checkInvitation(token!),
    enabled: !!token,
    retry: false,
  })

  const invitationData: InvitationInfo | null = invitation?.data || null

  const form = useForm<AcceptForm>({
    resolver: zodResolver(acceptSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      password: '',
    },
  })

  const acceptMutation = useMutation({
    mutationFn: (data: AcceptForm) => authApi.acceptInvitation(token!, data),
    onSuccess: (response) => {
      login(response.data.user, response.data.access, response.data.refresh)
      navigate('/teacher')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to accept invitation. Please try again.')
    },
  })

  // If authenticated, accept with just password verification
  const acceptAsExistingMutation = useMutation({
    mutationFn: () => authApi.acceptInvitation(token!, {}),
    onSuccess: (response) => {
      login(response.data.user, response.data.access, response.data.refresh)
      navigate('/teacher')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to accept invitation.')
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    setError(null)
    acceptMutation.mutate(data)
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
          <p className="text-gray-500">Checking invitation...</p>
        </div>
      </div>
    )
  }

  const errorMessage = (fetchError as any)?.response?.data?.error || 'This invitation link is invalid or has expired.'

  if (isError || !invitationData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-red-100 mb-4">
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invitation</h1>
          <p className="text-gray-500 mb-6">{errorMessage}</p>
          <Link to="/">
            <Button>Go to Home</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ExamRevise" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Join {invitationData.school_name}</h1>
          <p className="text-gray-500 mt-2">
            You've been invited to join as a <strong>{invitationData.role}</strong>
            {invitationData.department && <> in the <strong>{invitationData.department}</strong> department</>}
          </p>
        </div>

        <Card>
          {/* Invitation details */}
          <div className="mb-6 p-3 bg-primary-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
                <GraduationCap className="h-5 w-5 text-primary-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">{invitationData.school_name}</p>
                <p className="text-sm text-gray-500">Invited as {invitationData.role}</p>
              </div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {isAuthenticated ? (
            /* Already logged in - just accept */
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                You're signed in as <strong>{invitationData.email}</strong>. Click below to accept the invitation and join the school.
              </p>
              <Button
                className="w-full"
                onClick={() => acceptAsExistingMutation.mutate()}
                disabled={acceptAsExistingMutation.isPending}
              >
                {acceptAsExistingMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Joining...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>
            </div>
          ) : (
            /* New user - registration form */
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-sm text-gray-600 mb-4">
                Create your account to join the school. Your email is <strong>{invitationData.email}</strong>.
              </p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <Input
                    placeholder="John"
                    {...form.register('first_name')}
                    error={form.formState.errors.first_name?.message}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <Input
                    placeholder="Moyo"
                    {...form.register('last_name')}
                    error={form.formState.errors.last_name?.message}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="At least 8 characters"
                    {...form.register('password')}
                    error={form.formState.errors.password?.message}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  'Create Account & Join'
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to home
            </Link>
          </div>
        </Card>
      </div>
    </div>
  )
}
