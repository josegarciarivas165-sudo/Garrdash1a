export interface PlayerProfile {
  firstName: string
  lastName: string
  age: number
  nationality: string
  email: string
  createdAt: number
}

// Estado de canje sincronizado con Firestore ('estado_canje').
export type ExchangeStatus = "ninguno" | "pendiente" | "aprobado"

// Redención con tres estados visuales + ventana de 72h de revisión.
export type RedemptionStatus = "En Revisión" | "Completado" | "Cancelado"

export interface DiamondRedemption {
  id: string
  packId: string
  packName: string
  diamonds: number
  goalPointCost: number
  freeFireId: string
  email: string
  status: RedemptionStatus
  createdAt: number
  resolvedAt?: number
}

export interface WheelPrize {
  amount: number
  tier: "low" | "mid" | "jackpot" | "epic" | "rare"
}

export interface PushNotification {
  id: string
  message: string
  createdAt: number
}

export interface GameRunStats {
  lastScore: number
  bestScore: number // histórico de puntos (nunca baja)
  totalRuns: number
  totalCoinsFromRuns: number
}

export type PowerupType = "shield" | "superJump"

export interface OwnedPowerup {
  type: PowerupType
  quantity: number
}

export interface OfferwallTask {
  id: string
  title: string
  reward: number
  app: string
  completed: boolean
}

export interface VIPPurchase {
  purchasedAt: number
  method: "google_play"
}

export type ShipType = "fighter" | "bomber" | "interceptor" | "tank" | "drone-attack" | "drone-shield" | "drone-collector"

export interface ShipConfig {
  id: ShipType
  name: string
  description: string
  speed: number
  fireRate: number
  unlockCost: number
  premium: boolean
  emoji: string
}

export const SHIPS: ShipConfig[] = [
  {
    id: "fighter",
    name: "Fighter X",
    description: "Nave equilibrada. Velocidad y potencia de fuego estándar.",
    speed: 1.0,
    fireRate: 1.0,
    unlockCost: 0,
    premium: false,
    emoji: "✈️",
  },
  {
    id: "bomber",
    name: "Bomber Pro",
    description: "Mayor daño, velocidad reducida. Para estrategas.",
    speed: 0.7,
    fireRate: 1.5,
    unlockCost: 2500,
    premium: false,
    emoji: "🛩️",
  },
  {
    id: "interceptor",
    name: "Interceptor Z",
    description: "Máxima velocidad y cadencia de disparo. Avanzado.",
    speed: 1.4,
    fireRate: 1.8,
    unlockCost: 5000,
    premium: true,
    emoji: "🚀",
  },
  {
    id: "tank",
    name: "Tanque Golem",
    description: "Lento pero resistente. Soporta más impactos.",
    speed: 0.5,
    fireRate: 0.8,
    unlockCost: 8000,
    premium: true,
    emoji: "🛡️",
  },
]

export interface GameState {
  authUid: string | null
  profile: PlayerProfile | null
  isVip: boolean
  vipPurchase?: VIPPurchase
  coins: number
  goalPoints: number
  diamonds: number // diamantes acumulados locales
  powerups: Record<PowerupType, number>
  redemptions: DiamondRedemption[]
  exchangeStatus: ExchangeStatus
  bannedByAnticheat: boolean
  gameStats: GameRunStats
  wheel: {
    spinsToday: number
    lastFreeSpinAt: number
    adSpinsUsed: number
  }
  offerwallTasks: OfferwallTask[]
  notifications: PushNotification[]
  muted: boolean
  selectedShip: ShipType
  unlockedShips: ShipType[]
}

// Catálogo de paquetes de diamantes canjeables con Puntos de Objetivo.
export interface DiamondPack {
  id: string
  name: string
  diamonds: number
  goalPointCost: number
  popular?: boolean
}

// Catálogo de power-ups comprables con monedas.
export interface PowerupPack {
  type: PowerupType
  name: string
  icon: string
  description: string
  cost: number
}
