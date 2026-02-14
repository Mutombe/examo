import { useState, useEffect, useRef } from "react";
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
  "AI-Powered",
  "Smart",
  "Instant",
  "Personalized",
  "Exam-Ready",
];


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
  { value: '3000+', label: 'Questions' },
  { value: '250+', label: 'Past Papers' },
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



const TYPING_SPEED = 90;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPED = 1800;
const PAUSE_AFTER_DELETED = 400;

// --- PARTICLE DOT GRID ---
interface Dot {
  x: number;
  y: number;
  phase: number;
}

function ParticleDotGrid() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const mouseRef = useRef({ x: -1000, y: -1000 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let dots: Dot[] = [];
    const SPACING = 32;
    const BASE_RADIUS = 1.2;
    const HOVER_RADIUS = 3.5;
    const HOVER_RANGE = 120;
    const BASE_ALPHA = 0.18;
    const HOVER_ALPHA = 0.55;
    const PULSE_SPEED = 0.0015;

    function initDots() {
      if (!canvas || !ctx) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      dots = [];
      const cols = Math.ceil(canvas.offsetWidth / SPACING) + 1;
      const rows = Math.ceil(canvas.offsetHeight / SPACING) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          dots.push({
            x: col * SPACING,
            y: row * SPACING,
            phase: Math.random() * Math.PI * 2,
          });
        }
      }
    }

    function draw(time: number) {
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      for (const dot of dots) {
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / HOVER_RANGE);
        const pulse = Math.sin(time * PULSE_SPEED + dot.phase) * 0.3 + 0.7;

        const r = BASE_RADIUS + (HOVER_RADIUS - BASE_RADIUS) * influence;
        const alpha =
          (BASE_ALPHA + (HOVER_ALPHA - BASE_ALPHA) * influence) * pulse;

        const red = Math.round(100 + 80 * influence);
        const green = Math.round(140 + 100 * influence);
        const blue = Math.round(220 + 35 * influence);

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${red},${green},${blue},${alpha})`;
        ctx.fill();
      }

      animationRef.current = requestAnimationFrame(draw);
    }

    function handleMouseMove(e: MouseEvent) {
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function handleMouseLeave() {
      mouseRef.current = { x: -1000, y: -1000 };
    }

    initDots();
    animationRef.current = requestAnimationFrame(draw);

    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    window.addEventListener("resize", initDots);

    return () => {
      if (animationRef.current != null) cancelAnimationFrame(animationRef.current);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      window.removeEventListener("resize", initDots);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-auto"
      style={{ zIndex: 0 }}
    />
  );
}

// --- TYPEWRITER HOOK ---
function useTypewriter(words: string[]) {
  const [display, setDisplay] = useState("");
  const [wordIdx, setWordIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    const word = words[wordIdx];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && display === word) {
      timeout = setTimeout(() => setIsDeleting(true), PAUSE_AFTER_TYPED);
    } else if (isDeleting && display === "") {
      timeout = setTimeout(() => {
        setIsDeleting(false);
        setWordIdx((prev) => (prev + 1) % words.length);
      }, PAUSE_AFTER_DELETED);
    } else if (isDeleting) {
      timeout = setTimeout(() => {
        setDisplay(word.substring(0, display.length - 1));
      }, DELETING_SPEED);
    } else {
      timeout = setTimeout(() => {
        setDisplay(word.substring(0, display.length + 1));
      }, TYPING_SPEED);
    }

    return () => clearTimeout(timeout);
  }, [display, isDeleting, wordIdx, words]);

  useEffect(() => {
    const cursorInterval = setInterval(
      () => setShowCursor((v) => !v),
      530
    );
    return () => clearInterval(cursorInterval);
  }, []);

  return { display, showCursor };
}

// --- BUTTONS ---
interface LandingButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  as?: string;
  href?: string;
  [key: string]: unknown;
}

function PrimaryButton({ children, onClick, as: Tag = "button", ...props }: LandingButtonProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      onClick={onClick}
      className="group relative inline-flex items-center justify-center gap-2 px-7 py-3.5
        text-white font-semibold text-base rounded-xl overflow-hidden cursor-pointer
        transition-all duration-300 ease-out
        hover:scale-[1.04] hover:shadow-[0_0_32px_rgba(59,130,246,0.45)]
        active:scale-[0.98]"
      style={{
        background: "linear-gradient(135deg, #1e40af 0%, #3730a3 100%)",
        boxShadow:
          "0 4px 24px rgba(30,64,175,0.3), inset 0 1px 0 rgba(255,255,255,0.1)",
      }}
      {...props}
    >
      {/* Shimmer sweep */}
      <span
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(27, 27, 27, 0.18) 80%, transparent 60%)",
          backgroundSize: "200% 100%",
          animation: "shimmer 3s ease-in-out infinite",
        }}
      />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </Component>
  );
}

function SecondaryButton({ children, as: Tag = "button", ...props }: LandingButtonProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className="group relative inline-flex items-center justify-center gap-2 px-7 py-3.5
        font-semibold text-base rounded-xl cursor-pointer
        text-white/90 border border-slate-600
        transition-all duration-300 ease-out
        hover:bg-white/[0.12] hover:border-white/40 hover:scale-[1.03] hover:shadow-lg
        active:scale-[0.98]"
      style={{
        background: "rgba(255, 255, 255, 0.08)",
      }}
      {...props}
    >
      <span className="relative z-10 flex items-center gap-2 text-slate-600">{children}</span>
    </Component>
  );
}

export function LandingPage() {
  const [wordIndex, setWordIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const { user, isAuthenticated } = useAuthStore()
  const { openAuthModal } = useUIStore()
  const { display, showCursor } = useTypewriter(rotatingWords);


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
     <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s ease-out both;
        }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.25s; }
        .delay-3 { animation-delay: 0.4s; }
        .delay-4 { animation-delay: 0.55s; }
      `}</style>

      <section
        className="relative overflow-hidden rounded-2xl min-h-[420px] sm:min-h-[500px]"
      >
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

        {/* Soft radial glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(59,130,246,0.12) 0%, transparent 70%)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto text-center py-16 sm:py-20 px-4">
          {/* Badge */}
          <div className="animate-fade-in-up delay-1 inline-flex items-center gap-2 bg-slate-800 backdrop-blur-md text-white/90 px-4 py-2 rounded-full text-sm font-medium mb-8 border border-white/[0.12]">
            <Star />
            Zimbabwe's #1 Exam Prep Platform
          </div>

          {/* Heading with typewriter */}
          <h1 className="animate-fade-in-up delay-2 text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-slate-800 mb-6 leading-tight">
            Ace Your Exams with{" "}
            <span
              className="inline-block bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-400 bg-clip-text text-transparent"
              style={{ minWidth: "3ch" }}
            >
              {display}
              <span
                className="inline-block w-[3px] h-[0.85em] ml-0.5 align-middle rounded-sm"
                style={{
                  backgroundColor: "#60a5fa",
                  opacity: showCursor ? 1 : 0,
                  transition: "opacity 0.1s",
                  verticalAlign: "baseline",
                  position: "relative",
                  top: "0.05em",
                }}
              />
            </span>{" "}
            <br className="hidden sm:block" />
            Practice
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in-up delay-3 text-base sm:text-lg md:text-xl text-black/65 mb-10 max-w-2xl mx-auto leading-relaxed">
            Practice with real ZIMSEC and Cambridge past papers. Get instant AI
            feedback on your answers and track your progress to exam success.
          </p>

          {/* Buttons */}
          <div className="animate-fade-in-up delay-4 flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <PrimaryButton as="a" href={getDashboardPath()}>
                <LayoutDashboard />
                Go to Dashboard
              </PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => console.log("open register modal")}>
                Start Practicing Free
                <ArrowRight />
              </PrimaryButton>
            )}

            <SecondaryButton as="a" href="/subjects">
              Browse Papers
            </SecondaryButton>
          </div>

          {/* Footer text */}
          {!isAuthenticated && (
            <p className="animate-fade-in-up delay-4 text-sm text-white/35 mt-6">
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
