import { useState } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { BookOpen, FileText, Menu, X, Facebook, Mail, Library, Bookmark as BookmarkIcon, LayoutDashboard, LogOut, User } from 'lucide-react'
import { FaXTwitter } from 'react-icons/fa6'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { AuthPromptModal } from '@/components/auth/AuthPromptModal'
import { AuthModal } from '@/components/auth/AuthModal'
import { PaperUploadModal } from '@/components/papers/PaperUploadModal'
import { ScrollToTop } from '@/components/ui/ScrollToTop'
import { useAuthStore } from '@/stores/authStore'
import { useGuestStore } from '@/stores/guestStore'
import { useUIStore } from '@/stores/uiStore'

const navigation = [
  { name: 'Subjects', href: '/subjects', icon: BookOpen },
  { name: 'Papers', href: '/papers', icon: FileText },
  { name: 'Library', href: '/library', icon: Library },
  { name: 'Bookmarks', href: '/bookmarks', icon: BookmarkIcon },
]

export function PublicLayout() {
  const location = useLocation()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuthStore()
  const { shouldShowAuthModal, dismissAuthModal, getAnswerCount } = useGuestStore()
  const {
    isAuthModalOpen,
    authModalTab,
    openAuthModal,
    closeAuthModal,
    isPaperUploadModalOpen,
    closePaperUploadModal,
  } = useUIStore()
  const answerCount = getAnswerCount()

  const handleLogout = () => {
    logout()
    window.location.href = '/'
  }

  const getDashboardPath = () => {
    switch (user?.role) {
      case 'admin': return '/admin'
      case 'school_admin': return '/school'
      case 'teacher': return '/teacher'
      case 'parent': return '/parent'
      default: return '/dashboard'
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="ExamRevise" className="h-16 w-16 object-contain" loading="eager"/>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-6">
              {navigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={cn(
                      'flex items-center gap-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'text-primary-600'
                        : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* Auth Buttons / User Menu */}
            <div className="flex items-center gap-3">
              {isAuthenticated && user ? (
                <>
                  <Link
                    to={getDashboardPath()}
                    className="hidden sm:flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700 transition-colors"
                  >
                    <LayoutDashboard className="h-4 w-4" />
                    Dashboard
                  </Link>
                  <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-gray-200">
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary-100 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-600">
                          {user.first_name?.[0] || user.email?.[0]?.toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {user.first_name || user.username}
                      </span>
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                      title="Sign out"
                    >
                      <LogOut className="h-4 w-4" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {answerCount > 0 && (
                    <span className="hidden sm:inline text-sm text-gray-500">
                      {answerCount} questions answered
                    </span>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => openAuthModal('login')}>
                    Sign in
                  </Button>
                  <Button size="sm" className="hidden sm:flex" onClick={() => openAuthModal('register')}>
                    Get Started Free
                  </Button>
                </>
              )}

              {/* Mobile menu button */}
              <button
                className="md:hidden p-2 text-gray-600"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? (
                  <X className="h-6 w-6" />
                ) : (
                  <Menu className="h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200 bg-white">
            <nav className="px-4 py-3 space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname.startsWith(item.href)
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
                      isActive
                        ? 'bg-primary-50 text-primary-700'
                        : 'text-gray-700 hover:bg-gray-100'
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </Link>
                )
              })}
              <div className="pt-3 border-t border-gray-200">
                {isAuthenticated && user ? (
                  <div className="space-y-2">
                    <Link
                      to={getDashboardPath()}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50"
                    >
                      <LayoutDashboard className="h-5 w-5" />
                      Dashboard
                    </Link>
                    <Link
                      to="/profile"
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
                    >
                      <User className="h-5 w-5" />
                      {user.first_name || user.username} {user.last_name || ''}
                    </Link>
                    <button
                      onClick={() => { setMobileMenuOpen(false); handleLogout() }}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 w-full"
                    >
                      <LogOut className="h-5 w-5" />
                      Sign out
                    </button>
                  </div>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      openAuthModal('register')
                    }}
                  >
                    Get Started Free
                  </Button>
                )}
              </div>
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
            {/* Brand */}
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <img src="/logo.png" alt="ExamRevise" className="h-16 w-16 object-contain" />
              </div>
              <p className="text-sm text-gray-600 mb-4">
                AI-powered exam preparation for Zimbabwean students. Practice with
                real past papers and get instant feedback.
              </p>
              <div className="flex gap-4">
                <a href="#" className="text-gray-400 hover:text-gray-600">
                  <Facebook className="h-5 w-5" />
                </a>
                <a href="#" className="text-gray-400 hover:text-gray-600">
                  <FaXTwitter className="h-5 w-5" />
                </a>
                <a href="mailto:support@examrevise.co.zw" className="text-gray-400 hover:text-gray-600">
                  <Mail className="h-5 w-5" />
                </a>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Quick Links</h3>
              <ul className="space-y-2">
                <li>
                  <Link to="/subjects" className="text-sm text-gray-600 hover:text-primary-600">
                    Browse Subjects
                  </Link>
                </li>
                <li>
                  <Link to="/papers" className="text-sm text-gray-600 hover:text-primary-600">
                    Past Papers
                  </Link>
                </li>
                <li>
                  <Link to="/library" className="text-sm text-gray-600 hover:text-primary-600">
                    Resource Library
                  </Link>
                </li>
                <li>
                  <Link to="/bookmarks" className="text-sm text-gray-600 hover:text-primary-600">
                    Bookmarks
                  </Link>
                </li>
                {isAuthenticated ? (
                  <>
                    <li>
                      <Link to={getDashboardPath()} className="text-sm text-gray-600 hover:text-primary-600">
                        Dashboard
                      </Link>
                    </li>
                    <li>
                      <Link to="/profile" className="text-sm text-gray-600 hover:text-primary-600">
                        My Profile
                      </Link>
                    </li>
                  </>
                ) : (
                  <>
                    <li>
                      <button
                        onClick={() => openAuthModal('register')}
                        className="text-sm text-gray-600 hover:text-primary-600"
                      >
                        Create Account
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => openAuthModal('login')}
                        className="text-sm text-gray-600 hover:text-primary-600"
                      >
                        Sign In
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Exam Boards */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Exam Boards</h3>
              <ul className="space-y-2">
                <li>
                  <span className="text-sm text-gray-600">ZIMSEC O-Level</span>
                </li>
                <li>
                  <span className="text-sm text-gray-600">ZIMSEC A-Level</span>
                </li>
                <li>
                  <span className="text-sm text-gray-600">Cambridge IGCSE</span>
                </li>
                <li>
                  <span className="text-sm text-gray-600">Cambridge A-Level</span>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="font-semibold text-gray-900 mb-4">Support</h3>
              <ul className="space-y-2">
                <li>
                  <a href="mailto:support@examrevise.co.zw" className="text-sm text-gray-600 hover:text-primary-600">
                    Help Center
                  </a>
                </li>
                <li>
                  <a href="mailto:support@examrevise.co.zw" className="text-sm text-gray-600 hover:text-primary-600">
                    Contact Us
                  </a>
                </li>
                <li>
                  <Link to="/privacy" className="text-sm text-gray-600 hover:text-primary-600">
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link to="/terms" className="text-sm text-gray-600 hover:text-primary-600">
                    Terms of Service
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom */}
          <div className="mt-8 pt-8 border-t border-gray-200">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <p className="text-sm text-gray-500">
                &copy; {new Date().getFullYear()} ExamRevise Zimbabwe. All rights reserved.
              </p>
              <p className="text-sm text-gray-500">
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
            </div>
          </div>
        </div>
      </footer>

      {/* Scroll to top */}
      <ScrollToTop />

      {/* Modals */}
      <AuthPromptModal isOpen={shouldShowAuthModal} onClose={dismissAuthModal} />
      <AuthModal isOpen={isAuthModalOpen} onClose={closeAuthModal} defaultTab={authModalTab} />
      <PaperUploadModal isOpen={isPaperUploadModalOpen} onClose={closePaperUploadModal} />
    </div>
  )
}
