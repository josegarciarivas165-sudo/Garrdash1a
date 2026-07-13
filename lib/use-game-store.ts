"use client"

import { useEffect, useSyncExternalStore } from "react"
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  setPersistence,
} from "./store"
import { saveUserDoc } from "./firebase-auth"

let persistenceBound = false

function bindPersistence() {
  if (persistenceBound) return
  persistenceBound = true
  setPersistence((patch) => {
    const uid = getSnapshot().authUid
    if (!uid) return
    // Solo persiste campos económicos + perfil. Firebase es fuente de verdad.
    saveUserDoc(uid, {
      monedas: getSnapshot().coins,
      diamantes: getSnapshot().diamonds,
      puntos: getSnapshot().goalPoints,
      es_vip: getSnapshot().isVip,
      estado_canje: getSnapshot().exchangeStatus,
      bestScore: getSnapshot().gameStats.bestScore,
      totalRuns: getSnapshot().gameStats.totalRuns,
      totalCoinsFromRuns: getSnapshot().gameStats.totalCoinsFromRuns,
    })
  })
}

export function useGameStore() {
  useEffect(bindPersistence, [])
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

export function maskName(name: string): string {
  const trimmed = name.trim()
  if (trimmed.length <= 3) return trimmed[0] + "**"
  const visible = Math.max(3, Math.ceil(trimmed.length * 0.55))
  const head = trimmed.slice(0, visible)
  const masked = "*".repeat(Math.min(4, trimmed.length - visible))
  return head + masked
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.floor(n))
}
