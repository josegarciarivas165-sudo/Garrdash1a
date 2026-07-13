"use client"

import { useEffect, useState } from "react"
import { useGameStore } from "@/lib/use-game-store"
import { X } from "lucide-react"

/**
 * Anuncio recompensado simulado (AdMob de prueba).
 * Si el usuario es VIP, se salta automáticamente y llama a onComplete tras ~200ms.
 * En caso contrario muestra 5 segundos de cuenta regresiva antes de otorgar la recompensa.
 */
export function RewardedAdOverlay({
  label = "Simulando Anuncio de Prueba de AdMob...",
  onComplete,
  onSkip,
}: {
  label?: string
  onComplete: () => void
  onSkip?: () => void
}) {
  const isVip = useGameStore().isVip
  const [count, setCount] = useState(5)
  const [visible, setVisible] = useState(true)

  // VIP: salta el anuncio.
  useEffect(() => {
    if (!isVip) return
    const t = window.setTimeout(() => {
      setVisible(false)
      onComplete()
    }, 250)
    return () => window.clearTimeout(t)
  }, [isVip, onComplete])

  // No-VIP: cuenta regresiva de 5 segundos.
  useEffect(() => {
    if (isVip) return
    if (count <= 0) {
      const t = window.setTimeout(() => {
        setVisible(false)
        onComplete()
      }, 300)
      return () => window.clearTimeout(t)
    }
    const t = window.setInterval(() => setCount((c) => c - 1), 1000)
    return () => window.clearInterval(t)
  }, [count, isVip, onComplete])

  if (!visible) return null

  // Vista VIP: fade out inmediato.
  if (isVip) {
    return (
      <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur">
        <p className="text-sm text-accent">VIP: anuncio omitido ✨</p>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-xl bg-black p-6 text-center">
      <button
        className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
        onClick={() => {
          setVisible(false)
          onSkip?.()
        }}
        aria-label="Cerrar anuncio (sin recompensa)"
      >
        <X className="size-4" />
      </button>
      <div className="text-5xl" aria-hidden>📺</div>
      <p className="text-sm text-white/90">{label}</p>
      <div className="flex items-center gap-2 text-white">
        <span className="text-3xl font-black tabular-nums">{count}</span>
        <span className="text-sm text-white/60">s</span>
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
        <div
          className="h-full rounded-full bg-primary transition-[width] duration-1000"
          style={{ width: `${((5 - count) / 5) * 100}%` }}
        />
      </div>
      <p className="text-[10px] text-white/40">AdMob Test Ad · Simulación de desarrollo</p>
    </div>
  )
}
