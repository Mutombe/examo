import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { User, Lock, Bell, LogOut, Save, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Modal } from '@/components/ui'
import { useAuthStore } from '@/stores/authStore'
import { authApi } from '@/lib/api'
import { toast } from '@/stores/toastStore'

const profileSchema = z.object({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  school_name: z.string().optional(),
})

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Password must be at least 8 characters'),
  new_password_confirm: z.string(),
}).refine(data => data.new_password === data.new_password_confirm, {
  message: "Passwords don't match",
  path: ['new_password_confirm'],
})

type ProfileForm = z.infer<typeof profileSchema>
type PasswordForm = z.infer<typeof passwordSchema>

export function ProfilePage() {
  const { user, logout, setUser } = useAuthStore()
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const queryClient = useQueryClient()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      school_name: user?.school_name || '',
    },
  })

  const passwordForm = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  })

  const updateProfileMutation = useMutation({
    mutationFn: (data: ProfileForm) => authApi.me().then(() =>
      // Using PATCH via me endpoint
      fetch('/api/v1/auth/me/', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${useAuthStore.getState().accessToken}`
        },
        body: JSON.stringify(data)
      }).then(res => res.json())
    ),
    onSuccess: (data) => {
      if (user) {
        setUser({ ...user, ...data })
      }
      toast.success('Profile updated successfully')
    },
    onError: () => {
      toast.error('Failed to update profile')
    },
  })

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordForm) =>
      authApi.changePassword(data.current_password, data.new_password, data.new_password_confirm),
    onSuccess: () => {
      toast.success('Password changed successfully')
      setShowPasswordModal(false)
      passwordForm.reset()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to change password')
    },
  })

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const onProfileSubmit = profileForm.handleSubmit((data) => {
    updateProfileMutation.mutate(data)
  })

  const onPasswordSubmit = passwordForm.handleSubmit((data) => {
    changePasswordMutation.mutate(data)
  })

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-500 mt-1">Manage your account settings and preferences</p>
      </div>

      {/* Profile Information */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary-100">
              <User className="h-5 w-5 text-primary-600" />
            </div>
            <CardTitle>Profile Information</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={onProfileSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="First Name"
                {...profileForm.register('first_name')}
                error={profileForm.formState.errors.first_name?.message}
              />
              <Input
                label="Last Name"
                {...profileForm.register('last_name')}
                error={profileForm.formState.errors.last_name?.message}
              />
            </div>

            <Input
              label="Email"
              value={user?.email || ''}
              disabled
              className="bg-gray-50"
            />

            <Input
              label="School"
              {...profileForm.register('school_name')}
              placeholder="Enter your school name"
            />

            <div className="flex items-center justify-between pt-4 border-t">
              <p className="text-sm text-gray-500">
                Role: <span className="font-medium capitalize">{user?.role}</span>
              </p>
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100">
              <Lock className="h-5 w-5 text-yellow-600" />
            </div>
            <CardTitle>Security</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Password</p>
              <p className="text-sm text-gray-500">Change your password</p>
            </div>
            <Button variant="secondary" onClick={() => setShowPasswordModal(true)}>
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Account Actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-100">
              <LogOut className="h-5 w-5 text-red-600" />
            </div>
            <CardTitle>Account</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Sign Out</p>
              <p className="text-sm text-gray-500">Sign out of your account on this device</p>
            </div>
            <Button variant="danger" onClick={handleLogout}>
              Sign Out
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Change Password Modal */}
      <Modal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        title="Change Password"
      >
        <form onSubmit={onPasswordSubmit} className="space-y-4">
          <Input
            type="password"
            label="Current Password"
            {...passwordForm.register('current_password')}
            error={passwordForm.formState.errors.current_password?.message}
          />
          <Input
            type="password"
            label="New Password"
            {...passwordForm.register('new_password')}
            error={passwordForm.formState.errors.new_password?.message}
          />
          <Input
            type="password"
            label="Confirm New Password"
            {...passwordForm.register('new_password_confirm')}
            error={passwordForm.formState.errors.new_password_confirm?.message}
          />
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="secondary"
              className="flex-1"
              onClick={() => setShowPasswordModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={changePasswordMutation.isPending}
            >
              {changePasswordMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Changing...
                </>
              ) : (
                'Change Password'
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
