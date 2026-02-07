import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  BookOpen, Search, Star, Eye, Clock, ChevronRight,
  Sparkles, Filter, BookMarked, TrendingUp
} from 'lucide-react'
import { Card, Button, Badge, Pagination } from '@/components/ui'
import { libraryApi, type LibraryResource, type LibraryCategory } from '@/lib/api'
import { cn } from '@/lib/utils'

// Gradient backgrounds for resource cards
const GRADIENTS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-orange-500 to-red-600',
  'from-pink-500 to-rose-600',
  'from-indigo-500 to-blue-600',
]

function ResourceCard({ resource, index }: { resource: LibraryResource; index: number }) {
  const navigate = useNavigate()
  const gradient = GRADIENTS[index % GRADIENTS.length]

  return (
    <Card
      className="group cursor-pointer hover:shadow-lg transition-all duration-300 overflow-hidden border-0"
      onClick={() => navigate(`/library/${resource.slug}`)}
    >
      {/* Cover */}
      <div className={cn('h-48 bg-gradient-to-br flex items-center justify-center relative', gradient)}>
        <BookOpen className="h-16 w-16 text-white/30 group-hover:scale-110 transition-transform" />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
        {resource.is_featured && (
          <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Featured
          </div>
        )}
        {resource.reading_progress && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
            <div
              className="h-full bg-white transition-all"
              style={{ width: `${resource.reading_progress.progress_percent}%` }}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-gray-900 line-clamp-2 group-hover:text-primary-600 transition-colors">
            {resource.title}
          </h3>
        </div>
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <Badge variant="secondary" className="text-xs">{resource.type_display}</Badge>
          {resource.subject_name && (
            <Badge variant="info" className="text-xs">{resource.subject_name}</Badge>
          )}
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <BookMarked className="h-3 w-3" />
            {resource.page_count} pages
          </span>
          <span className="flex items-center gap-1">
            <Eye className="h-3 w-3" />
            {resource.view_count}
          </span>
          {resource.avg_rating > 0 && (
            <span className="flex items-center gap-1 text-yellow-600">
              <Star className="h-3 w-3 fill-yellow-400" />
              {resource.avg_rating.toFixed(1)}
            </span>
          )}
        </div>
        {resource.reading_progress && !resource.reading_progress.is_completed && (
          <div className="mt-3 flex items-center gap-2 text-xs text-primary-600">
            <Clock className="h-3 w-3" />
            Continue reading (p.{resource.reading_progress.current_page})
          </div>
        )}
        {resource.reading_progress?.is_completed && (
          <div className="mt-3 flex items-center gap-2 text-xs text-success-600">
            <BookOpen className="h-3 w-3" />
            Completed
          </div>
        )}
      </div>
    </Card>
  )
}

export function LibraryPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')
  const [selectedType, setSelectedType] = useState<string>('')
  const [page, setPage] = useState(1)

  const { data: categoriesData } = useQuery({
    queryKey: ['library-categories'],
    queryFn: () => libraryApi.getCategories(),
  })

  const { data: resourcesData, isLoading } = useQuery({
    queryKey: ['library-resources', selectedCategory, selectedType, searchQuery, page],
    queryFn: () => libraryApi.getResources({
      category: selectedCategory || undefined,
      type: selectedType || undefined,
      search: searchQuery || undefined,
      page,
    }),
  })

  const { data: featuredData } = useQuery({
    queryKey: ['library-featured'],
    queryFn: () => libraryApi.getFeatured(),
  })

  const categories: LibraryCategory[] = categoriesData?.data || []
  const resources: LibraryResource[] = resourcesData?.data?.results || resourcesData?.data || []
  const totalCount = resourcesData?.data?.count || 0
  const featured: LibraryResource[] = featuredData?.data || []

  const resourceTypes = [
    { value: '', label: 'All Types' },
    { value: 'booklet', label: 'Booklets' },
    { value: 'study_guide', label: 'Study Guides' },
    { value: 'notes', label: 'Notes' },
    { value: 'formula_sheet', label: 'Formula Sheets' },
    { value: 'revision', label: 'Revision' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 rounded-2xl p-4 sm:p-6 md:p-8 text-white overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 flex items-center gap-2 sm:gap-3">
            <BookOpen className="h-6 w-6 sm:h-8 sm:w-8" />
            Resource Library
          </h1>
          <p className="text-white/80 max-w-xl">
            Explore study materials, option booklets, and reference guides.
            Read directly in the app - no downloads needed.
          </p>

          {/* Search bar */}
          <div className="mt-4 sm:mt-6 relative max-w-lg">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search resources..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setPage(1) }}
              className="w-full pl-12 pr-4 py-3 rounded-xl text-gray-900 bg-white/95 backdrop-blur-sm border-0 focus:ring-2 focus:ring-white/50 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2">
        <Filter className="h-4 w-4 text-gray-400 flex-shrink-0" />
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => { setSelectedCategory(selectedCategory === cat.slug ? '' : cat.slug); setPage(1) }}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              selectedCategory === cat.slug
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {cat.name} ({cat.resource_count})
          </button>
        ))}
        <span className="text-gray-300 mx-1">|</span>
        {resourceTypes.map((type) => (
          <button
            key={type.value}
            onClick={() => { setSelectedType(type.value); setPage(1) }}
            className={cn(
              'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
              selectedType === type.value
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            )}
          >
            {type.label}
          </button>
        ))}
      </div>

      {/* Featured Section */}
      {featured.length > 0 && !searchQuery && !selectedCategory && !selectedType && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary-600" />
              Featured Resources
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((resource, i) => (
              <ResourceCard key={resource.id} resource={resource} index={i} />
            ))}
          </div>
        </div>
      )}

      {/* All Resources */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            {searchQuery ? `Search results for "${searchQuery}"` : 'All Resources'}
          </h2>
          <span className="text-sm text-gray-500">{resources.length} resources</span>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 bg-gray-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : resources.length === 0 ? (
          <Card className="p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">No resources found</h3>
            <p className="text-gray-500">
              {searchQuery ? 'Try a different search term' : 'Resources will appear here when available'}
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource, i) => (
                <ResourceCard key={resource.id} resource={resource} index={i} />
              ))}
            </div>
            <Pagination
              currentPage={page}
              totalCount={totalCount}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  )
}
