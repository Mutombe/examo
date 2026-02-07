import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Users,
  Search,
  Filter,
  MoreVertical,
  Shield,
  UserCheck,
  GraduationCap,
  Building2,
  User as UserIcon,
} from 'lucide-react'
import { Card, Button, Badge, Modal, Pagination } from '@/components/ui'
import { adminApi } from '@/lib/api'
import { cn } from '@/lib/utils'

type RoleFilter = 'all' | 'student' | 'teacher' | 'parent' | 'school_admin' | 'admin'

// Helper to extract array from API response (handles both paginated and non-paginated)
const getDataArray = (response: any): any[] => {
  if (!response?.data) return []
  if (Array.isArray(response.data)) return response.data
  if (Array.isArray(response.data.results)) return response.data.results
  return []
}

export function AdminUsersPage() {
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

  // Fetch users
  const { data: users, isLoading } = useQuery({
    queryKey: ['admin', 'users', page],
    queryFn: () => adminApi.getUsers({ page }),
  })

  // Update role mutation
  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: string }) =>
      adminApi.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      setShowRoleModal(false)
    },
  })

  const roleFilters = [
    { id: 'all', label: 'All Users', icon: Users },
    { id: 'student', label: 'Students', icon: GraduationCap },
    { id: 'teacher', label: 'Teachers', icon: UserCheck },
    { id: 'parent', label: 'Parents', icon: UserIcon },
    { id: 'school_admin', label: 'School Admins', icon: Building2 },
    { id: 'admin', label: 'Admins', icon: Shield },
  ]

  const roleOptions = [
    { value: 'student', label: 'Student' },
    { value: 'teacher', label: 'Teacher' },
    { value: 'parent', label: 'Parent' },
    { value: 'school_admin', label: 'School Admin' },
    { value: 'admin', label: 'Admin' },
  ]

  const filteredUsers = getDataArray(users).filter((user: any) => {
    const matchesRole = roleFilter === 'all' || user.role === roleFilter
    const matchesSearch =
      user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesRole && matchesSearch
  })

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case 'admin':
        return 'danger'
      case 'school_admin':
        return 'warning'
      case 'teacher':
        return 'info'
      case 'parent':
        return 'secondary'
      default:
        return 'success'
    }
  }

  const handleChangeRole = (user: any) => {
    setSelectedUser(user)
    setShowRoleModal(true)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">User Management</h1>
        <p className="text-gray-500 mt-1">Manage users and their roles</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
        {roleFilters.map((filter) => {
          const usersArray = getDataArray(users)
          const count = filter.id === 'all'
            ? usersArray.length
            : usersArray.filter((u: any) => u.role === filter.id).length
          return (
            <button
              key={filter.id}
              onClick={() => setRoleFilter(filter.id as RoleFilter)}
              className={cn(
                'p-3 sm:p-4 rounded-lg text-left transition-colors',
                roleFilter === filter.id
                  ? 'bg-primary-100 border-2 border-primary-500'
                  : 'bg-white border border-gray-200 hover:border-primary-300'
              )}
            >
              <filter.icon className={cn(
                'h-5 w-5 mb-2',
                roleFilter === filter.id ? 'text-primary-600' : 'text-gray-400'
              )} />
              <p className="text-lg sm:text-2xl font-bold text-gray-900">{count}</p>
              <p className="text-xs sm:text-sm text-gray-500">{filter.label}</p>
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search users by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
        />
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto" />
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">User</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Role</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Joined</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Status</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-500">Activity</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers?.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  filteredUsers?.map((user: any) => (
                    <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600">
                              {user.first_name?.[0]}{user.last_name?.[0]}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={getRoleBadgeVariant(user.role)}>
                          {user.role?.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {new Date(user.date_joined || user.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant={user.is_active ? 'success' : 'secondary'}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-500">
                        {user.total_questions_attempted || 0} questions
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleChangeRole(user)}
                        >
                          Change Role
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Pagination
        currentPage={page}
        totalCount={users?.data?.count || getDataArray(users).length}
        onPageChange={setPage}
      />

      {/* Change Role Modal */}
      <Modal
        isOpen={showRoleModal}
        onClose={() => setShowRoleModal(false)}
        title="Change User Role"
      >
        {selectedUser && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-primary-600">
                  {selectedUser.first_name?.[0]}{selectedUser.last_name?.[0]}
                </span>
              </div>
              <div>
                <p className="font-medium text-gray-900">
                  {selectedUser.first_name} {selectedUser.last_name}
                </p>
                <p className="text-sm text-gray-500">{selectedUser.email}</p>
              </div>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Current Role</p>
              <Badge variant={getRoleBadgeVariant(selectedUser.role)}>
                {selectedUser.role?.replace('_', ' ')}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Select New Role</p>
              <div className="grid grid-cols-2 gap-2">
                {roleOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => updateRoleMutation.mutate({
                      userId: selectedUser.id,
                      role: option.value,
                    })}
                    disabled={selectedUser.role === option.value || updateRoleMutation.isPending}
                    className={cn(
                      'p-3 rounded-lg text-sm font-medium border transition-colors',
                      selectedUser.role === option.value
                        ? 'bg-gray-100 border-gray-300 text-gray-400 cursor-not-allowed'
                        : 'bg-white border-gray-200 text-gray-700 hover:border-primary-500 hover:bg-primary-50'
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
