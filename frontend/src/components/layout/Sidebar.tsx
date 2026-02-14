import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  FileText,
  TrendingUp,
  Bookmark,
  Users,
  ClipboardList,
  Shield,
  Building2,
  UserCheck,
  Home,
  Settings,
  Library,
  Bell,
  X,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/authStore'
import { useNotificationStore } from '@/stores/notificationStore'

const publicNavigation = [
  { name: 'Subjects', href: '/subjects', icon: BookOpen },
  { name: 'Papers', href: '/papers', icon: FileText },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
]

const studentNavigation = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Subjects', href: '/subjects', icon: BookOpen },
  { name: 'Papers', href: '/papers', icon: FileText },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Assignments', href: '/assignments', icon: ClipboardList },
  { name: 'My Progress', href: '/progress', icon: TrendingUp },
  { name: 'Notifications', href: '/notifications', icon: Bell },
  { name: 'Bookmarks', href: '/bookmarks', icon: Bookmark },
]

const teacherNavigation = [
  { name: 'Teacher Dashboard', href: '/teacher', icon: LayoutDashboard },
  { name: 'My Classes', href: '/teacher/classes', icon: Users },
  { name: 'Assignments', href: '/teacher/assignments', icon: ClipboardList },
]

const parentNavigation = [
  { name: 'Parent Portal', href: '/parent', icon: LayoutDashboard },
]

const schoolAdminNavigation = [
  { name: 'School Dashboard', href: '/school', icon: Building2 },
]

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/admin', icon: Shield },
  { name: 'Manage Papers', href: '/admin/papers', icon: FileText },
  { name: 'Manage Users', href: '/admin/users', icon: UserCheck },
]

interface SidebarProps {
  mobileOpen?: boolean
  onClose?: () => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function Sidebar({ mobileOpen = false, onClose, collapsed = false, onToggleCollapse }: SidebarProps) {
  const location = useLocation()
  const user = useAuthStore((state) => state.user)
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const unreadCount = useNotificationStore((state) => state.unreadCount)

  const isTeacher =
    user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'admin'
  const isParent = user?.role === 'parent'
  const isSchoolAdmin = user?.role === 'school_admin' || user?.role === 'admin'
  const isAdmin = user?.role === 'admin'

  // Determine main navigation based on role
  const getMainNavigation = () => {
    if (!isAuthenticated) return publicNavigation
    if (isParent) return parentNavigation
    return studentNavigation
  }

  const mainNavigation = getMainNavigation()

  const handleNavClick = () => {
    onClose?.()
  }

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-200 ease-in-out lg:translate-x-0',
          collapsed ? 'lg:w-16' : 'lg:w-64',
          'w-64',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col overflow-hidden bg-white border-r border-gray-200">
          {/* Logo + close/collapse buttons */}
          <div className="flex h-14 sm:h-16 items-center justify-between px-4 border-b border-gray-200">
            <Link to="/" onClick={handleNavClick} className={cn(
              'flex items-center gap-2 hover:opacity-80 transition-opacity',
              collapsed && 'lg:justify-center'
            )}>
              <img src="/logo.png" alt="ExamRevise" className={cn(
                'object-contain',
                collapsed ? 'h-8 w-8' : 'h-10 w-10 sm:h-16 sm:w-16'
              )} loading="eager" />
            </Link>
            <button
              className="lg:hidden p-1.5 rounded-lg hover:bg-gray-100"
              onClick={onClose}
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
            {/* Desktop collapse toggle */}
            <button
              className="hidden lg:flex p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
              onClick={onToggleCollapse}
              aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {collapsed ? (
                <ChevronsRight className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronsLeft className="h-4 w-4 text-gray-500" />
              )}
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 space-y-1 px-2 lg:px-3 py-4 overflow-y-auto scrollbar-thin">
            {/* Main Navigation */}
            <div className="mb-4">
              {!collapsed && (
                <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                  {isAuthenticated ? (isParent ? 'Monitor' : 'Learn') : 'Browse'}
                </p>
              )}
              {mainNavigation.map((item) => {
                const isActive =
                  item.href === '/' || item.href === '/dashboard' || item.href === '/parent' || item.href === '/school' || item.href === '/admin'
                    ? location.pathname === item.href
                    : location.pathname.startsWith(item.href)
                const showBadge = item.name === 'Notifications' && unreadCount > 0
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={handleNavClick}
                    title={collapsed ? item.name : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors relative',
                      collapsed && 'lg:justify-center lg:px-0',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className={cn('flex-1', collapsed && 'lg:hidden')}>{item.name}</span>
                    {showBadge && (
                      <span className={cn(
                        'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full',
                        collapsed && 'lg:absolute lg:-top-1 lg:-right-1 lg:min-w-[16px] lg:h-4 lg:px-1 lg:text-[10px]'
                      )}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Teacher Navigation */}
            {isTeacher && (
              <div className="pt-4 border-t border-gray-200">
                {!collapsed && (
                  <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Teach
                  </p>
                )}
                {teacherNavigation.map((item) => {
                  const isActive =
                    item.href === '/teacher'
                      ? location.pathname === '/teacher'
                      : location.pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        collapsed && 'lg:justify-center lg:px-0',
                        isActive
                          ? 'bg-blue-50 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={cn(collapsed && 'lg:hidden')}>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* School Admin Navigation */}
            {isSchoolAdmin && (
              <div className="pt-4 border-t border-gray-200">
                {!collapsed && (
                  <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    School
                  </p>
                )}
                {schoolAdminNavigation.map((item) => {
                  const isActive = location.pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        collapsed && 'lg:justify-center lg:px-0',
                        isActive
                          ? 'bg-purple-50 text-purple-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={cn(collapsed && 'lg:hidden')}>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Admin Navigation */}
            {isAdmin && (
              <div className="pt-4 border-t border-gray-200">
                {!collapsed && (
                  <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Admin
                  </p>
                )}
                {adminNavigation.map((item) => {
                  const isActive = location.pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      onClick={handleNavClick}
                      title={collapsed ? item.name : undefined}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        collapsed && 'lg:justify-center lg:px-0',
                        isActive
                          ? 'bg-red-50 text-red-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      )}
                    >
                      <item.icon className="h-5 w-5 shrink-0" />
                      <span className={cn(collapsed && 'lg:hidden')}>{item.name}</span>
                    </Link>
                  )
                })}
              </div>
            )}

            {/* Sign up CTA for guests */}
            {!isAuthenticated && !collapsed && (
              <div className="pt-4 mt-4 border-t border-gray-200">
                <div className="px-3 py-4 bg-primary-50 rounded-lg">
                  <p className="text-sm font-medium text-primary-900 mb-2">
                    Get AI-powered feedback
                  </p>
                  <p className="text-xs text-primary-700 mb-3">
                    Sign up free to track progress and get personalized feedback
                  </p>
                  <Link
                    to="/register"
                    onClick={handleNavClick}
                    className="block w-full px-3 py-2 text-sm font-medium text-center text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Sign Up Free
                  </Link>
                </div>
              </div>
            )}
          </nav>

          {/* User info and footer */}
          <div className={cn('border-t border-gray-200', collapsed ? 'p-2' : 'p-3 sm:p-4')}>
            {isAuthenticated && user && (
              <div className="mb-3">
                <Link
                  to="/profile"
                  onClick={handleNavClick}
                  title={collapsed ? `${user.first_name || user.username} ${user.last_name || ''}` : undefined}
                  className={cn(
                    'flex items-center gap-2 p-2 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors',
                    collapsed && 'lg:justify-center lg:p-1.5'
                  )}
                >
                  <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center shrink-0">
                    <span className="text-sm font-medium text-primary-600">
                      {user.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                      {user.last_name?.[0] || ''}
                    </span>
                  </div>
                  <div className={cn('min-w-0 flex-1', collapsed && 'lg:hidden')}>
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {user.first_name || user.username} {user.last_name}
                    </p>
                    <p className="text-xs text-gray-500 capitalize">{user.role}</p>
                  </div>
                  <Settings className={cn('h-4 w-4 text-gray-400', collapsed && 'lg:hidden')} />
                </Link>
              </div>
            )}
            {!collapsed && (
              <p className="text-xs text-gray-500 text-center">
                A product of{' '}
                <a
                  href="https://bitstudio.co.zw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Bit Studio ZW
                </a>
              </p>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
