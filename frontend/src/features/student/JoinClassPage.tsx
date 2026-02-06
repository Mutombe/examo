import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { studentApi } from '@/lib/api'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

export function JoinClassPage() {
  const navigate = useNavigate()
  const [joinCode, setJoinCode] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<any>(null)

  const joinMutation = useMutation({
    mutationFn: (code: string) => studentApi.joinClass(code),
    onSuccess: (response) => {
      setSuccess(response.data)
      setError('')
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || 'Failed to join class. Please check the code and try again.')
      setSuccess(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess(null)

    const code = joinCode.trim().toUpperCase()
    if (!code) {
      setError('Please enter a join code')
      return
    }
    if (code.length !== 8) {
      setError('Join code should be 8 characters')
      return
    }

    joinMutation.mutate(code)
  }

  return (
    <div className="max-w-md mx-auto">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-gray-900">Join a Class</h1>
        <p className="text-gray-600">Enter the join code from your teacher</p>
      </div>

      <Card className="p-6">
        {success ? (
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Successfully Joined!
            </h3>
            <p className="text-gray-600 mb-4">
              You have joined <strong>{success.class?.name}</strong>
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="secondary" onClick={() => {
                setSuccess(null)
                setJoinCode('')
              }}>
                Join Another
              </Button>
              <Button onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Join Code
              </label>
              <Input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter 8-character code"
                maxLength={8}
                className="text-center text-2xl font-mono tracking-widest"
              />
              <p className="mt-2 text-sm text-gray-500">
                Ask your teacher for the class join code
              </p>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={joinMutation.isPending || joinCode.length !== 8}
            >
              {joinMutation.isPending ? 'Joining...' : 'Join Class'}
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
