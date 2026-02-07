import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Clock, Award, Upload } from 'lucide-react'
import { Card, Button, Badge, CardSkeleton, Pagination } from '@/components/ui'
import { examsApi, type Paper } from '@/lib/api'
import { useUIStore } from '@/stores/uiStore'

export function PapersPage() {
  const openPaperUploadModal = useUIStore((state) => state.openPaperUploadModal)
  const [searchParams] = useSearchParams()
  const subjectId = searchParams.get('subject')
  const boardId = searchParams.get('board')

  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState({
    subject: subjectId || '',
    board: boardId || '',
    level: '',
    year: '',
  })

  const { data: papers, isLoading } = useQuery({
    queryKey: ['papers', filters, page],
    queryFn: () =>
      examsApi.getPapers({
        subject: filters.subject ? parseInt(filters.subject) : undefined,
        board: filters.board ? parseInt(filters.board) : undefined,
        level: filters.level || undefined,
        year: filters.year ? parseInt(filters.year) : undefined,
        page,
      }),
  })

  const { data: subjects } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => examsApi.getSubjects(),
  })

  const { data: boards } = useQuery({
    queryKey: ['boards'],
    queryFn: () => examsApi.getBoards(),
  })

  const paperList = papers?.data?.results || papers?.data || []
  const totalCount = papers?.data?.count || 0
  const subjectList = subjects?.data || []
  const boardList = boards?.data || []

  const handleFilterChange = (newFilters: typeof filters) => {
    setFilters(newFilters)
    setPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Exam Papers</h1>
          <p className="text-gray-500 text-sm sm:text-base mt-1">Browse and practice past exam papers</p>
        </div>
        <Button onClick={openPaperUploadModal} className="self-start sm:self-auto">
          <Upload className="h-4 w-4 mr-2" />
          Upload Paper
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <select
            className="input"
            value={filters.board}
            onChange={(e) => handleFilterChange({ ...filters, board: e.target.value })}
          >
            <option value="">All Boards</option>
            {boardList.map((board: any) => (
              <option key={board.id} value={board.id}>
                {board.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={filters.subject}
            onChange={(e) => handleFilterChange({ ...filters, subject: e.target.value })}
          >
            <option value="">All Subjects</option>
            {subjectList.map((subject: any) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={filters.level}
            onChange={(e) => handleFilterChange({ ...filters, level: e.target.value })}
          >
            <option value="">All Levels</option>
            <option value="o_level">O Level</option>
            <option value="a_level">A Level</option>
            <option value="igcse">IGCSE</option>
            <option value="as_level">AS Level</option>
          </select>

          <select
            className="input"
            value={filters.year}
            onChange={(e) => handleFilterChange({ ...filters, year: e.target.value })}
          >
            <option value="">All Years</option>
            {[2024, 2023, 2022, 2021, 2020, 2019].map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Papers list */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : paperList.length === 0 ? (
        <Card className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="font-semibold text-gray-900">No papers found</h3>
          <p className="text-gray-500 mt-1">Try adjusting your filters</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paperList.map((paper: Paper) => (
              <Link key={paper.id} to={`/papers/${paper.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 rounded-lg bg-primary-50">
                      <FileText className="h-5 w-5 text-primary-600" />
                    </div>
                    <Badge>{paper.year}</Badge>
                  </div>

                  <h3 className="font-semibold text-gray-900 mb-1">{paper.title}</h3>

                  <div className="text-sm text-gray-500 space-y-1">
                    <p>{paper.syllabus.subject_name}</p>
                    <p>
                      {paper.syllabus.board_name} - {paper.syllabus.level_display}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-4 mt-4 pt-4 border-t text-sm text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {paper.duration_minutes} min
                    </div>
                    <div className="flex items-center gap-1">
                      <Award className="h-4 w-4" />
                      {paper.total_marks} marks
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4" />
                      {paper.question_count} questions
                    </div>
                  </div>
                </Card>
              </Link>
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
  )
}
