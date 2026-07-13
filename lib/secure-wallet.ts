"use client"

import type { ExchangeStatus } from "./types"

/**
 * Secure wallet: encapsula monedas, diamantes y puntos en un objeto protegido
 * en memoria. Los valores no se exponen como variables numéricas simples en el
 * ámbito global, y se valida cualquier mutación contra incrementos imposibles.
 *
 * Si se detecta un incremento masivo imposible (delta > UMBRAL en < VENTANA_MS),
 * se congela la wallet, `bannedByAnticheat` pasa a true y el guardado en
 * Firebase queda bloqueado. La congelación solo se puede revertir con
 * `resetAnticheat()` (usado desde el logout o un reinicio legítimo).
 */
const UMBRAL_SOSPECHOSO = 1500 // +1500 monedas seguidas es sospechoso.
const VENTANA_MS = 2000 // …en menos de 2 segundos: trampa confirmada.

interface CoinEvent {
  ts: number
  delta: number
}

class SecureWallet {
  // Los valores viven dentro del closure; no se exponen como propiedades
  // simples en window. Se accede solo a través de los métodos.
  private coins = 0
  private diamonds = 0
  private goalPoints = 0
  private banned = false
  private events: CoinEvent[] = []

  getCoins() {
    return this.coins
  }
  getDiamonds() {
    return this.diamonds
  }
  getGoalPoints() {
    return this.goalPoints
  }
  isBanned() {
    return this.banned
  }

  /** Reemplaza todos los valores (login / carga desde Firebase). */
  hydrate(c: number, d: number, p: number) {
    this.coins = Math.max(0, Math.floor(c))
    this.diamonds = Math.max(0, Math.floor(d))
    this.goalPoints = Math.max(0, Math.floor(p))
    this.events = []
  }

  /**
   * Suma monedas SIEMPRE validando anticheat.
   * Devuelve false si se detectó trampa y se congeló la wallet.
   */
  addCoins(amount: number, onHack?: () => void): boolean {
    if (this.banned) return false
    const delta = Math.floor(amount)
    if (!Number.isFinite(delta) || delta === 0) return true
    if (delta > 0) {
      const now = Date.now()
      this.events.push({ ts: now, delta })
      // Limpia eventos viejos fuera de la ventana.
      this.events = this.events.filter((e) => now - e.ts < VENTANA_MS)
      const sum = this.events.reduce((acc, e) => acc + e.delta, 0)
      if (sum > UMBRAL_SOSPECHOSO) {
        this.banned = true
        onHack?.()
        return false
      }
    }
    this.coins = Math.max(0, this.coins + delta)
    return true
  }

  /** Suma diamantes (sin curva de detección, pero validado). */
  addDiamonds(amount: number): boolean {
    if (this.banned) return false
    const delta = Math.floor(amount)
    if (!Number.isFinite(delta)) return false
    this.diamonds = Math.max(0, this.diamonds + delta)
    return true
  }

  /** Suma puntos de objetivo. */
  addGoalPoints(amount: number): boolean {
    if (this.banned) return false
    const delta = Math.floor(amount)
    if (!Number.isFinite(delta)) return false
    this.goalPoints = Math.max(0, this.goalPoints + delta)
    return true
  }

  /** Gasta monedas solo si hay saldo suficiente. */
  spend(amount: number): boolean {
    const cost = Math.max(0, Math.floor(amount))
    if (this.banned) return false
    if (this.coins < cost) return false
    this.coins -= cost
    return true
  }

  /** Gasta puntos de objetivo. */
  spendGoalPoints(amount: number): boolean {
    const cost = Math.max(0, Math.floor(amount))
    if (this.banned) return false
    if (this.goalPoints < cost) return false
    this.goalPoints -= cost
    return true
  }

  /** Desbloquea el anticheat (logout/relogin). */
  resetAnticheat() {
    this.banned = false
    this.events = []
  }
}

export const secureWallet = new SecureWallet()

export const ANTICHEAT_BANNER = "ANTIHACK: incremento imposible detectado. Partida congelada por seguridad."

export function anticheatStatus(): { banned: boolean } {
  return { banned: secureWallet.isBanned() }
}

export type { ExchangeStatus }
