import type {
  GameState,
  DiamondPack,
  DiamondRedemption,
  RedemptionStatus,
  PushNotification,
  WheelPrize,
  PowerupType,
  OfferwallTask,
  PowerupPack,
  ExchangeStatus,
  ShipType,
} from "./types"
import { SHIPS } from "./types"
import { secureWallet, ANTICHEAT_BANNER } from "./secure-wallet"

const STORAGE_KEY = "garrdash:v4"
export const GOAL_POINT_COST_IN_COINS = 2000
export const REVIEW_WINDOW_MS = 24 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export const DIAMOND_PACKS: DiamondPack[] = [
  { id: "pack-100", name: "100 Diamantes", diamonds: 100, goalPointCost: 5 },
  { id: "pack-310", name: "310 Diamantes", diamonds: 310, goalPointCost: 15, popular: true },
  { id: "pack-520", name: "520 Diamantes", diamonds: 520, goalPointCost: 25 },
]

export const POWERUP_PACKS: PowerupPack[] = [
  { type: "shield", name: "Escudo Activo", icon: "🛡️", description: "Te protege de 1 choque contra un obstáculo.", cost: 500 },
  { type: "superJump", name: "Súper Salto", icon: "🦘", description: "Salta un 40% más alto para evadir obstáculos grandes.", cost: 400 },
]

export const OFFERWALL_TASK_SEED: OfferwallTask[] = [
  { id: "ow-app1", title: "Descarga y juega a App Recomendada", app: "App Recomendada", reward: 800, completed: false },
  { id: "ow-app2", title: "Alcanza el nivel 10 en City Builder Pro", app: "City Builder Pro", reward: 1200, completed: false },
  { id: "ow-app3", title: "Regístrate en FitRun Tracker", app: "FitRun Tracker", reward: 500, completed: false },
  { id: "ow-survey", title: "Completa una encuesta de 2 minutos", app: "Opinion Survey", reward: 300, completed: false },
  { id: "ow-app4", title: "Mira un video de 30 segundos", app: "Video Rewards", reward: 150, completed: false },
]

export const GLOBAL_LEADERBOARD_SEED = [
  { name: "CarlosM", score: 4820 },
  { name: "Dani_Fire", score: 3950 },
  { name: "LuzuTV", score: 3410 },
  { name: "ArianaG", score: 2880 },
  { name: "MikePro", score: 2540 },
  { name: "SofiaRR", score: 2190 },
  { name: "ElBananero", score: 1840 },
  { name: "KapoGamers", score: 1520 },
  { name: "NatyX", score: 1280 },
  { name: "RuloGG", score: 980 },
]

const initialState: GameState = {
  authUid: null,
  profile: null,
  isVip: false,
  coins: 0,
  goalPoints: 0,
  diamonds: 0,
  powerups: { shield: 0, superJump: 0 },
  redemptions: [],
  exchangeStatus: "ninguno",
  bannedByAnticheat: false,
  gameStats: { lastScore: 0, bestScore: 0, totalRuns: 0, totalCoinsFromRuns: 0 },
  wheel: { spinsToday: 0, lastFreeSpinAt: 0, adSpinsUsed: 0 },
  offerwallTasks: OFFERWALL_TASK_SEED.map((t) => ({ ...t })),
  notifications: [],
  muted: false,
  selectedShip: "fighter",
  unlockedShips: ["fighter"],
}

let state: GameState = loadState()
const listeners = new Set<() => void>()

// Callback opcional para persistir en Firestore (lo conecta layer Firebase).
let persistenceFn: ((patch: Partial<GameState>) => void) | null = null
export function setPersistence(fn: (patch: Partial<GameState>) => void) {
  persistenceFn = fn
}

function loadState(): GameState {
  if (typeof window === "undefined") return initialState
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return initialState
    const parsed = JSON.parse(raw) as Partial<GameState>
    const merged: GameState = {
      ...initialState,
      ...parsed,
      powerups: { shield: 0, superJump: 0, ...(parsed.powerups ?? {}) },
      gameStats: { ...initialState.gameStats, ...(parsed.gameStats ?? {}) },
      wheel: { spinsToday: 0, lastFreeSpinAt: 0, adSpinsUsed: 0, ...(parsed.wheel ?? {}) },
      offerwallTasks: parsed.offerwallTasks ?? OFFERWALL_TASK_SEED.map((t) => ({ ...t })),
      redemptions: parsed.redemptions ?? [],
      notifications: parsed.notifications ?? [],
      muted: parsed.muted ?? false,
      selectedShip: parsed.selectedShip ?? "fighter",
      unlockedShips: parsed.unlockedShips ?? ["fighter"],
    }
    // Hidrata la wallet segura con los valores locales (respaldo offline).
    secureWallet.hydrate(
      merged.coins,
      merged.diamonds,
      merged.goalPoints,
    )
    return merged
  } catch {
    return initialState
  }
}

function persist() {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* ignore */
  }
}

function setState(next: Partial<GameState>, options: { skipFirebase?: boolean } = {}) {
  state = { ...state, ...next }
  persist()
  // Nunca persiste en Firebase si el anticheat está activo.
  if (!state.bannedByAnticheat && !options.skipFirebase) {
    persistenceFn?.(next)
  }
  emit()
}

function emit() {
  listeners.forEach((l) => l())
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getSnapshot(): GameState {
  return state
}

export function getServerSnapshot(): GameState {
  return initialState
}

/* ----------------------------------------------------------------------------
 * Sincronización con Firebase (la capa superior decide qué persistir).
 * ------------------------------------------------------------------------- */
export function bindSessionToStore(
  uid: string,
  data: { nombre: string; edad: number; nacionalidad: string; email: string },
) {
  setState({ authUid: uid, profile: { firstName: data.nombre, lastName: "", age: data.edad, nationality: data.nacionalidad, email: data.email, createdAt: Date.now() } }, { skipFirebase: true })
}

export function hydrateFromFirebase(s: {
  uid: string
  nombre: string
  edad: number
  nacionalidad: string
  email: string
  monedas: number
  diamantes: number
  puntos: number
  es_vip: boolean
  estado_canje: ExchangeStatus
  bestScore: number
  totalRuns: number
  totalCoinsFromRuns: number
}) {
  // El anticheat se resetea al hacer login legítimo.
  secureWallet.resetAnticheat()
  secureWallet.hydrate(s.monedas, s.diamantes, s.puntos)
  setState({
    authUid: s.uid,
    profile: { firstName: s.nombre, lastName: "", age: s.edad, nationality: s.nacionalidad, email: s.email, createdAt: Date.now() },
    isVip: s.es_vip,
    coins: s.monedas,
    diamonds: s.diamantes,
    goalPoints: s.puntos,
    exchangeStatus: s.estado_canje,
    bannedByAnticheat: false,
    gameStats: { lastScore: 0, bestScore: s.bestScore, totalRuns: s.totalRuns, totalCoinsFromRuns: s.totalCoinsFromRuns },
  }, { skipFirebase: true })
}

export function clearSession() {
  secureWallet.resetAnticheat()
  setState({
    authUid: null,
    profile: null,
    isVip: false,
    coins: 0,
    diamonds: 0,
    goalPoints: 0,
    exchangeStatus: "ninguno",
    powerups: { shield: 0, superJump: 0 },
  }, { skipFirebase: true })
}

/* ----------------------------------------------------------------------------
 * Estado del canje (candado anti-spam + reacción tiempo real)
 * ------------------------------------------------------------------------- */
export function setExchangeStatus(status: ExchangeStatus) {
  setState({ exchangeStatus: status })
}

/* ----------------------------------------------------------------------------
 * VIP (compra vía Google Play Billing simulada) - sin costar monedas
 * ------------------------------------------------------------------------- */
export function purchaseVipGooglePlay(): { ok: true } | { ok: false; reason: string } {
  setState({
    isVip: true,
    vipPurchase: { purchasedAt: Date.now(), method: "google_play" },
  })
  return { ok: true }
}

export function setVip(vip: boolean): void {
  setState({ isVip: vip, vipPurchase: vip ? { purchasedAt: Date.now(), method: "google_play" } : undefined })
}

/* ----------------------------------------------------------------------------
 * Runner: economía por recolección + curva +1%/s. Sin monedas por distancia.
 * ------------------------------------------------------------------------- */
export function collectCoin(amount = 1): { ok: boolean; banned?: boolean } {
  const before = secureWallet.isBanned()
  const ok = secureWallet.addCoins(amount, () => {
    // Callback de hack: congela y notifica.
    setState({ bannedByAnticheat: true })
    pushNotification(ANTICHEAT_BANNER)
  })
  const bannedNow = secureWallet.isBanned()
  if (ok && !before) {
    setState({ coins: secureWallet.getCoins() })
  }
  if (bannedNow && !before) {
    setState({ bannedByAnticheat: true })
    return { ok: false, banned: true }
  }
  return { ok }
}

export function endRun(coinsEarned: number, score: number): { banned: boolean } {
  if (state.bannedByAnticheat) {
    return { banned: true }
  }
  if (coinsEarned > 0) {
    secureWallet.addCoins(coinsEarned, () => {
      setState({ bannedByAnticheat: true })
      pushNotification(ANTICHEAT_BANNER)
    })
  }
  if (secureWallet.isBanned()) {
    setState({ bannedByAnticheat: true })
    return { banned: true }
  }
  const best = Math.max(state.gameStats.bestScore, score)
  setState({
    coins: secureWallet.getCoins(),
    gameStats: {
      lastScore: score,
      bestScore: best,
      totalRuns: state.gameStats.totalRuns + 1,
      totalCoinsFromRuns: state.gameStats.totalCoinsFromRuns + coinsEarned,
    },
  })
  return { banned: false }
}

export function isAnticheatBanned(): boolean {
  return state.bannedByAnticheat
}

export function notifyRevive(): void {
  pushNotification("¡Vida extra activada! Sigues corriendo con GarrDash. 🎥")
}

/* ----------------------------------------------------------------------------
 * Tienda: puntos objetivo + diamantes + candado anti-spam.
 * ------------------------------------------------------------------------- */
export function buyGoalPoint(): { ok: true } | { ok: false; reason: string } {
  if (state.exchangeStatus !== "ninguno") {
    return { ok: false, reason: "Tienes un canje pendiente. Espera la aprobación." }
  }
  if (!secureWallet.spend(GOAL_POINT_COST_IN_COINS)) {
    return { ok: false, reason: "Necesitas 2.000 monedas para 1 Punto de Objetivo." }
  }
  secureWallet.addGoalPoints(1)
  setState({ coins: secureWallet.getCoins(), goalPoints: secureWallet.getGoalPoints() })
  return { ok: true }
}

export function redeemDiamonds(
  pack: DiamondPack,
  freeFireId: string,
  email: string,
): { ok: true; redemption: DiamondRedemption } | { ok: false; reason: string } {
  if (state.exchangeStatus !== "ninguno") {
    return { ok: false, reason: "Ya tienes un reclamo en proceso. Espera la aprobación (24-72h)." }
  }
  const id = freeFireId.trim()
  if (!/^\d{6,12}$/.test(id)) {
    return { ok: false, reason: "El ID de jugador debe tener entre 6 y 12 digitos." }
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return { ok: false, reason: "Introduce un correo electrónico válido." }
  }
  if (!secureWallet.spendGoalPoints(pack.goalPointCost)) {
    return { ok: false, reason: `Necesitas ${pack.goalPointCost} Puntos de Objetivo.` }
  }
  const redemption: DiamondRedemption = {
    id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    packId: pack.id,
    packName: pack.name,
    diamonds: pack.diamonds,
    goalPointCost: pack.goalPointCost,
    freeFireId: id,
    email: email.trim(),
    status: "En Revisión",
    createdAt: Date.now(),
  }
  setState({
    goalPoints: secureWallet.getGoalPoints(),
    redemptions: [redemption, ...state.redemptions].slice(0, 100),
    exchangeStatus: "pendiente",
  })
  return { ok: true, redemption }
}

export function approveExchange(): void {
  setState({
    exchangeStatus: "aprobado",
    redemptions: state.redemptions.map((r, i) =>
      i === 0 ? { ...r, status: "Completado", resolvedAt: Date.now() } : r,
    ),
  })
}

export function clearExchangeAfterNotification(): void {
  secureWallet.addDiamonds(state.redemptions[0]?.diamonds ?? 0)
  setState({
    exchangeStatus: "ninguno",
    diamonds: secureWallet.getDiamonds(),
  })
}

/* ----------------------------------------------------------------------------
 * Power-ups
 * ------------------------------------------------------------------------- */
export function buyPowerup(type: PowerupType): { ok: true } | { ok: false; reason: string } {
  const pack = POWERUP_PACKS.find((p) => p.type === type)!
  if (state.bannedByAnticheat) return { ok: false, reason: "Cuenta congelada por anticheat." }
  if (!secureWallet.spend(pack.cost)) {
    return { ok: false, reason: `Necesitas ${pack.cost} monedas para ${pack.name}.` }
  }
  setState({
    coins: secureWallet.getCoins(),
    powerups: { ...state.powerups, [type]: state.powerups[type] + 1 },
  })
  return { ok: true }
}

export function consumePowerup(type: PowerupType): boolean {
  if (state.powerups[type] <= 0) return false
  setState({
    powerups: { ...state.powerups, [type]: state.powerups[type] - 1 },
  })
  return true
}

/* ----------------------------------------------------------------------------
 * Offerwall (callback seguro simulado)
 * ------------------------------------------------------------------------- */
export function completeOfferwallTask(taskId: string): { ok: true; reward: number } | { ok: false; reason: string } {
  const task = state.offerwallTasks.find((t) => t.id === taskId)
  if (!task) return { ok: false, reason: "Tarea no encontrada." }
  if (task.completed) return { ok: false, reason: "Esta tarea ya fue completada." }
  secureWallet.addCoins(task.reward, () => {
    setState({ bannedByAnticheat: true })
    pushNotification(ANTICHEAT_BANNER)
  })
  if (secureWallet.isBanned()) {
    setState({ bannedByAnticheat: true })
    return { ok: false, reason: "Incremento imposible detectado. Partida congelada." }
  }
  setState({
    coins: secureWallet.getCoins(),
    offerwallTasks: state.offerwallTasks.map((t) =>
      t.id === taskId ? { ...t, completed: true } : t,
    ),
  })
  return { ok: true, reward: task.reward }
}

export function resetOfferwallIfNeeded(): void {
  if (state.offerwallTasks.length > 0 && state.offerwallTasks.every((t) => t.completed)) {
    setState({ offerwallTasks: OFFERWALL_TASK_SEED.map((t) => ({ ...t })) })
  }
}

/* ----------------------------------------------------------------------------
 * Notificaciones
 * ------------------------------------------------------------------------- */
export function pushNotification(message: string): void {
  const n: PushNotification = {
    id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    message,
    createdAt: Date.now(),
  }
  setState({ notifications: [...state.notifications, n].slice(-10) })
}

export function dismissNotification(id: string): void {
  setState({ notifications: state.notifications.filter((n) => n.id !== id) })
}

export function getLiveNotification(): string | null {
  return state.notifications.length > 0
    ? state.notifications[state.notifications.length - 1].message
    : null
}

/* ----------------------------------------------------------------------------
 * Ruleta diaria: probabilidades 89.9 / 10 / 0.1.
 * - VIP: 2 giros diarios gratis automáticamente.
 * - Normal: 1 giro gratis + 1 por anuncio simulado.
 * ------------------------------------------------------------------------- */
export interface WheelStatus {
  spinsToday: number
  maxSpins: number
  adSpinsUsed: number
  freeAvailable: boolean
  adAvailable: boolean
}

export function wheelStatus(): WheelStatus {
  const maxSpins = state.isVip ? 2 : 1
  const freeAvailable =
    state.wheel.spinsToday === 0 || Date.now() - state.wheel.lastFreeSpinAt >= DAY_MS
  return {
    spinsToday: state.wheel.spinsToday,
    maxSpins,
    adSpinsUsed: state.wheel.adSpinsUsed,
    freeAvailable,
    adAvailable: !state.isVip && state.wheel.adSpinsUsed < 1,
  }
}

export function drawWheelPrize(): WheelPrize {
  const roll = Math.random()
  if (roll < 0.001) return { tier: "jackpot", amount: randInRange(101, 500) }
  if (roll < 0.1) return { tier: "mid", amount: randInRange(50, 100) }
  return { tier: "low", amount: randInRange(1, 49) }
}

function randInRange(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export function isJackpotSpin(prize: WheelPrize): boolean {
  return prize.tier === "jackpot"
}

export function awardWheelPrize(prize: WheelPrize): void {
  secureWallet.addCoins(prize.amount)
  const usedFree = Date.now() - state.wheel.lastFreeSpinAt >= DAY_MS
  setState({
    coins: secureWallet.getCoins(),
    wheel: {
      spinsToday: state.wheel.spinsToday + 1,
      lastFreeSpinAt: usedFree ? Date.now() : state.wheel.lastFreeSpinAt,
      adSpinsUsed: state.wheel.adSpinsUsed,
    },
  })
}

export function awardWheelPrizeViaAd(prize: WheelPrize): void {
  secureWallet.addCoins(prize.amount)
  setState({
    coins: secureWallet.getCoins(),
    wheel: {
      spinsToday: state.wheel.spinsToday + 1,
      lastFreeSpinAt: state.wheel.lastFreeSpinAt,
      adSpinsUsed: state.wheel.adSpinsUsed + 1,
    },
  })
}

export function resetDailyWheelIfNeeded(): void {
  if (state.wheel.spinsToday > 0 && Date.now() - state.wheel.lastFreeSpinAt >= DAY_MS) {
    setState({
      wheel: { spinsToday: 0, lastFreeSpinAt: state.wheel.lastFreeSpinAt, adSpinsUsed: 0 },
    })
  }
  resetOfferwallIfNeeded()
}

/* ----------------------------------------------------------------------------
 * Mute
 * ------------------------------------------------------------------------- */
export function setMutedState(muted: boolean): void {
  setState({ muted })
}

export function forceResolveOldest(): void {
  const oldest = state.redemptions.find((r) => r.status === "En Revisión")
  if (!oldest) return
  const completed = Math.random() < 0.7
  const status: RedemptionStatus = completed ? "Completado" : "Cancelado"
  const next = state.redemptions.map((r) =>
    r.id === oldest.id ? { ...r, status, resolvedAt: Date.now() } : r,
  )
  setState({ redemptions: next, exchangeStatus: "ninguno" })
  if (completed) {
    pushNotification("Tus diamantes han sido enviados! Revisa tu cuenta de juego. Gracias por jugar!")
  } else {
    pushNotification("Tu reclamo fue cancelado: cuenta suspendida. 💎❌")
  }
}

/* ----------------------------------------------------------------------------
 * Seleccion de naves
 * ------------------------------------------------------------------------- */
export function selectShip(shipId: ShipType): boolean {
  if (!state.unlockedShips.includes(shipId)) return false
  setState({ selectedShip: shipId })
  return true
}

export function unlockShip(shipId: ShipType): { ok: true } | { ok: false; reason: string } {
  if (state.unlockedShips.includes(shipId)) {
    return { ok: false, reason: "Ya tienes esta nave desbloqueada." }
  }
  const ship = SHIPS.find(s => s.id === shipId)
  if (!ship) {
    return { ok: false, reason: "Nave no encontrada." }
  }
  if (!secureWallet.spend(ship.unlockCost)) {
    return { ok: false, reason: `Necesitas ${ship.unlockCost} monedas para desbloquear esta nave.` }
  }
  setState({
    coins: secureWallet.getCoins(),
    unlockedShips: [...state.unlockedShips, shipId],
    selectedShip: shipId,
  })
  pushNotification(`Nave desbloqueada: ${ship.name}`)
  return { ok: true }
}

/* ----------------------------------------------------------------------------
 * Mascotas / Drones
 * ------------------------------------------------------------------------- */
const DRONE_COSTS: Record<ShipType, number> = {
  "drone-attack": 800,
  "drone-shield": 1200,
  "drone-collector": 1500,
  fighter: 0,
  bomber: 0,
  interceptor: 0,
  tank: 0,
}

export function unlockDrone(droneId: ShipType): { ok: true } | { ok: false; reason: string } {
  if (state.unlockedShips.includes(droneId)) {
    return { ok: false, reason: "Ya tienes este dron desbloqueado." }
  }
  const cost = DRONE_COSTS[droneId]
  if (!cost) {
    return { ok: false, reason: "Dron no encontrado." }
  }
  if (!secureWallet.spend(cost)) {
    return { ok: false, reason: `Necesitas ${cost} monedas para desbloquear este dron.` }
  }
  setState({
    coins: secureWallet.getCoins(),
    unlockedShips: [...state.unlockedShips, droneId],
  })
  pushNotification(`Dron desbloqueado!`)
  return { ok: true }
}

export function equipDrone(droneId: ShipType): boolean {
  if (!state.unlockedShips.includes(droneId)) return false
  setState({ selectedShip: droneId })
  return true
}

export function getSelectedShipConfig() {
  return SHIPS.find(s => s.id === state.selectedShip) ?? SHIPS[0]
}
