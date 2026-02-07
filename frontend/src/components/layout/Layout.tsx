import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { ScrollToTop } from '@/components/ui/ScrollToTop'
import { PaperUploadModal } from '@/components/papers/PaperUploadModal'
import { useUIStore } from '@/stores/uiStore'

export function Layout() {
  const { isPaperUploadModalOpen, closePaperUploadModal } = useUIStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header onMenuToggle={() => setSidebarOpen(true)} />
        <main className="p-3 sm:p-4 lg:p-8 flex-1">
          <Outlet />
        </main>
        {/* Mobile footer - hidden on lg screens since sidebar has footer */}
        <footer className="lg:hidden bg-white border-t border-gray-200 py-3 px-4">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="ExamRevise" className="h-10 w-10 object-contain" loading="eager"/>
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
