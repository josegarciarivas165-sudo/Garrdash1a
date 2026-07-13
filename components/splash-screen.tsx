"use client"

import { useEffect, useMemo, useState } from "react"

interface Particle {
  id: number
  top: number
  left: number
  size: number
  hue: number
  duration: number
  delay: number
}

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0)
  const [leaving, setLeaving] = useState(false)

  const particles = useMemo<Particle[]>(() => {
    const huePalette = [190, 45, 330] // cian, dorado, magenta
    return Array.from({ length: 28 }, (_, i) => ({
      id: i,
      top: Math.random() * 100,
      left: Math.random() * 100,
      size: 2 + Math.random() * 4,
      hue: huePalette[Math.floor(Math.random() * huePalette.length)],
      duration: 6 + Math.random() * 8,
      delay: Math.random() * 3,
    }))
  }, [])

  useEffect(() => {
    const start = Date.now()
    const duration = 2600
    let raf = 0
    const tick = () => {
      const elapsed = Date.now() - start
      const pct = Math.min(100, Math.floor((elapsed / duration) * 100))
      setProgress(pct)
      if (pct < 100) {
        raf = window.requestAnimationFrame(tick)
      } else {
        window.setTimeout(() => setLeaving(true), 250)
        window.setTimeout(onDone, 950)
      }
    }
    raf = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(raf)
  }, [onDone])

  return (
    <div
      className={`relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background transition-opacity duration-700 ${
        leaving ? "opacity-0" : "opacity-100"
      }`}
    >
      {/* Fondo cyberpunk: grid + partículas */}
      <div className="absolute inset-0 bg-grid opacity-30" />
      <div className="absolute inset-0 overflow-hidden">
        {particles.map((p) => (
          <span
            key={p.id}
            className="absolute rounded-full"
            style={{
              top: `${p.top}%`,
              left: `${p.left}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              backgroundColor: `hsl(${p.hue} 90% 60%)`,
              boxShadow: `0 0 8px hsl(${p.hue} 90% 60%), 0 0 16px hsl(${p.hue} 90% 60%)`,
              animation: `neon-drift ${p.duration}s linear ${p.delay}s infinite`,
            }}
            aria-hidden
          />
        ))}
      </div>

      {/* Título cyberpunk con flicker */}
      <div className="relative z-10 flex flex-col items-center gap-6">
        <h1
          className="cyberpunk-title text-7xl font-black tracking-tight sm:text-8xl"
          aria-label="GarrDash"
        >
          Garr<span className="cyberpunk-gold">Dash</span>
        </h1>

        {/* Barra de progreso con porcentaje */}
        <div className="flex w-72 flex-col items-center gap-2">
          <div className="h-2 w-full overflow-hidden rounded-full border border-primary/40 bg-secondary/40">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-neon-pink transition-[width] duration-100"
              style={{
                width: `${progress}%`,
                boxShadow: "0 0 12px hsl(var(--primary)/70%)",
              }}
            />
          </div>
          <span className="font-mono text-sm font-bold tabular-nums text-primary text-glow-primary">
            {progress}%
          </span>
        </div>
      </div>

      <style jsx>{`
        .cyberpunk-title {
          color: hsl(var(--primary));
          text-shadow:
            0 0 8px hsl(var(--primary) / 80%),
            0 0 18px hsl(var(--primary) / 60%),
            0 0 36px hsl(var(--primary) / 40%);
          animation: flicker-neon 2.4s infinite alternate;
        }
        .cyberpunk-gold {
          color: hsl(var(--accent));
          text-shadow:
            0 0 8px hsl(var(--accent) / 80%),
            0 0 18px hsl(var(--accent) / 60%),
            0 0 36px hsl(var(--accent) / 40%);
        }
        @keyframes flicker-neon {
          0%, 18%, 22%, 25%, 53%, 57%, 100% {
            opacity: 1;
            filter: brightness(1);
          }
          20%, 24%, 55% {
            opacity: 0.55;
            filter: brightness(0.7);
          }
        }
        @keyframes neon-drift {
          0% {
            transform: translate(-20px, 0) scale(1);
            opacity: 0;
          }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% {
            transform: translate(40px, -120px) scale(1.2);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  )
}
