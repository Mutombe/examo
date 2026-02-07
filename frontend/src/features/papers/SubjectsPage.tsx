import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { BookOpen } from 'lucide-react'
import { Card, CardSkeleton } from '@/components/ui'
import { examsApi } from '@/lib/api'

export function SubjectsPage() {
  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: () => examsApi.getSubjects(),
  })

  const subjectList = subjects?.data || []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Subjects</h1>
        <p className="text-gray-500 mt-1">Choose a subject to browse exam papers</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subjectList.map((subject: any) => (
            <Link key={subject.id} to={`/papers?subject=${subject.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${subject.color}20` }}
                  >
                    <BookOpen className="h-6 w-6" style={{ color: subject.color }} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">{subject.name}</h3>
                    {subject.code && (
                      <p className="text-sm text-gray-500">{subject.code}</p>
                    )}
                    {subject.description && (
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">
                        {subject.description}
                      </p>
                    )}
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
