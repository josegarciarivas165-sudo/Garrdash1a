"use client"

import { useEffect, useState } from "react"
import { useGameStore } from "@/lib/use-game-store"
import { dismissNotification } from "@/lib/store"
import { Bell, X } from "lucide-react"

const DISPLAY_MS = 7000

interface VisibleNotification {
  id: string
  message: string
  shownAt: number
}

/**
 * Notificaciones push simuladas: cuando llegan a la store, se muestran
 * como una tarjeta flotante durante 7s. Múltiples se apilan verticalmente.
 */
export function PushNotificationCenter() {
  const notifications = useGameStore().notifications
  const [visible, setVisible] = useState<VisibleNotification[]>([])

  // Incorpora notificaciones recientes (últimos 8s) a la pila visible.
  useEffect(() => {
    const now = Date.now()
    const fresh = notifications
      .filter((n) => now - n.createdAt < 5000)
      .filter((n) => !visible.some((v) => v.id === n.id))
      .map((n) => ({ id: n.id, message: n.message, shownAt: now }))
    if (fresh.length) setVisible((prev) => [...prev, ...fresh].slice(-4))
  }, [notifications, visible])

  // Auto-descarta tras DISPLAY_MS.
  useEffect(() => {
    if (!visible.length) return
    const t = window.setTimeout(() => {
      const now = Date.now()
      setVisible((prev) => {
        const keep: VisibleNotification[] = []
        for (const v of prev) {
          if (now - v.shownAt > DISPLAY_MS) {
            dismissNotification(v.id)
          } else {
            keep.push(v)
          }
        }
        return keep
      })
    }, 1000)
    return () => window.clearTimeout(t)
  }, [visible])

  if (!visible.length) return null

  return (
    <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-3">
      {visible.map((n) => (
        <div
          key={n.id}
          className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-2xl border border-accent/50 bg-card/95 p-3 shadow-glow-gold backdrop-blur"
        >
          <Bell className="mt-0.5 size-5 shrink-0 text-accent" />
          <p className="flex-1 text-sm leading-snug text-foreground">
            {n.message}
          </p>
          <button
            onClick={() => {
              dismissNotification(n.id)
              setVisible((prev) => prev.filter((v) => v.id !== n.id))
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Cerrar notificación"
          >
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
