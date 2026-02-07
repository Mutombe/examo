import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  BookOpen,
  Brain,
  TrendingUp,
  CheckCircle,
  Users,
  Award,
  Clock,
  ArrowRight,
  Star,
  LayoutDashboard,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useAuthStore } from '@/stores/authStore'
import { useUIStore } from '@/stores/uiStore'

const rotatingWords = [
  'AI-Powered',
  'Smart',
  'Instant',
  'Personalized',
  'Exam-Ready',
]

const features = [
  {
    icon: BookOpen,
    title: 'ZIMSEC & Cambridge Papers',
    description:
      'Access thousands of past exam papers from ZIMSEC and Cambridge IGCSE/A-Level examinations.',
  },
  {
    icon: Brain,
    title: 'AI-Powered Marking',
    description:
      'Get instant, detailed feedback on your answers using advanced AI technology.',
  },
  {
    icon: TrendingUp,
    title: 'Track Your Progress',
    description:
      'Monitor your improvement over time with detailed analytics and performance insights.',
  },
  {
    icon: Users,
    title: 'Teacher Dashboard',
    description:
      'Teachers can create classes, assign papers, and track student performance.',
  },
]

const subjects = [
  { name: 'Mathematics', papers: 150, color: '#3B82F6' },
  { name: 'Physics', papers: 120, color: '#8B5CF6' },
  { name: 'Chemistry', papers: 110, color: '#10B981' },
  { name: 'Biology', papers: 100, color: '#F59E0B' },
  { name: 'English', papers: 90, color: '#EF4444' },
  { name: 'History', papers: 80, color: '#6366F1' },
]

const stats = [
  { value: '1000+', label: 'Questions' },
  { value: '50+', label: 'Past Papers' },
  { value: '20+', label: 'Subjects' },
  { value: '100+', label: 'Students' },
]

const testimonials = [
  {
    name: 'Tatenda M.',
    role: 'Form 4 Student',
    content:
      'ExamRevise helped me improve my Maths grade from C to A. The AI feedback showed me exactly where I was going wrong.',
    rating: 5,
  },
  {
    name: 'Mrs. Chigumba',
    role: 'Physics Teacher',
    content:
      'I can now easily assign past papers to my students and track their progress. It saves me hours of marking time.',
    rating: 5,
  },
  {
    name: 'Kudakwashe T.',
    role: 'A-Level Student',
    content:
      'The Cambridge past papers are exactly what I needed. Being able to practice anytime has boosted my confidence.',
    rating: 5,
  },
]

export function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const { user, isAuthenticated } = useAuthStore()
  const { openAuthModal } = useUIStore()

  const getDashboardPath = () => {
    switch (user?.role) {
      case 'admin': return '/admin'
      case 'school_admin': return '/school'
      case 'teacher': return '/teacher'
      case 'parent': return '/parent'
      default: return '/dashboard'
    }
  }

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true)
      setTimeout(() => {
        setWordIndex((prev) => (prev + 1) % rotatingWords.length)
        setIsAnimating(false)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="space-y-16 pb-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-2xl min-h-[420px] sm:min-h-[480px]">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('')`,
          }}
        />

        {/* Blue-to-white gradient blend over the image
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to right, rgba(37,99,235,0.85) 0%, rgba(26, 62, 140, 0.7) 30%, rgba(18, 57, 142, 0.45) 60%, rgba(0, 111, 215, 0.6) 100%)`,
          }}
        /> */}

        {/* Animated grid overlay */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(61, 61, 61, 0.12) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px',
            animation: 'gridMove 20s linear infinite',
          }}
        />

        <div className="relative max-w-4xl mx-auto text-center py-16 sm:py-20 px-4">
          <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-sm text-white px-4 py-2 rounded-full text-sm font-medium mb-6 border border-white/30">
            <Star className="h-4 w-4 fill-current text-yellow-300" />
            Zimbabwe's #1 Exam Prep Platform
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-black mb-6 drop-shadow-md">
            Ace Your Exams with{' '}
            <span
              className={`inline-block text-gray-500 transition-all duration-300 ${
                isAnimating
                  ? 'opacity-0 translate-y-2 blur-sm'
                  : 'opacity-100 translate-y-0 blur-0'
              }`}
            >
              {rotatingWords[wordIndex]}
            </span>{' '}
            Practice
          </h1>
          <p className="text-base sm:text-lg md:text-xl text-black/90 mb-8 max-w-2xl mx-auto drop-shadow-sm">
            Practice with real ZIMSEC and Cambridge past papers. Get instant AI
            feedback on your answers and track your progress to exam success.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link to={getDashboardPath()}>
                <Button size="lg" className="w-full sm:w-auto hover:text-white text-blue-700 bg-blue-50 border-black/40 shadow-lg">
                  <LayoutDashboard className="mr-2 h-5 w-5" />
                  Go to Dashboard
                </Button>
              </Link>
            ) : (
              <Button size="lg" className="w-full sm:w-auto hover:text-white text-blue-700 bg-blue-50 border-black/40 shadow-lg" onClick={() => openAuthModal('register')}>
                Start Practicing Free
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            )}
            <Link to="/subjects">
              <Button variant="secondary" size="lg" className="w-full sm:w-auto border-black/40 text-blue-700 bg-white/15 hover:bg-blue-50 backdrop-blur-sm">
                Browse Papers
              </Button>
            </Link>
          </div>
          {!isAuthenticated && (
            <p className="text-sm text-white/70 mt-4 drop-shadow-sm">
              No credit card required. Start practicing immediately.
            </p>
          )}
        </div>
      </section>

      {/* Stats Section */}
      <section className="bg-white rounded-2xl shadow-sm border p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-3xl md:text-4xl font-bold text-primary-600">
                {stat.value}
              </div>
              <div className="text-gray-600 mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features Section */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Everything You Need to Succeed
          </h2>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Our platform provides all the tools you need to prepare effectively
            for your exams.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow"
            >
              <div className="w-12 h-12 bg-primary-100 rounded-lg flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary-600" />
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Subjects Preview */}
      <section className="bg-gray-50 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-12 rounded-2xl">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Popular Subjects
          </h2>
          <p className="text-gray-600">
            Browse papers from the most popular O-Level and A-Level subjects
          </p>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-3 sm:gap-4">
          {subjects.map((subject) => (
            <Link
              key={subject.name}
              to={`/papers?subject=${subject.name.toLowerCase()}`}
              className="bg-white rounded-xl p-4 text-center shadow-sm border hover:shadow-md transition-all hover:-translate-y-1"
            >
              <div
                className="w-12 h-12 rounded-full mx-auto mb-3 flex items-center justify-center"
                style={{ backgroundColor: `${subject.color}15` }}
              >
                <BookOpen className="h-6 w-6" style={{ color: subject.color }} />
              </div>
              <h3 className="font-medium text-gray-900 text-sm">{subject.name}</h3>
              <p className="text-xs text-gray-500 mt-1">{subject.papers}+ papers</p>
            </Link>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link to="/subjects">
            <Button variant="secondary">
              View All Subjects
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* How It Works */}
      <section>
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-gray-600">Get started in three simple steps</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="w-14 h-14 sm:w-16 sm:h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold mx-auto mb-4">
              1
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Choose a Paper</h3>
            <p className="text-gray-600 text-sm">
              Browse our extensive collection of ZIMSEC and Cambridge past papers
              across all subjects.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              2
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Answer Questions</h3>
            <p className="text-gray-600 text-sm">
              Attempt questions at your own pace. Our timer helps you practice
              under exam conditions.
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-primary-600 text-white rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
              3
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Get AI Feedback</h3>
            <p className="text-gray-600 text-sm">
              Receive instant marking with detailed feedback to understand your
              mistakes and improve.
            </p>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="bg-white rounded-2xl shadow-sm border p-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            What Students Say
          </h2>
          <p className="text-gray-600">
            Join thousands of students who improved their grades with ExamRevise
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="bg-gray-50 rounded-xl p-6"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="h-5 w-5 text-yellow-400 fill-current"
                  />
                ))}
              </div>
              <p className="text-gray-700 mb-4">"{testimonial.content}"</p>
              <div>
                <p className="font-medium text-gray-900">{testimonial.name}</p>
                <p className="text-sm text-gray-500">{testimonial.role}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* For Teachers */}
      <section className="bg-gradient-to-br from-blue-600 to-primary-700 rounded-2xl p-8 md:p-12 text-white">
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">For Teachers & Schools</h2>
            <p className="text-blue-100 mb-6">
              Streamline your teaching with our powerful dashboard. Create classes,
              assign papers, and track student performance all in one place.
            </p>
            <ul className="space-y-3 mb-6">
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-300" />
                <span>Create and manage classes</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-300" />
                <span>Assign papers with deadlines</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-300" />
                <span>Track student progress in real-time</span>
              </li>
              <li className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-300" />
                <span>AI-assisted marking saves hours</span>
              </li>
            </ul>
            <div className="flex flex-col sm:flex-row gap-3">
              {isAuthenticated && (user?.role === 'teacher' || user?.role === 'school_admin' || user?.role === 'admin') ? (
                <Link to={getDashboardPath()}>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="bg-white text-primary-700 hover:bg-gray-100"
                  >
                    <LayoutDashboard className="mr-2 h-5 w-5" />
                    Go to Dashboard
                  </Button>
                </Link>
              ) : (
                <>
                  <Link to="/register/school">
                    <Button
                      variant="secondary"
                      size="lg"
                      className="bg-white text-primary-700 hover:bg-gray-100"
                    >
                      Register Your School
                    </Button>
                  </Link>
                  <Button
                    variant="secondary"
                    size="lg"
                    className="bg-white/20 text-white border-white/30 hover:bg-white/30"
                    onClick={() => openAuthModal('register')}
                  >
                    Sign Up as Teacher
                  </Button>
                </>
              )}
            </div>
          </div>
          <div className="hidden md:flex justify-center">
            <div className="bg-white/10 backdrop-blur rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium">Teacher Dashboard</p>
                  <p className="text-sm text-blue-200">Manage everything</p>
                </div>
              </div>
              <div className="space-y-3">
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Form 4A Progress</span>
                    <span>78%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full">
                    <div className="h-2 bg-green-400 rounded-full w-[78%]" />
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-3">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Form 5B Progress</span>
                    <span>65%</span>
                  </div>
                  <div className="h-2 bg-white/20 rounded-full">
                    <div className="h-2 bg-yellow-400 rounded-full w-[65%]" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="text-center py-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-4">
          {isAuthenticated ? 'Continue Your Learning Journey' : 'Ready to Start Practicing?'}
        </h2>
        <p className="text-gray-600 mb-8 max-w-xl mx-auto">
          {isAuthenticated
            ? 'Head to your dashboard to track progress, attempt papers, and improve your grades.'
            : 'Join thousands of Zimbabwean students using ExamRevise to prepare for their O-Level and A-Level exams.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {isAuthenticated ? (
            <Link to={getDashboardPath()}>
              <Button size="lg">
                <LayoutDashboard className="mr-2 h-5 w-5" />
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Button size="lg" onClick={() => openAuthModal('register')}>
              Create Free Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          )}
          <Link to="/papers">
            <Button variant="secondary" size="lg">
              Browse Papers
            </Button>
          </Link>
        </div>
      </section>
    </div>
  )
}
