import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Copy, CheckCircle, Mail } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { schoolApi } from '@/lib/api'

const inviteSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  role: z.string().default('teacher'),
  department: z.string().optional(),
})

type InviteForm = z.infer<typeof inviteSchema>

interface InviteTeacherModalProps {
  isOpen: boolean
  onClose: () => void
}

export function InviteTeacherModal({ isOpen, onClose }: InviteTeacherModalProps) {
  const [error, setError] = useState<string | null>(null)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const form = useForm<InviteForm>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: '',
      role: 'teacher',
      department: '',
    },
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteForm) => schoolApi.inviteTeacher(data),
    onSuccess: (response) => {
      setInviteLink(response.data.invite_link)
      queryClient.invalidateQueries({ queryKey: ['school', 'invitations'] })
    },
    onError: (err: any) => {
      setError(err.response?.data?.error || err.response?.data?.email?.[0] || 'Failed to send invitation.')
    },
  })

  const handleSubmit = form.handleSubmit((data) => {
    setError(null)
    setInviteLink(null)
    inviteMutation.mutate(data)
  })

  const handleCopy = async () => {
    if (inviteLink) {
      await navigator.clipboard.writeText(inviteLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleClose = () => {
    form.reset()
    setError(null)
    setInviteLink(null)
    setCopied(false)
    onClose()
  }

  const handleSendAnother = () => {
    form.reset()
    setInviteLink(null)
    setError(null)
    setCopied(false)
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Invite Teacher">
      {inviteLink ? (
        /* Success state - show invite link */
        <div className="space-y-4">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 mb-3">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">Invitation Sent</h3>
            <p className="text-sm text-gray-500 mt-1">
              Share this link with the teacher to join your school
            </p>
          </div>

          <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
            <input
              type="text"
              readOnly
              value={inviteLink}
              className="flex-1 bg-transparent text-sm text-gray-700 outline-none truncate"
            />
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? (
                <><CheckCircle className="h-4 w-4 mr-1 text-green-600" /> Copied</>
              ) : (
                <><Copy className="h-4 w-4 mr-1" /> Copy</>
              )}
            </Button>
          </div>

          <p className="text-xs text-gray-500">
            This link expires in 7 days. The teacher will need to create an account or sign in to accept.
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" className="flex-1" onClick={handleSendAnother}>
              Invite Another
            </Button>
            <Button className="flex-1" onClick={handleClose}>
              Done
            </Button>
          </div>
        </div>
      ) : (
        /* Invite form */
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Teacher's Email
            </label>
            <Input
              type="email"
              placeholder="teacher@example.com"
              {...form.register('email')}
              error={form.formState.errors.email?.message}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
            <select className="input w-full" {...form.register('role')}>
              <option value="teacher">Teacher</option>
              <option value="hod">Head of Department</option>
              <option value="deputy">Deputy Head</option>
              <option value="head">Head Teacher</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Department (optional)
            </label>
            <Input
              placeholder="e.g. Sciences, Mathematics"
              {...form.register('department')}
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={inviteMutation.isPending}
          >
            {inviteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending Invitation...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send Invitation
              </>
            )}
          </Button>
        </form>
      )}
    </Modal>
  )
}
