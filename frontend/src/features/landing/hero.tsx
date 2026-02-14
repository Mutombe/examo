import { useState, useEffect, useRef } from "react";

// --- CONFIG ---
const rotatingWords = ["AI-Powered", "Smart", "Instant", "Personalized", "Exam-Ready"];
const TYPING_SPEED = 90;
const DELETING_SPEED = 50;
const PAUSE_AFTER_TYPED = 1800;
const PAUSE_AFTER_DELETED = 400;

interface Dot {
  x: number;
  y: number;
  phase: number;
}

// --- PARTICLE DOT GRID (Canvas) ---
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
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      dots = [];
      const cols = Math.ceil(w / SPACING) + 1;
      const rows = Math.ceil(h / SPACING) + 1;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          dots.push({ x: col * SPACING, y: row * SPACING, phase: Math.random() * Math.PI * 2 });
        }
      }
    }

    function draw(time: number) {
      if (!canvas || !ctx) return;
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      for (const dot of dots) {
        const dx = dot.x - mx;
        const dy = dot.y - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const influence = Math.max(0, 1 - dist / HOVER_RANGE);
        const pulse = Math.sin(time * PULSE_SPEED + dot.phase) * 0.3 + 0.7;
        const r = BASE_RADIUS + (HOVER_RADIUS - BASE_RADIUS) * influence;
        const alpha = (BASE_ALPHA + (HOVER_ALPHA - BASE_ALPHA) * influence) * pulse;
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

  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", zIndex: 0 }} />;
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
      timeout = setTimeout(() => setDisplay(word.substring(0, display.length - 1)), DELETING_SPEED);
    } else {
      timeout = setTimeout(() => setDisplay(word.substring(0, display.length + 1)), TYPING_SPEED);
    }
    return () => clearTimeout(timeout);
  }, [display, isDeleting, wordIdx, words]);

  useEffect(() => {
    const id = setInterval(() => setShowCursor((v) => !v), 530);
    return () => clearInterval(id);
  }, []);

  return { display, showCursor };
}

// --- MAIN HERO ---
export default function HeroSection() {
  const { display, showCursor } = useTypewriter(rotatingWords);
  const [hoverPrimary, setHoverPrimary] = useState(false);
  const [hoverSecondary, setHoverSecondary] = useState(false);

  return (
    <div style={{ fontFamily: "'Segoe UI', system-ui, -apple-system, sans-serif", padding: "24px", background: "#0b1120", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: "20px",
        width: "100%",
        maxWidth: "1100px",
        minHeight: "500px",
        background: "linear-gradient(145deg, #0f172a 0%, #1e293b 40%, #0f1d35 100%)",
      }}>
        <ParticleDotGrid />

        {/* Radial glow */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(59,130,246,0.10) 0%, transparent 70%)",
        }} />

        {/* Content */}
        <div style={{
          position: "relative", zIndex: 10, maxWidth: "720px", margin: "0 auto",
          textAlign: "center", padding: "72px 24px 64px",
        }}>
          {/* Badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            background: "rgba(255,255,255,0.06)", backdropFilter: "blur(12px)",
            color: "rgba(255,255,255,0.85)", padding: "8px 18px",
            borderRadius: "9999px", fontSize: "13px", fontWeight: 500,
            border: "1px solid rgba(255,255,255,0.1)", marginBottom: "32px",
            animation: "fadeInUp 0.7s ease-out 0.1s both",
          }}>
            <svg style={{ width: 16, height: 16, fill: "#fde047", color: "#fde047" }} viewBox="0 0 24 24">
              <polygon points="12,2 15,9 22,9.5 17,14.5 18.5,22 12,18 5.5,22 7,14.5 2,9.5 9,9" />
            </svg>
            Zimbabwe's #1 Exam Prep Platform
          </div>

          {/* Heading */}
          <h1 style={{
            fontSize: "clamp(1.65rem, 4.5vw, 3rem)", fontWeight: 700,
            color: "#ffffff", marginBottom: "20px", lineHeight: 1.25,
            animation: "fadeInUp 0.7s ease-out 0.25s both",
          }}>
            Ace Your Exams with{" "}
            <span style={{
              display: "inline",
              background: "linear-gradient(90deg, #60a5fa, #22d3ee, #60a5fa)",
              backgroundClip: "text", WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent", color: "transparent",
            }}>
              {display}
              <span style={{
                display: "inline-block", width: "3px", height: "0.82em",
                marginLeft: "2px", borderRadius: "2px",
                backgroundColor: "#60a5fa",
                opacity: showCursor ? 1 : 0,
                transition: "opacity 0.1s",
                verticalAlign: "baseline",
                position: "relative", top: "0.08em",
                WebkitTextFillColor: "initial", backgroundClip: "initial",
                WebkitBackgroundClip: "initial", background: "#60a5fa",
              }} />
            </span>{" "}
            Practice
          </h1>

          {/* Subtitle */}
          <p style={{
            fontSize: "clamp(0.95rem, 2vw, 1.15rem)",
            color: "rgba(255,255,255,0.5)", marginBottom: "40px",
            maxWidth: "580px", marginLeft: "auto", marginRight: "auto",
            lineHeight: 1.7,
            animation: "fadeInUp 0.7s ease-out 0.4s both",
          }}>
            Practice with real ZIMSEC and Cambridge past papers. Get instant AI
            feedback on your answers and track your progress to exam success.
          </p>

          {/* Buttons */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "16px",
            justifyContent: "center",
            animation: "fadeInUp 0.7s ease-out 0.55s both",
          }}>
            {/* Primary Button */}
            <button
              onMouseEnter={() => setHoverPrimary(true)}
              onMouseLeave={() => setHoverPrimary(false)}
              style={{
                position: "relative", display: "inline-flex", alignItems: "center",
                gap: "10px", padding: "14px 30px",
                color: "#fff", fontWeight: 600, fontSize: "15px",
                border: "none", borderRadius: "14px", cursor: "pointer",
                background: "linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)",
                boxShadow: hoverPrimary
                  ? "0 0 36px rgba(59,130,246,0.5), 0 4px 20px rgba(37,99,235,0.3)"
                  : "0 4px 24px rgba(37,99,235,0.22), inset 0 1px 0 rgba(255,255,255,0.12)",
                transform: hoverPrimary ? "scale(1.04)" : "scale(1)",
                transition: "all 0.3s cubic-bezier(0.34,1.56,0.64,1)",
                overflow: "hidden",
              }}
            >
              {/* Shimmer */}
              <span style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.16) 50%, transparent 60%)",
                backgroundSize: "200% 100%",
                animation: "shimmer 3s ease-in-out infinite",
              }} />
              <span style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: "10px" }}>
                Start Practicing Free
                <svg
                  style={{
                    width: 18, height: 18,
                    transform: hoverPrimary ? "translateX(4px)" : "translateX(0)",
                    transition: "transform 0.3s ease",
                  }}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </span>
            </button>

            {/* Secondary Button */}
            <button
              onMouseEnter={() => setHoverSecondary(true)}
              onMouseLeave={() => setHoverSecondary(false)}
              style={{
                display: "inline-flex", alignItems: "center", gap: "10px",
                padding: "14px 30px",
                color: "rgba(255,255,255,0.85)", fontWeight: 600, fontSize: "15px",
                border: hoverSecondary ? "1px solid rgba(255,255,255,0.35)" : "1px solid rgba(255,255,255,0.15)",
                borderRadius: "14px", cursor: "pointer",
                background: hoverSecondary ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.05)",
                backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                transform: hoverSecondary ? "scale(1.03)" : "scale(1)",
                boxShadow: hoverSecondary ? "0 8px 24px rgba(0,0,0,0.2)" : "none",
                transition: "all 0.3s ease",
              }}
            >
              Browse Papers
            </button>
          </div>

          {/* Footer note */}
          <p style={{
            fontSize: "13px", color: "rgba(255,255,255,0.28)",
            marginTop: "24px",
            animation: "fadeInUp 0.7s ease-out 0.65s both",
          }}>
            No credit card required. Start practicing immediately.
          </p>
        </div>
      </section>
    </div>
  );
}
