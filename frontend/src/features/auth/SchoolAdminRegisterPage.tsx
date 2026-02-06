import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation } from '@tanstack/react-query'
import {
  ArrowLeft, Eye, EyeOff, Loader2, CheckCircle
} from 'lucide-react'
import { Button, Input, Card } from '@/components/ui'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/authStore'

const PROVINCES = [
  'Bulawayo', 'Harare', 'Manicaland', 'Mashonaland Central',
  'Mashonaland East', 'Mashonaland West', 'Masvingo', 'Matabeleland North',
  'Matabeleland South', 'Midlands',
]

const schoolAdminSchema = z.object({
  // Personal
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email('Please enter a valid email'),
  phone_number: z.string().optional(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  password_confirm: z.string(),
  // School
  school_name: z.string().min(2, 'School name is required'),
  school_type: z.enum(['government', 'private', 'mission', 'trust']),
  province: z.string().min(1, 'Province is required'),
  city: z.string().min(1, 'City is required'),
  school_email: z.string().email().optional().or(z.literal('')),
  school_phone: z.string().optional(),
}).refine((data) => data.password === data.password_confirm, {
  message: "Passwords don't match",
  path: ['password_confirm'],
})

type SchoolAdminForm = z.infer<typeof schoolAdminSchema>

export function SchoolAdminRegisterPage() {
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()
  const login = useAuthStore((state) => state.login)

  const form = useForm<SchoolAdminForm>({
    resolver: zodResolver(schoolAdminSchema),
    defaultValues: {
      first_name: '',
      last_name: '',
      email: '',
      phone_number: '',
      password: '',
      password_confirm: '',
      school_name: '',
      school_type: 'government',
      province: '',
      city: '',
      school_email: '',
      school_phone: '',
    },
  })

  const registerMutation = useMutation({
    mutationFn: (data: SchoolAdminForm) => authApi.registerSchoolAdmin(data),
    onSuccess: (response) => {
      login(response.data.user, response.data.access, response.data.refresh)
      navigate('/school')
    },
    onError: (err: any) => {
      const data = err.response?.data
      if (data) {
        // Try to find first error message
        const firstError = data.email?.[0] || data.school_name?.[0] || data.error || data.detail
        setError(firstError || 'Registration failed. Please try again.')
      } else {
        setError('Network error. Please try again.')
      }
    },
  })

  const handleNext = async () => {
    // Validate step 1 fields
    const valid = await form.trigger(['first_name', 'last_name', 'email', 'password', 'password_confirm'])
    if (valid) setStep(2)
  }

  const handleSubmit = form.handleSubmit((data) => {
    setError(null)
    registerMutation.mutate(data)
  })

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="max-w-lg w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src="/logo.png" alt="ExamRevise" className="h-16 w-auto mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900">Register Your School</h1>
          <p className="text-gray-500 mt-2">
            Set up your school on ExamRevise Zimbabwe
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 1 ? 'bg-primary-100 text-primary-700' : 'bg-green-100 text-green-700'
          }`}>
            {step > 1 ? <CheckCircle className="h-4 w-4" /> : <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center">1</span>}
            Your Details
          </div>
          <div className="w-8 h-px bg-gray-300" />
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
            step === 2 ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-500'
          }`}>
            <span className="w-5 h-5 rounded-full bg-gray-300 text-gray-600 text-xs flex items-center justify-center">2</span>
            School Info
          </div>
        </div>

        <Card>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Step 1: Personal details */}
            {step === 1 && (
              <div className="space-y-4">
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <Input
                    type="email"
                    placeholder="admin@school.ac.zw"
                    {...form.register('email')}
                    error={form.formState.errors.email?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number (optional)</label>
                  <Input
                    type="tel"
                    placeholder="+263 77 123 4567"
                    {...form.register('phone_number')}
                  />
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

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="Confirm your password"
                    {...form.register('password_confirm')}
                    error={form.formState.errors.password_confirm?.message}
                  />
                </div>

                <Button type="button" className="w-full" onClick={handleNext}>
                  Next: School Information
                </Button>
              </div>
            )}

            {/* Step 2: School details */}
            {step === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Name</label>
                  <Input
                    placeholder="e.g. Prince Edward School"
                    {...form.register('school_name')}
                    error={form.formState.errors.school_name?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Type</label>
                  <select
                    className="input w-full"
                    {...form.register('school_type')}
                  >
                    <option value="government">Government</option>
                    <option value="private">Private</option>
                    <option value="mission">Mission</option>
                    <option value="trust">Trust</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Province</label>
                    <select
                      className="input w-full"
                      {...form.register('province')}
                    >
                      <option value="">Select province</option>
                      {PROVINCES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                    {form.formState.errors.province && (
                      <p className="mt-1 text-sm text-danger-600">{form.formState.errors.province.message}</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">City/Town</label>
                    <Input
                      placeholder="e.g. Harare"
                      {...form.register('city')}
                      error={form.formState.errors.city?.message}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Email (optional)</label>
                  <Input
                    type="email"
                    placeholder="info@school.ac.zw"
                    {...form.register('school_email')}
                    error={form.formState.errors.school_email?.message}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">School Phone (optional)</label>
                  <Input
                    type="tel"
                    placeholder="+263 4 123 4567"
                    {...form.register('school_phone')}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={registerMutation.isPending}
                  >
                    {registerMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      'Register School'
                    )}
                  </Button>
                </div>
              </div>
            )}
          </form>

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
