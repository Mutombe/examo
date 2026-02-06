import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button, Input, Card } from '@/components/ui'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const registerSchema = z
  .object({
    email: z.string().email('Please enter a valid email'),
    username: z.string().min(3, 'Username must be at least 3 characters'),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    password_confirm: z.string(),
    school: z.string().optional(),
    grade_level: z.string().optional(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "Passwords don't match",
    path: ['password_confirm'],
  })

type RegisterForm = z.infer<typeof registerSchema>

export function RegisterPage() {
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  })

  const onSubmit = async (data: RegisterForm) => {
    setIsLoading(true)
    setError('')

    try {
      const response = await authApi.register(data)
      const { user, tokens } = response.data
      login(user, tokens.access, tokens.refresh)
      navigate('/dashboard')
    } catch (err: any) {
      const errorData = err.response?.data
      if (errorData) {
        const messages = Object.entries(errorData)
          .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
          .join('. ')
        setError(messages)
      } else {
        setError('Registration failed. Please try again.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ExamRevise" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">ExamRevise Zimbabwe</h1>
          <p className="text-gray-500 mt-2">Create your account</p>
        </div>

        <Card>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {error && (
              <div className="p-3 rounded-lg bg-danger-50 text-danger-600 text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Input
                id="first_name"
                label="First Name"
                placeholder="John"
                error={errors.first_name?.message}
                {...register('first_name')}
              />
              <Input
                id="last_name"
                label="Last Name"
                placeholder="Doe"
                error={errors.last_name?.message}
                {...register('last_name')}
              />
            </div>

            <Input
              id="email"
              type="email"
              label="Email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <Input
              id="username"
              label="Username"
              placeholder="johndoe"
              error={errors.username?.message}
              {...register('username')}
            />

            <Input
              id="school"
              label="School (Optional)"
              placeholder="Your school name"
              error={errors.school?.message}
              {...register('school')}
            />

            <Input
              id="grade_level"
              label="Grade/Form (Optional)"
              placeholder="e.g., Form 4, A Level"
              error={errors.grade_level?.message}
              {...register('grade_level')}
            />

            <Input
              id="password"
              type="password"
              label="Password"
              placeholder="At least 8 characters"
              error={errors.password?.message}
              {...register('password')}
            />

            <Input
              id="password_confirm"
              type="password"
              label="Confirm Password"
              placeholder="Confirm your password"
              error={errors.password_confirm?.message}
              {...register('password_confirm')}
            />

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:underline">
              Sign in
            </Link>
          </p>
        </Card>
      </div>
    </div>
  )
}
