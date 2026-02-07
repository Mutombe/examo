import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Eye, EyeOff, X, Loader2, Building2 } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'
import { useAttemptSessionStore } from '@/stores/attemptSessionStore'

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirm: z.string(),
  role: z.enum(['student', 'teacher', 'parent']),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords don't match",
  path: ['password_confirm'],
})

type LoginForm = z.infer<typeof loginSchema>
type RegisterForm = z.infer<typeof registerSchema>

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  defaultTab?: 'login' | 'register'
}

export function AuthModal({ isOpen, onClose, defaultTab = 'login' }: AuthModalProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>(defaultTab)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const login = useAuthStore((state) => state.login)

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      email: '',
      first_name: '',
      last_name: '',
      password: '',
      password_confirm: '',
      role: 'student',
    },
  })

  const loginMutation = useMutation({
    mutationFn: (data: LoginForm) => authApi.login(data.email, data.password),
    onSuccess: (response) => {
      const session = useAttemptSessionStore.getState()
      if (session.paperId) session.markPendingSync()
      login(response.data.user, response.data.access, response.data.refresh)
      onClose()
      loginForm.reset()
      setError(null)
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.detail || 'Invalid email or password')
    },
  })

  const registerMutation = useMutation({
    mutationFn: (data: RegisterForm) => authApi.register(data),
    onSuccess: (response) => {
      const session = useAttemptSessionStore.getState()
      if (session.paperId) session.markPendingSync()
      login(response.data.user, response.data.access, response.data.refresh)
      onClose()
      registerForm.reset()
      setError(null)
    },
    onError: (err: any) => {
      const message = err.response?.data?.email?.[0] ||
                      err.response?.data?.detail ||
                      'Registration failed'
      setError(message)
    },
  })

  const handleLogin = loginForm.handleSubmit((data) => {
    setError(null)
    loginMutation.mutate(data)
  })

  const handleRegister = registerForm.handleSubmit((data) => {
    setError(null)
    registerMutation.mutate(data)
  })

  const switchTab = (tab: 'login' | 'register') => {
    setActiveTab(tab)
    setError(null)
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="">
      <div className="relative">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img src="/logo.png" alt="ExamRevise" className="h-12 w-auto" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">
            {activeTab === 'login' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            {activeTab === 'login'
              ? 'Sign in to continue your learning journey'
              : 'Start your exam preparation today'}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-6">
          <button
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'login'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => switchTab('login')}
          >
            Sign In
          </button>
          <button
            className={`flex-1 pb-3 text-sm font-medium transition-colors ${
              activeTab === 'register'
                ? 'text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            onClick={() => switchTab('register')}
          >
            Sign Up
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Google Sign In */}
        <GoogleSignInButton
          onSuccess={() => {
            onClose()
            setError(null)
          }}
          onError={(msg) => setError(msg)}
          text={activeTab === 'login' ? 'signin_with' : 'signup_with'}
        />

        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-3 text-gray-500">
              or {activeTab === 'login' ? 'sign in' : 'sign up'} with email
            </span>
          </div>
        </div>

        {/* Login Form */}
        {activeTab === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                {...loginForm.register('email')}
                error={loginForm.formState.errors.email?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  {...loginForm.register('password')}
                  error={loginForm.formState.errors.password?.message}
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
              disabled={loginMutation.isPending}
            >
              {loginMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>

            {/* Demo accounts */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center mb-3">Quick login (Demo accounts)</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  onClick={() => {
                    loginForm.setValue('email', 'student@example.com')
                    loginForm.setValue('password', 'student123')
                  }}
                >
                  Student
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  onClick={() => {
                    loginForm.setValue('email', 'teacher@example.com')
                    loginForm.setValue('password', 'teacher123')
                  }}
                >
                  Teacher
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  onClick={() => {
                    loginForm.setValue('email', 'parent@example.com')
                    loginForm.setValue('password', 'parent123')
                  }}
                >
                  Parent
                </button>
                <button
                  type="button"
                  className="text-xs px-2 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-gray-700"
                  onClick={() => {
                    loginForm.setValue('email', 'admin@example.com')
                    loginForm.setValue('password', 'admin123')
                  }}
                >
                  Admin
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Register Form */}
        {activeTab === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </label>
                <Input
                  placeholder="John"
                  {...registerForm.register('first_name')}
                  error={registerForm.formState.errors.first_name?.message}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </label>
                <Input
                  placeholder="Doe"
                  {...registerForm.register('last_name')}
                  error={registerForm.formState.errors.last_name?.message}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <Input
                type="email"
                placeholder="you@example.com"
                {...registerForm.register('email')}
                error={registerForm.formState.errors.email?.message}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                I am a...
              </label>
              <select
                className="input w-full"
                {...registerForm.register('role')}
              >
                <option value="student">Student</option>
                <option value="teacher">Teacher</option>
                <option value="parent">Parent</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  {...registerForm.register('password')}
                  error={registerForm.formState.errors.password?.message}
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Confirm your password"
                {...registerForm.register('password_confirm')}
                error={registerForm.formState.errors.password_confirm?.message}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
            >
              {registerMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>

            <div className="mt-3 pt-3 border-t border-gray-200 text-center">
              <Link
                to="/register/school"
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                <Building2 className="h-4 w-4" />
                Register as a School
              </Link>
            </div>
          </form>
        )}
      </div>
    </Modal>
  )
}
