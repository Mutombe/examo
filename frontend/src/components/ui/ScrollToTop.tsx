import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { ArrowUp } from 'lucide-react'

/**
 * Scrolls to top on route change and shows a floating "back to top" button.
 */
export function ScrollToTop() {
  const { pathname } = useLocation()
  const [visible, setVisible] = useState(false)

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  // Show button when scrolled down
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <button
      onClick={scrollToTop}
      aria-label="Scroll to top"
      className={`fixed bottom-6 right-6 z-50 p-3 rounded-full bg-primary-600 text-white shadow-lg hover:bg-primary-700 transition-all duration-300 ${
        visible
          ? 'opacity-100 translate-y-0'
          : 'opacity-0 translate-y-4 pointer-events-none'
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  )
}
