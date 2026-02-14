import { useState, useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ScrollToTop } from '@/components/ui/ScrollToTop'
import { PaperUploadModal } from '@/components/papers/PaperUploadModal'
import { useUIStore } from '@/stores/uiStore'
import { useNotificationStore } from '@/stores/notificationStore'

export function Layout() {
  const { isPaperUploadModalOpen, closePaperUploadModal } = useUIStore()
  const fetchUnreadCount = useNotificationStore((state) => state.fetchUnreadCount)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    } catch {
      return false
    }
  })

  const toggleSidebarCollapse = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev
      try { localStorage.setItem('sidebar-collapsed', String(next)) } catch {}
      return next
    })
  }, [])

  // Poll unread notification count every 30 seconds
  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Sidebar
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      <div className={`${sidebarCollapsed ? 'lg:pl-16' : 'lg:pl-64'} flex flex-col flex-1 transition-all duration-200`}>
        <Header onMenuToggle={() => setSidebarOpen(true)} />
        <main className="p-3 sm:p-4 lg:p-8 flex-1">
          <Outlet />
        </main>
        {/* Mobile footer - hidden on lg screens since sidebar has footer */}
        <footer className="lg:hidden bg-white border-t border-gray-200 py-3 px-4">
          <div className="flex flex-col items-center gap-1">
            <img src="/logo.png" alt="ExamRevise" className="h-10 w-10 object-contain" loading="eager"/>
            <p className="text-xs text-gray-500">
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
        </footer>
      </div>

      {/* Scroll to top */}
      <ScrollToTop />

      {/* Global Modals */}
      <PaperUploadModal isOpen={isPaperUploadModalOpen} onClose={closePaperUploadModal} />
    </div>
  )
}
