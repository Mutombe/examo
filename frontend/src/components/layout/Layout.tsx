import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { PaperUploadModal } from '@/components/papers/PaperUploadModal'
import { useUIStore } from '@/stores/uiStore'

export function Layout() {
  const { isPaperUploadModalOpen, closePaperUploadModal } = useUIStore()

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Sidebar />
      <div className="lg:pl-64 flex flex-col flex-1">
        <Header />
        <main className="p-4 lg:p-8 flex-1">
          <Outlet />
        </main>
        {/* Mobile footer - hidden on lg screens since sidebar has footer */}
        <footer className="lg:hidden bg-white border-t border-gray-200 py-4 px-4">
          <div className="flex items-center justify-center gap-2">
            <img src="/logo.png" alt="ExamRevise" className="h-16 w-16 object-contain" />
            <span className="text-sm text-gray-500">ExamRevise Zimbabwe</span>
          </div>
        </footer>
      </div>

      {/* Global Modals */}
      <PaperUploadModal isOpen={isPaperUploadModalOpen} onClose={closePaperUploadModal} />
    </div>
  )
}
