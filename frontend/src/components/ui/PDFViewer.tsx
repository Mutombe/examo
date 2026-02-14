import { useState, useCallback, useEffect, useRef, useMemo, Component, type ErrorInfo, type ReactNode } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, X, Target, Download, AlertTriangle } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

// Use local worker instead of CDN for faster loading
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

export type SourcePosition = 'top' | 'upper' | 'middle' | 'lower' | 'bottom' | ''

interface PDFViewerProps {
  url: string
  title?: string
  onClose?: () => void
  isModal?: boolean
  initialPage?: number
  initialPosition?: SourcePosition
  questionNumber?: string
  onPageChange?: (page: number, totalPages: number) => void
}

// Convert position to scroll percentage
const positionToScrollPercent: Record<string, number> = {
  top: 0,
  upper: 20,
  middle: 40,
  lower: 60,
  bottom: 80,
}

export function PDFViewer({
  url,
  title,
  onClose,
  isModal = false,
  initialPage = 1,
  initialPosition,
  questionNumber,
  onPageChange,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(0)
  const [pageNumber, setPageNumber] = useState<number>(initialPage)
  const [scale, setScale] = useState<number>(() =>
    window.innerWidth < 640 ? 0.6 : 0.7
  )
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadProgress, setLoadProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [showPositionIndicator, setShowPositionIndicator] = useState<boolean>(!!initialPosition)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageHeight, setPageHeight] = useState<number>(0)

  const pageNumberRef = useRef(pageNumber)
  pageNumberRef.current = pageNumber

  const onPageChangeRef = useRef(onPageChange)
  onPageChangeRef.current = onPageChange

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setLoadProgress(100)
    if (onPageChangeRef.current) {
      onPageChangeRef.current(pageNumberRef.current, numPages)
    }
  }, [])

  const onDocumentLoadError = useCallback((err: Error) => {
    setError('Failed to load PDF. Please try again.')
    setLoading(false)
    console.error('PDF load error:', err)
  }, [])

  const onDocumentLoadProgress = useCallback(({ loaded, total }: { loaded: number; total: number }) => {
    if (total > 0) {
      setLoadProgress(Math.round((loaded / total) * 100))
    }
  }, [])

  const onPageLoadSuccess = useCallback((page: any) => {
    setPageHeight(page.height * scale)

    // Scroll to position after page loads
    if (initialPosition && contentRef.current && pageNumber === initialPage) {
      const scrollPercent = positionToScrollPercent[initialPosition] || 0
      const scrollTarget = (scrollPercent / 100) * (page.height * scale)
      setTimeout(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = scrollTarget
        }
      }, 100)
    }
  }, [initialPosition, scale, pageNumber, initialPage])

  const goToPage = useCallback((page: number) => {
    const newPage = Math.max(1, Math.min(page, numPages))
    setPageNumber(newPage)
    setShowPositionIndicator(false) // Hide indicator when manually navigating
    if (onPageChange) {
      onPageChange(newPage, numPages)
    }
  }, [numPages, onPageChange])

  const previousPage = () => goToPage(pageNumber - 1)
  const nextPage = () => goToPage(pageNumber + 1)

  const zoomIn = () => setScale((prev) => Math.min(Math.round((prev + 0.1) * 10) / 10, 3))
  const zoomOut = () => setScale((prev) => Math.max(Math.round((prev - 0.1) * 10) / 10, 0.2))

  const toggleFullscreen = () => setIsFullscreen((prev) => !prev)

  // Hide position indicator after 5 seconds
  useEffect(() => {
    if (showPositionIndicator) {
      const timer = setTimeout(() => setShowPositionIndicator(false), 5000)
      return () => clearTimeout(timer)
    }
  }, [showPositionIndicator])

  const progress = numPages > 0 ? (pageNumber / numPages) * 100 : 0

  const containerClasses = cn(
    'bg-white rounded-xl shadow-xl flex flex-col',
    isFullscreen ? 'fixed inset-0 z-[60]' : isModal ? 'max-h-[calc(100vh-2.5rem)] sm:max-h-[calc(100vh-4rem)]' : 'h-full'
  )

  // Calculate indicator position
  const indicatorPosition = initialPosition ? positionToScrollPercent[initialPosition] || 0 : 0

  // Memoize document options to prevent Document re-mounting on every render
  // (a new object reference causes Document to destroy its worker and reload)
  const documentOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    disableAutoFetch: false,
    disableStream: false,
    disableRange: false,
  }), [])

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-b bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          {title && <h3 className="font-semibold text-gray-900 truncate max-w-[140px] sm:max-w-xs text-sm sm:text-base">{title}</h3>}
          {numPages > 0 && (
            <span className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
              Page {pageNumber} of {numPages}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Zoom controls - desktop only */}
          <div className="hidden sm:flex items-center gap-1 mr-2">
            <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.2}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-600 w-12 text-center">{Math.round(scale * 100)}%</span>
            <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
          {/* Download button */}
          <a href={url} target="_blank" rel="noopener noreferrer" title="Download PDF">
            <Button variant="ghost" size="sm">
              <Download className="h-4 w-4" />
            </Button>
          </a>
          {/* Fullscreen toggle */}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          {/* Close button */}
          {(onClose || isModal) && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Question indicator banner */}
      {questionNumber && pageNumber === initialPage && (
        <div className="bg-primary-100 border-b border-primary-200 px-4 py-2 flex items-center gap-2">
          <Target className="h-4 w-4 text-primary-600" />
          <span className="text-sm text-primary-800">
            Question {questionNumber} is on this page
            {initialPosition && ` (${initialPosition} section)`}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="h-1 bg-gray-200">
        <div
          className="h-full bg-primary-600 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* PDF Content */}
      <div ref={contentRef} className="flex-1 min-h-0 overflow-auto bg-gray-100 p-4 relative">
        {loading && (
          <div className="flex justify-center">
            <div
              className="bg-white shadow-lg animate-pulse"
              style={{ width: Math.round(595 * scale), aspectRatio: '210/297' }}
            >
              <div className="p-[5%] h-full flex flex-col">
                <div className="flex justify-center mb-[3%]">
                  <div className="h-[2%] w-1/3 bg-gray-200 rounded" />
                </div>
                <div className="flex justify-center mb-[4%]">
                  <div className="h-[2.5%] w-1/2 bg-gray-200 rounded" />
                </div>
                <div className="space-y-[1.5%] flex-1">
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-11/12 bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-4/5 bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-9/12 bg-gray-200 rounded" />
                  <div className="h-[3%]" />
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-10/12 bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-3/4 bg-gray-200 rounded" />
                  <div className="h-[3%]" />
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-5/6 bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                  <div className="h-[1.2%] w-2/3 bg-gray-200 rounded" />
                </div>
                {loadProgress > 0 && loadProgress < 100 && (
                  <div className="mt-auto pt-[3%]">
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-400 rounded-full transition-all duration-300"
                        style={{ width: `${loadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 text-center mt-1">{loadProgress}%</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {error && (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <p className="text-red-600">{error}</p>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <Button variant="secondary" size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download PDF Instead
              </Button>
            </a>
          </div>
        )}
        <div className="relative">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            onLoadProgress={onDocumentLoadProgress}
            loading={null}
            className="flex justify-center"
            options={documentOptions}
          >
            <Page
              pageNumber={pageNumber}
              scale={scale}
              renderTextLayer={false}
              renderAnnotationLayer={false}
              className="shadow-lg"
              onLoadSuccess={onPageLoadSuccess}
              loading={
                <div className="flex justify-center w-full">
                  <div
                    className="bg-white shadow-lg animate-pulse"
                    style={{ width: Math.round(595 * scale), aspectRatio: '210/297' }}
                  >
                    <div className="p-[5%] h-full flex flex-col">
                      <div className="flex justify-center mb-[3%]">
                        <div className="h-[2%] w-1/3 bg-gray-200 rounded" />
                      </div>
                      <div className="flex justify-center mb-[4%]">
                        <div className="h-[2.5%] w-1/2 bg-gray-200 rounded" />
                      </div>
                      <div className="space-y-[1.5%]">
                        <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-11/12 bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-4/5 bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-9/12 bg-gray-200 rounded" />
                        <div className="h-[3%]" />
                        <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-10/12 bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-full bg-gray-200 rounded" />
                        <div className="h-[1.2%] w-3/4 bg-gray-200 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              }
            />
          </Document>

          {/* Position indicator overlay */}
          {showPositionIndicator && pageNumber === initialPage && initialPosition && pageHeight > 0 && (
            <div
              className="absolute left-0 right-0 pointer-events-none flex justify-center"
              style={{ top: `${indicatorPosition}%` }}
            >
              <div className="bg-primary-500/20 border-2 border-primary-500 border-dashed rounded-lg px-4 py-2 animate-pulse">
                <div className="flex items-center gap-2 text-primary-700">
                  <Target className="h-5 w-5" />
                  <span className="font-medium">Question {questionNumber} area</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer navigation */}
      <div className="flex items-center justify-between px-2 sm:px-4 py-2 sm:py-3 border-t bg-gray-50 rounded-b-xl">
        {/* Mobile: zoom out | Desktop: Previous */}
        <div className="sm:hidden">
          <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.2} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden sm:block">
          <Button
            variant="secondary"
            onClick={previousPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </Button>
        </div>

        {/* Center: page navigation */}
        <div className="flex items-center gap-1 sm:gap-2">
          {/* Mobile prev/next arrows */}
          <button
            className="sm:hidden p-1.5 rounded text-gray-600 disabled:text-gray-300"
            onClick={previousPage}
            disabled={pageNumber <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="text-sm text-gray-600 hidden sm:inline">Go to page:</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageNumber}
            onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
            className="w-12 sm:w-16 px-1 sm:px-2 py-1 text-center text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
          {/* Mobile: show zoom percentage */}
          <span className="text-xs text-gray-500 sm:hidden">{Math.round(scale * 100)}%</span>

          <button
            className="sm:hidden p-1.5 rounded text-gray-600 disabled:text-gray-300"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mobile: zoom in | Desktop: Next */}
        <div className="sm:hidden">
          <Button variant="ghost" size="sm" onClick={zoomIn} disabled={scale >= 3} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
        <div className="hidden sm:block">
          <Button
            variant="secondary"
            onClick={nextPage}
            disabled={pageNumber >= numPages}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  )
}

// Error boundary to catch react-pdf canvas rendering crashes
interface PDFErrorBoundaryProps {
  children: ReactNode
  url: string
  onClose?: () => void
}

interface PDFErrorBoundaryState {
  hasError: boolean
}

class PDFErrorBoundary extends Component<PDFErrorBoundaryProps, PDFErrorBoundaryState> {
  constructor(props: PDFErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): PDFErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('PDFViewer error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-lg shadow-lg flex flex-col items-center justify-center p-8 gap-4 min-h-[300px]">
          <AlertTriangle className="h-10 w-10 text-amber-500" />
          <h3 className="font-semibold text-gray-900">PDF viewer encountered an error</h3>
          <p className="text-sm text-gray-500 text-center">The PDF viewer crashed. You can try reopening or download the file directly.</p>
          <div className="flex gap-3">
            <Button variant="secondary" onClick={() => this.setState({ hasError: false })}>
              Try Again
            </Button>
            <a href={this.props.url} target="_blank" rel="noopener noreferrer">
              <Button>
                <Download className="h-4 w-4 mr-2" />
                Download PDF
              </Button>
            </a>
            {this.props.onClose && (
              <Button variant="ghost" onClick={this.props.onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Modal wrapper for PDF viewer
interface PDFViewerModalProps extends PDFViewerProps {
  isOpen: boolean
}

export function PDFViewerModal({ isOpen, onClose, ...props }: PDFViewerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-5 sm:p-8">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Modal content */}
      <div className="relative w-full max-w-4xl max-h-[calc(100vh-2.5rem)] sm:max-h-[calc(100vh-4rem)]">
        <PDFErrorBoundary url={props.url} onClose={onClose}>
          <PDFViewer {...props} onClose={onClose} isModal />
        </PDFErrorBoundary>
      </div>
    </div>
  )
}
