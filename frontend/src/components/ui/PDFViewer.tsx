import { useState, useCallback, useEffect, useRef } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize2, Minimize2, X, Target, Download, Loader2 } from 'lucide-react'
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
  const [scale, setScale] = useState<number>(1.0)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false)
  const [loading, setLoading] = useState<boolean>(true)
  const [loadProgress, setLoadProgress] = useState<number>(0)
  const [error, setError] = useState<string | null>(null)
  const [showPositionIndicator, setShowPositionIndicator] = useState<boolean>(!!initialPosition)
  const contentRef = useRef<HTMLDivElement>(null)
  const [pageHeight, setPageHeight] = useState<number>(0)

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages)
    setLoading(false)
    setLoadProgress(100)
    if (onPageChange) {
      onPageChange(pageNumber, numPages)
    }
  }, [pageNumber, onPageChange])

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

  const zoomIn = () => setScale((prev) => Math.min(prev + 0.25, 3))
  const zoomOut = () => setScale((prev) => Math.max(prev - 0.25, 0.5))

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
    'bg-white rounded-lg shadow-lg flex flex-col',
    isFullscreen ? 'fixed inset-0 z-50' : isModal ? 'max-h-[90vh]' : 'h-full'
  )

  // Calculate indicator position
  const indicatorPosition = initialPosition ? positionToScrollPercent[initialPosition] || 0 : 0

  // Document options - enable range requests for faster loading of large PDFs
  const documentOptions = {
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    disableAutoFetch: false,
    disableStream: false,
    disableRange: false,
  }

  return (
    <div className={containerClasses}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          {title && <h3 className="font-semibold text-gray-900 truncate max-w-xs">{title}</h3>}
          {numPages > 0 && (
            <span className="text-sm text-gray-500">
              Page {pageNumber} of {numPages}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <div className="flex items-center gap-1 mr-2">
            <Button variant="ghost" size="sm" onClick={zoomOut} disabled={scale <= 0.5}>
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
      <div ref={contentRef} className="flex-1 overflow-auto bg-gray-100 p-4 relative">
        {loading && (
          <div className="flex flex-col items-center justify-center h-64 gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">Loading PDF...</p>
              {loadProgress > 0 && loadProgress < 100 && (
                <div className="mt-2 w-48">
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-600 rounded-full transition-all duration-300"
                      style={{ width: `${loadProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">{loadProgress}%</p>
                </div>
              )}
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
                <div className="flex items-center justify-center h-64 w-96 bg-white">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
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

      {/* Navigation */}
      <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 rounded-b-lg">
        <Button
          variant="secondary"
          onClick={previousPage}
          disabled={pageNumber <= 1}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {/* Page selector */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">Go to page:</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={pageNumber}
            onChange={(e) => goToPage(parseInt(e.target.value) || 1)}
            className="w-16 px-2 py-1 text-center border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>

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
  )
}

// Modal wrapper for PDF viewer
interface PDFViewerModalProps extends PDFViewerProps {
  isOpen: boolean
}

export function PDFViewerModal({ isOpen, onClose, ...props }: PDFViewerModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      {/* Modal content */}
      <div className="relative w-full max-w-4xl mx-4 max-h-[90vh]">
        <PDFViewer {...props} onClose={onClose} isModal />
      </div>
    </div>
  )
}
