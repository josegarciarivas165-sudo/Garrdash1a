"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { useGameStore, formatNumber } from "@/lib/use-game-store"
import { endRun, notifyRevive, consumePowerup, collectCoin } from "@/lib/store"
import {
  ArrowLeft, RotateCcw, Play, Video, Shield, Home,
  Coins, Trophy, Volume2, VolumeX, Heart,
  Zap, Star, TrendingUp, AlertTriangle,
} from "lucide-react"
import { AdMobBanner } from "@/components/admob-banner"
import {
  setScene, playCoinSfx, playHitSfx,
  isMuted, setMuted, playButtonSfx, unlockAudio, playShootSfx, playExplosionSfx,
} from "@/lib/audio"
import { setMutedState } from "@/lib/store"
import { SHIPS } from "@/lib/types"

type GamePhase = "ready" | "playing" | "over" | "fever"
type PowerupType = "tripleShot" | "turbo" | "shield" | "drone"
type EnemyType = "meteor" | "enemyShip" | "miniBoss" | "boss"

// === CONSTANTES - Configuracion definitiva produccion ===
const PLAYER_SIZE = 20
const PROJECTILE_SIZE = 3
const COIN_SIZE = 8
const PROJECTILE_SPEED = 320
const PLAYER_SPEED = 0.07
const BASE_SHOOT_INTERVAL = 140
const MAX_HEALTH = 100
const DAMAGE_METEOR = 15
const DAMAGE_ENEMY = 20
const DAMAGE_BOSS = 35
const MAX_COINS_PER_RUN = 70
// MINI_BOSS_INTERVAL definido abajo
const BOSS_INTERVAL = 120000 // 120s
const SUPPLY_CRATE_INTERVAL = 30000
const FRENZY_COIN_THRESHOLD = 5
const FRENZY_TIME_WINDOW = 3000
const FRENZY_DURATION = 5000
const COMBO_TIMEOUT = 1000
const FEVER_DURATION = 5000
// Sistema de puntuacion arcade
const POINTS_PER_SECOND = 10 // +10 pts por segundo de supervivencia
// Balance de combate y jefes
const BOSS_HEALTH = 10 // Boss con exactamente 10 de vida (reto de precision)
const BOSS_ATTACK_SPEED_MULTIPLIER = 3 // Boss ataca 3x mas rapido
const MINI_BOSS_HEALTH = 5 // Mini-boss con vida intermedia
const MINI_BOSS_INTERVAL = 60000 // Mini-boss cada 60 segundos
// Ajustes criticos de jugabilidad
const ENEMY_MAX_Y_RATIO = 0.45 // Enemigos no bajan del 45% de la pantalla
const ENEMY_PROJECTILE_SPEED = 80 // Proyectiles enemigos lentos y esquivables
const MAX_ENEMIES_ON_SCREEN = 4 // Maximo 4 enemigos simultaneos
const WAVE_DELAY = 2000 // 2 segundos entre oleadas
// Economia de monedas: SOLO al destruir enemigos
const COIN_DROP_CHANCE = 0.05 // 5% probabilidad al destruir enemigo comun
const BOSS_COIN_REWARD = 10 // Monedas fijas al derrotar al Jefe
// Dificultad: enemigos comunes con doble vida
const ENEMY_HEALTH_MULTIPLIER = 2

interface Projectile {
  id: number
  x: number
  y: number
  angle?: number
  isDrone?: boolean
}

interface EnemyProjectile {
  id: number
  x: number
  y: number
  vy: number
}

interface Enemy {
  id: number
  x: number
  y: number
  width: number
  height: number
  health: number
  maxHealth: number
  type: EnemyType
  speed: number
  shootTimer: number
  shootInterval: number
  rotation: number
  pattern: number
}

interface CoinDrop {
  id: number
  x: number
  y: number
  rotation: number
  value: number
}

interface SupplyCrate {
  id: number
  x: number
  y: number
  type: PowerupType
}

interface Drone {
  id: number
  offsetX: number
  offsetY: number
  shootTimer: number
  trail: { x: number; y: number; life: number }[]
  spinAngle: number
}

interface Particle {
  id: number
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  color: string
  size: number
}

type RevivePower = "double" | "triple" | "doubleProgress" | null

export function RunnerGame({ onExit }: { onExit: () => void }) {
  const state = useGameStore()
  const shipConfig = SHIPS.find(s => s.id === state.selectedShip) ?? SHIPS[0]
  const hasDrone = state.powerups.shield > 0 || state.unlockedShips.includes("drone-attack")

  const [phase, setPhase] = useState<GamePhase>("ready")
  const [score, setScore] = useState(0)
  const [coinsThisRun, setCoinsThisRun] = useState(0)
  const [health, setHealth] = useState(MAX_HEALTH)
  const [floatCoins, setFloatCoins] = useState<{ id: number; x: number; y: number; v: number }[]>([])
  const [elapsed, setElapsed] = useState(0)
  const [shieldActive, setShieldActive] = useState(false)
  const [reviveAvailable, setReviveAvailable] = useState(true)
  const [reviveAdActive, setReviveAdActive] = useState(false)
  const [reviveCountdown, setReviveCountdown] = useState(0)
  const [revivePower, setRevivePower] = useState<RevivePower>(null)
  const [fireRateMultiplier, setFireRateMultiplier] = useState(1)
  const [tripleShot, setTripleShot] = useState(false)
  const [turboMode, setTurboMode] = useState(false)
  const [frenzyMode, setFrenzyMode] = useState(false)
  const [feverMode, setFeverMode] = useState(false)
  const [droneActive, setDroneActive] = useState(false)
  const [combo, setCombo] = useState(0)
  const [comboDisplay, setComboDisplay] = useState(0)
  const [gameWidth, setGameWidth] = useState(0)
  const [gameHeight, setGameHeight] = useState(0)
  const [recordNotification, setRecordNotification] = useState<string | null>(null)
  const [hackDetected, setHackDetected] = useState(false)
  const [bossDefeated, setBossDefeated] = useState(0)
  const [shipEvolution, setShipEvolution] = useState(0)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const playerXRef = useRef(0.5)
  const playerYRef = useRef(0.85)
  const playerTargetXRef = useRef(0.5)
  const playerTargetYRef = useRef(0.85)
  const projectilesRef = useRef<Projectile[]>([])
  const enemyProjectilesRef = useRef<EnemyProjectile[]>([])
  const enemiesRef = useRef<Enemy[]>([])
  const coinsRef = useRef<CoinDrop[]>([])
  const supplyCratesRef = useRef<SupplyCrate[]>([])
  const particlesRef = useRef<Particle[]>([])
  const dronesRef = useRef<Drone[]>([])
  const nextIdRef = useRef(1)
  const distanceRef = useRef(0)
  const collectedRef = useRef(0)
  const shieldUsedRef = useRef(false)
  const phaseRef = useRef<GamePhase>("ready")
  const reviveAvailableRef = useRef(true)
  const lastShotRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const miniBossTimerRef = useRef(0)
  const bossTimerRef = useRef(0)
  const difficultyRef = useRef(1)
  const healthRef = useRef(MAX_HEALTH)
  const runStartRef = useRef(0)
  const fireRateRef = useRef(1)
  const tripleShotRef = useRef(false)
  const turboRef = useRef(false)
  const frenzyRef = useRef(false)
  const feverRef = useRef(false)
  const droneRef = useRef(false)
  const lastSupplyCrateRef = useRef(0)
  const lastMiniBossRef = useRef(0)
  const lastBossRef = useRef(0)
  const lastRandomCoinRef = useRef(0)
  const coinCollectTimesRef = useRef<number[]>([])
  const comboRef = useRef(0)
  const lastKillTimeRef = useRef(0)
  const previousScoreRef = useRef(state.gameStats.bestScore)
  const feverTimerRef = useRef(0)

  const [, forceRender] = useState(0)
  const renderTick = useCallback(() => forceRender((n) => n + 1), [])

  useEffect(() => { phaseRef.current = phase }, [phase])

  // Dimensiones responsive
  useEffect(() => {
    function updateDimensions() {
      const isDesktop = window.innerWidth > 500
      const maxW = isDesktop ? 450 : window.innerWidth
      const h = isDesktop ? Math.min(window.innerHeight - 40, 800) : window.innerHeight - 40
      setGameWidth(maxW)
      setGameHeight(h)
    }
    updateDimensions()
    window.addEventListener("resize", updateDimensions)
    return () => window.removeEventListener("resize", updateDimensions)
  }, [])

  // BGM
  useEffect(() => {
    if (phase === "playing" && !isMuted()) setScene("game")
    return () => { if (phase === "playing") setScene("menu") }
  }, [phase])

  useEffect(() => { return () => { setScene("menu") } }, [])

  const spawnParticles = useCallback((x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2
      const speed = 18 + Math.random() * 50
      particlesRef.current.push({
        id: nextIdRef.current++,
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.18 + Math.random() * 0.18,
        maxLife: 0.18 + Math.random() * 0.18,
        color,
        size: 1.5 + Math.random() * 1.5,
      })
    }
  }, [])

  const resetGame = useCallback(() => {
    shieldUsedRef.current = false
    setShieldActive(state.powerups.shield > 0)
    healthRef.current = MAX_HEALTH
    setHealth(MAX_HEALTH)
    fireRateRef.current = 1
    setFireRateMultiplier(1)
    tripleShotRef.current = false
    setTripleShot(false)
    turboRef.current = false
    setTurboMode(false)
    frenzyRef.current = false
    setFrenzyMode(false)
    feverRef.current = false
    setFeverMode(false)
    droneRef.current = hasDrone
    setDroneActive(hasDrone)
    comboRef.current = 0
    setCombo(0)
    setComboDisplay(0)
    coinCollectTimesRef.current = []
    previousScoreRef.current = state.gameStats.bestScore
    setBossDefeated(0)
    setShipEvolution(0)
    feverTimerRef.current = 0

    if (hasDrone) {
      dronesRef.current = [
        { id: 1, offsetX: -22, offsetY: -12, shootTimer: 0, trail: [], spinAngle: 0 },
        { id: 2, offsetX: 22, offsetY: -12, shootTimer: 0, trail: [], spinAngle: 0 },
      ]
    } else {
      dronesRef.current = []
    }

    playerXRef.current = 0.5
    playerYRef.current = 0.85
    playerTargetXRef.current = 0.5
    playerTargetYRef.current = 0.85
    projectilesRef.current = []
    enemyProjectilesRef.current = []
    enemiesRef.current = []
    coinsRef.current = []
    supplyCratesRef.current = []
    particlesRef.current = []
    distanceRef.current = 0
    collectedRef.current = 0
    lastShotRef.current = 0
    spawnTimerRef.current = 0
    miniBossTimerRef.current = 0
    bossTimerRef.current = 0
    difficultyRef.current = 1
    reviveAvailableRef.current = true
    lastSupplyCrateRef.current = Date.now()
    lastMiniBossRef.current = Date.now()
    lastBossRef.current = Date.now()
    lastRandomCoinRef.current = Date.now()

    setScore(0)
    setCoinsThisRun(0)
    setHealth(MAX_HEALTH)
    setFloatCoins([])
    setElapsed(0)
    setReviveAvailable(true)
    setReviveAdActive(false)
    setReviveCountdown(0)
    setRevivePower(null)
    setRecordNotification(null)
    setHackDetected(state.bannedByAnticheat)
  }, [state.powerups.shield, state.bannedByAnticheat, state.gameStats.bestScore, hasDrone])

  const startGame = useCallback(() => {
    unlockAudio()
    playButtonSfx()
    resetGame()
    runStartRef.current = Date.now()
    lastSupplyCrateRef.current = Date.now()
    lastMiniBossRef.current = Date.now()
    lastBossRef.current = Date.now()
    lastRandomCoinRef.current = Date.now()
    setPhase("playing")
  }, [resetGame])

  const finishRun = useCallback((finalScore: number, finalCoins: number) => {
    playHitSfx()
    setScene("menu")
    const res = endRun(finalCoins, finalScore)
    if (res.banned) setHackDetected(true)
    setScore(finalScore)
    setCoinsThisRun(finalCoins)
    setPhase("over")
  }, [])

  const handleExit = useCallback(() => {
    unlockAudio()
    playButtonSfx()
    setScene("menu")
    phaseRef.current = "ready"
    projectilesRef.current = []
    enemyProjectilesRef.current = []
    enemiesRef.current = []
    coinsRef.current = []
    supplyCratesRef.current = []
    particlesRef.current = []
    dronesRef.current = []
    setPhase("ready")
    setScore(0)
    setCoinsThisRun(0)
    setHealth(MAX_HEALTH)
    setFloatCoins([])
    setElapsed(0)
    setRecordNotification(null)
    onExit()
  }, [onExit])

  // Control tactil - 0-100% total
  const handlePointerMove = useCallback((clientX: number, clientY: number, containerRect: DOMRect) => {
    if (phaseRef.current !== "playing" && phaseRef.current !== "fever") return
    const relX = (clientX - containerRect.left) / containerRect.width
    const relY = (clientY - containerRect.top) / containerRect.height
    playerTargetXRef.current = Math.max(0, Math.min(1, relX))
    playerTargetYRef.current = Math.max(0, Math.min(1, relY))
  }, [])

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    unlockAudio()
    const rect = e.currentTarget.getBoundingClientRect()
    handlePointerMove(e.clientX, e.clientY, rect)
    if (phaseRef.current === "ready" || phaseRef.current === "over") startGame()
  }, [startGame, handlePointerMove])

  // Teclado
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const step = 0.025
      const turboMult = turboRef.current ? 1.5 : 1
      if (e.code === "ArrowLeft" || e.code === "KeyA") {
        playerTargetXRef.current = Math.max(0, playerXRef.current - step * turboMult)
      } else if (e.code === "ArrowRight" || e.code === "KeyD") {
        playerTargetXRef.current = Math.min(1, playerXRef.current + step * turboMult)
      } else if (e.code === "ArrowUp" || e.code === "KeyW") {
        playerTargetYRef.current = Math.max(0, playerYRef.current - step * turboMult)
      } else if (e.code === "ArrowDown" || e.code === "KeyS") {
        playerTargetYRef.current = Math.min(1, playerYRef.current + step * turboMult)
      } else if (e.code === "Space") {
        e.preventDefault()
        if (phaseRef.current === "ready" || phaseRef.current === "over") startGame()
      } else if (e.code === "Escape") {
        handleExit()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [handleExit, startGame])

  // GAME LOOP
  useEffect(() => {
    if ((phase !== "playing" && phase !== "fever") || gameWidth === 0 || gameHeight === 0) return

    let raf = 0
    function loop(ts: number) {
      raf = window.requestAnimationFrame(loop)
      const dt = Math.min(0.033, (ts - (loop as any).lastTs) / 1000)
      ;(loop as any).lastTs = ts
      if (!Number.isFinite(dt) || dt <= 0) { renderTick(); return }

      const now = Date.now()
      const elapsedSec = (now - runStartRef.current) / 1000
      setElapsed(Math.floor(elapsedSec))

      // Sistema de puntuacion: +10 puntos por segundo de supervivencia
      distanceRef.current += POINTS_PER_SECOND * dt

      // Dificultad progresiva suave (NO por cantidad)
      difficultyRef.current = 1 + elapsedSec * 0.012

      // Movimiento del jugador 0-100%
      const speedMult = turboRef.current ? 1.4 : 1
      const speed = PLAYER_SPEED * speedMult * shipConfig.speed
      playerXRef.current += (playerTargetXRef.current - playerXRef.current) * speed
      playerYRef.current += (playerTargetYRef.current - playerYRef.current) * speed

      // Evolucion visual de nave
      const currentScore = Math.floor(distanceRef.current / 10)
      if (currentScore >= 500 && shipEvolution < 3) { setShipEvolution(3) }
      else if (currentScore >= 300 && shipEvolution < 2) { setShipEvolution(2) }
      else if (currentScore >= 100 && shipEvolution < 1) { setShipEvolution(1) }

      // Nuevo record - Top Mundial actualizado en tiempo real
      if (currentScore > previousScoreRef.current) {
        previousScoreRef.current = currentScore
        setRecordNotification(`Nuevo Top Mundial! ${formatNumber(currentScore)} pts`)
        playCoinSfx()
        setTimeout(() => setRecordNotification(null), 3000)
      }

      const playerPx = playerXRef.current * gameWidth
      const playerPy = playerYRef.current * gameHeight

      // Modo fiebre (post-boss)
      if (feverRef.current) {
        feverTimerRef.current += dt * 1000
        // Lluvia de monedas automatica
        if (Math.random() < 0.15) {
          coinsRef.current.push({
            id: nextIdRef.current++,
            x: Math.random() * (gameWidth - 20) + 10,
            y: -10,
            rotation: 0,
            value: 1,
          })
        }
        if (feverTimerRef.current > FEVER_DURATION) {
          feverRef.current = false
          setFeverMode(false)
          feverTimerRef.current = 0
        }
      }

      // Disparo automatico
      if (!feverRef.current) {
        const baseInterval = BASE_SHOOT_INTERVAL / shipConfig.fireRate / fireRateRef.current
        const frenzyMult = frenzyRef.current ? 1.3 : 1
        const shootInterval = baseInterval / frenzyMult
        if (ts - lastShotRef.current > shootInterval) {
          lastShotRef.current = ts

          if (tripleShotRef.current) {
            projectilesRef.current.push(
              { id: nextIdRef.current++, x: playerPx, y: playerPy - PLAYER_SIZE / 2, angle: 0 },
              { id: nextIdRef.current++, x: playerPx - 5, y: playerPy - PLAYER_SIZE / 2 + 3, angle: -0.1 },
              { id: nextIdRef.current++, x: playerPx + 5, y: playerPy - PLAYER_SIZE / 2 + 3, angle: 0.1 }
            )
          } else {
            projectilesRef.current.push({ id: nextIdRef.current++, x: playerPx, y: playerPy - PLAYER_SIZE / 2 })
          }
          playShootSfx()
        }
      }

      // Drones disparan y actualizan trail
      if (droneRef.current) {
        for (const drone of dronesRef.current) {
          drone.shootTimer += dt * 1000
          drone.spinAngle += 180 * dt
          if (drone.shootTimer > 180) {
            drone.shootTimer = 0
            const dx = playerPx + drone.offsetX
            const dy = playerPy + drone.offsetY
            projectilesRef.current.push({ id: nextIdRef.current++, x: dx, y: dy, isDrone: true })
          }
          // Trail
          drone.trail.push({ x: playerPx + drone.offsetX, y: playerPy + drone.offsetY, life: 0.25 })
          drone.trail = drone.trail.filter(t => { t.life -= dt; return t.life > 0 })
        }
      }

      // Supply crate cada 30s
      if (now - lastSupplyCrateRef.current > SUPPLY_CRATE_INTERVAL && !feverRef.current) {
        lastSupplyCrateRef.current = now
        const types: PowerupType[] = ["tripleShot", "turbo", "shield", "drone"]
        supplyCratesRef.current.push({
          id: nextIdRef.current++,
          x: Math.random() * (gameWidth - 18) + 9,
          y: -18,
          type: types[Math.floor(Math.random() * types.length)],
        })
      }

      // Mini-boss cada 60s - vida intermedia (5)
      if (now - lastMiniBossRef.current > MINI_BOSS_INTERVAL && !feverRef.current && !enemiesRef.current.some(e => e.type === "miniBoss" || e.type === "boss")) {
        lastMiniBossRef.current = now
        enemiesRef.current.push({
          id: nextIdRef.current++,
          x: gameWidth / 2 - 25,
          y: -50,
          width: 50,
          height: 55,
          health: MINI_BOSS_HEALTH,
          maxHealth: MINI_BOSS_HEALTH,
          type: "miniBoss",
          speed: 18,
          shootTimer: 0,
          shootInterval: 400, // Rapido
          rotation: 0,
          pattern: Math.floor(Math.random() * 2),
        })
      }

      // Boss cada 120s - exactamente 10 de vida, ataque 2.5x rapido
      if (now - lastBossRef.current > BOSS_INTERVAL && !feverRef.current && !enemiesRef.current.some(e => e.type === "boss")) {
        lastBossRef.current = now
        enemiesRef.current.push({
          id: nextIdRef.current++,
          x: gameWidth / 2 - 35,
          y: -80,
          width: 70,
          height: 80,
          health: BOSS_HEALTH,
          maxHealth: BOSS_HEALTH,
          type: "boss",
          speed: 15,
          shootTimer: 0,
          shootInterval: Math.floor(350 / BOSS_ATTACK_SPEED_MULTIPLIER), // 2.5x mas rapido
          rotation: 0,
          pattern: Math.floor(Math.random() * 2),
        })
      }

      // Spawn enemigos - MAX 4 en pantalla, con delay entre oleadas
      spawnTimerRef.current += dt
      const currentEnemyCount = enemiesRef.current.length
      const maxReachedY = gameHeight * ENEMY_MAX_Y_RATIO // 45% de la pantalla

      // Solo spawnear si hay menos de 4 enemigos y paso el delay
      const canSpawn = currentEnemyCount < MAX_ENEMIES_ON_SCREEN && spawnTimerRef.current > (WAVE_DELAY / 1000)

      // Meteoritos - se detienen al 45% de la pantalla
      if (Math.random() < 0.008 * difficultyRef.current && !feverRef.current && currentEnemyCount < MAX_ENEMIES_ON_SCREEN) {
        const size = 7 + Math.random() * 9
        let spawnX = Math.random() * (gameWidth - size)
        if (Math.abs(spawnX + size/2 - playerPx) < 60) {
          spawnX = (spawnX + gameWidth / 2) % (gameWidth - size)
        }
        enemiesRef.current.push({
          id: nextIdRef.current++,
          x: spawnX,
          y: -size - 15,
          width: size,
          height: size,
          health: 1,
          maxHealth: 1,
          type: "meteor",
          speed: 40 + Math.random() * 15 * difficultyRef.current,
          shootTimer: 0,
          shootInterval: 999999,
          rotation: Math.random() * 360,
          pattern: 0,
        })
      }

      // Naves enemigas - se detienen al 45% y disparan desde arriba
      if (canSpawn && !feverRef.current) {
        spawnTimerRef.current = 0 // Resetear timer
        const size = 12
        let spawnX = Math.random() * (gameWidth - size)
        if (Math.abs(spawnX + size/2 - playerPx) < 50) {
          spawnX = (spawnX + gameWidth / 2) % (gameWidth - size)
        }
        enemiesRef.current.push({
          id: nextIdRef.current++,
          x: spawnX,
          y: -size - 15,
          width: size,
          height: size,
          health: (1 + Math.floor(difficultyRef.current * 0.2)) * ENEMY_HEALTH_MULTIPLIER, // Doble vida
          maxHealth: (1 + Math.floor(difficultyRef.current * 0.2)) * ENEMY_HEALTH_MULTIPLIER,
          type: "enemyShip",
          speed: 35 + Math.random() * 8 * difficultyRef.current,
          shootTimer: 0,
          shootInterval: Math.max(500, 800 / difficultyRef.current), // Disparo mas lento
          rotation: 0,
          pattern: Math.floor(Math.random() * 3),
        })
      }

      // Actualizar proyectiles
      for (const p of projectilesRef.current) {
        if (p.angle) {
          p.x += Math.sin(p.angle) * PROJECTILE_SPEED * dt
          p.y -= Math.cos(p.angle) * PROJECTILE_SPEED * dt
        } else {
          p.y -= PROJECTILE_SPEED * dt
        }
      }
      projectilesRef.current = projectilesRef.current.filter(p => p.y > -10 && p.x > -10 && p.x < gameWidth + 10)

      // Proyectiles enemigos - VELOCIDAD LENTA, faciles de esquivar
      if (!feverRef.current) {
        for (const ep of enemyProjectilesRef.current) {
          ep.y += ENEMY_PROJECTILE_SPEED * dt // Velocidad lenta
        }
        enemyProjectilesRef.current = enemyProjectilesRef.current.filter(ep => ep.y < gameHeight + 10)
      } else {
        enemyProjectilesRef.current = []
      }

      // Actualizar enemigos (no en fever) - se detienen al 45% de la pantalla
      if (!feverRef.current) {
        for (const e of enemiesRef.current) {
          // Los enemigos se mueven hasta el 45% de la pantalla y se detienen
          if (e.y < maxReachedY) {
            e.y += e.speed * dt
          }
          // Movimiento horizontal cuando estan detenidos
          if (e.y >= maxReachedY * 0.8) {
            if (e.type === "enemyShip") {
              if (e.pattern === 0) e.x += Math.sin(ts * 0.002 + e.id) * 15 * dt
              else if (e.pattern === 1) e.x += Math.cos(ts * 0.003 + e.id) * 20 * dt
            }
          }

          // Disparo desde su posicion (no desde abajo)
          if (e.type === "enemyShip") {
            e.shootTimer += dt * 1000
            if (e.shootTimer > e.shootInterval && e.y > 20) {
              e.shootTimer = 0
              enemyProjectilesRef.current.push({
                id: nextIdRef.current++,
                x: e.x + e.width / 2,
                y: e.y + e.height,
                vy: ENEMY_PROJECTILE_SPEED,
              })
            }
          } else if (e.type === "miniBoss" || e.type === "boss") {
            e.x = gameWidth / 2 - e.width / 2 + Math.sin(ts * 0.001) * (gameWidth * 0.3)
            // Boss si baja hasta el 45%
            if (e.y < maxReachedY) {
              e.y += e.speed * dt
            }
            e.shootTimer += dt * 1000
            if (e.shootTimer > e.shootInterval && e.y > 30) {
              e.shootTimer = 0
              const spread = e.type === "boss" ? 3 : 2 // Reducido de 5/3 a 3/2
              for (let i = 0; i < spread; i++) {
                enemyProjectilesRef.current.push({
                  id: nextIdRef.current++,
                  x: e.x + e.width / 2 + (i - Math.floor(spread / 2)) * 12,
                  y: e.y + e.height,
                  vy: ENEMY_PROJECTILE_SPEED,
                })
              }
            }
          } else if (e.type === "meteor") {
            e.rotation += 40 * dt
            // Meteoritos desaparecen al llegar al 45%
            if (e.y >= maxReachedY) {
              e.health = 0 // Se marcan para eliminar
            }
          }
        }

        // Eliminar enemigos destruidos o que llegaron al limite
        enemiesRef.current = enemiesRef.current.filter(e => e.health > 0)
      }

      // Supply crates
      for (const sc of supplyCratesRef.current) {
        sc.y += 28 * dt
      }
      supplyCratesRef.current = supplyCratesRef.current.filter(sc => sc.y < gameHeight + 15)

      // Monedas
      for (const c of coinsRef.current) {
        c.y += 32 * dt
        c.rotation += 90 * dt
      }
      coinsRef.current = coinsRef.current.filter(c => c.y < gameHeight + 15)

      // Colision jugador - supply crate
      for (const sc of supplyCratesRef.current) {
        const dist = Math.hypot(sc.x + 9 - playerPx, sc.y + 9 - playerPy)
        if (dist < PLAYER_SIZE * 0.65) {
          supplyCratesRef.current = supplyCratesRef.current.filter(s => s.id !== sc.id)
          spawnParticles(sc.x + 9, sc.y + 9, "hsl(150, 80%, 50%)", 5)
          playCoinSfx()

          if (sc.type === "tripleShot") {
            tripleShotRef.current = true
            setTripleShot(true)
            setTimeout(() => { tripleShotRef.current = false; setTripleShot(false) }, 6000)
          } else if (sc.type === "turbo") {
            turboRef.current = true
            setTurboMode(true)
            setTimeout(() => { turboRef.current = false; setTurboMode(false) }, 7000)
          } else if (sc.type === "shield") {
            shieldUsedRef.current = false
            setShieldActive(true)
          } else if (sc.type === "drone") {
            droneRef.current = true
            setDroneActive(true)
            dronesRef.current = [
              { id: 1, offsetX: -22, offsetY: -12, shootTimer: 0, trail: [], spinAngle: 0 },
              { id: 2, offsetX: 22, offsetY: -12, shootTimer: 0, trail: [], spinAngle: 0 },
            ]
          }
        }
      }

      // Colision proyectil - enemigo (no en fever)
      if (!feverRef.current) {
        for (const p of projectilesRef.current) {
          for (const e of enemiesRef.current) {
            if (p.x > e.x - 2 && p.x < e.x + e.width + 2 && p.y > e.y && p.y < e.y + e.height) {
              const dmg = frenzyRef.current ? 2 : 1
              e.health -= dmg
              projectilesRef.current = projectilesRef.current.filter(pr => pr.id !== p.id)
              if (e.health <= 0) {
                playExplosionSfx()
                spawnParticles(e.x + e.width/2, e.y + e.height/2,
                  e.type === "boss" ? "hsl(45, 100%, 60%)" : e.type === "miniBoss" ? "hsl(280, 70%, 55%)" : e.type === "enemyShip" ? "hsl(330, 90%, 60%)" : "hsl(45, 100%, 55%)",
                  e.type === "boss" ? 16 : e.type === "miniBoss" ? 12 : 8)

                let coinValue = 1
                let coinCount = 1
                if (e.type === "enemyShip") { coinValue = 2; coinCount = 1 + Math.floor(Math.random() * 2) }
                else if (e.type === "miniBoss") { coinValue = 8; coinCount = 3 }
                else if (e.type === "boss") {
                  // Boss da 10 monedas fijas
                  coinValue = BOSS_COIN_REWARD
                  coinCount = 1
                  setBossDefeated(prev => prev + 1)
                  // Activar modo fiebre!
                  feverRef.current = true
                  setFeverMode(true)
                  feverTimerRef.current = 0
                }

                // Solo soltar moneda si es boss (siempre) o con 5% probabilidad para enemigos comunes
                const shouldDropCoin = e.type === "boss" || e.type === "miniBoss" || Math.random() < COIN_DROP_CHANCE
                if (shouldDropCoin) {
                  for (let i = 0; i < coinCount; i++) {
                    if (collectedRef.current < MAX_COINS_PER_RUN) {
                      coinsRef.current.push({
                        id: nextIdRef.current++,
                        x: e.x + Math.random() * e.width,
                        y: e.y + Math.random() * e.height,
                        rotation: 0,
                        value: coinValue,
                      })
                    }
                  }
                }

                enemiesRef.current = enemiesRef.current.filter(en => en.id !== e.id)
                distanceRef.current += e.type === "boss" ? 70 : e.type === "miniBoss" ? 30 : e.type === "enemyShip" ? 10 : 5

                // Combo
                const now2 = Date.now()
                if (now2 - lastKillTimeRef.current < COMBO_TIMEOUT) {
                  comboRef.current++
                  setCombo(comboRef.current)
                  setComboDisplay(comboRef.current)
                } else {
                  comboRef.current = 1
                  setCombo(1)
                  setComboDisplay(1)
                }
                lastKillTimeRef.current = now2
                setTimeout(() => setComboDisplay(0), COMBO_TIMEOUT + 350)

                // Drones giran al matar
                for (const d of dronesRef.current) {
                  d.spinAngle += 360
                }
              }
              break
            }
          }
        }
      }

      // En fever mode, todos los enemigos se destruyen automaticamente
      if (feverRef.current) {
        for (const e of enemiesRef.current) {
          spawnParticles(e.x + e.width/2, e.y + e.height/2, "hsl(45, 100%, 60%)", 6)
          distanceRef.current += 10
        }
        enemiesRef.current = []
        enemyProjectilesRef.current = []
      }

      // Colision jugador - moneda
      for (const c of coinsRef.current) {
        const dist = Math.hypot(c.x + COIN_SIZE/2 - playerPx, c.y + COIN_SIZE/2 - playerPy)
        if (dist < PLAYER_SIZE * 0.5) {
          playCoinSfx()
          const res = collectCoin(c.value)
          if (res.banned) {
            setHackDetected(true)
            finishRun(Math.floor(distanceRef.current / 10), collectedRef.current)
            return
          }
          collectedRef.current = Math.min(MAX_COINS_PER_RUN, collectedRef.current + c.value)
          setFloatCoins(prev => [...prev, { id: c.id, x: c.x, y: c.y, v: c.value }])
          setTimeout(() => setFloatCoins(prev => prev.filter(f => f.id !== c.id)), 450)
          coinsRef.current = coinsRef.current.filter(co => co.id !== c.id)

          // Frenzy check
          const now3 = Date.now()
          coinCollectTimesRef.current = coinCollectTimesRef.current.filter(t => now3 - t < FRENZY_TIME_WINDOW)
          coinCollectTimesRef.current.push(now3)
          if (coinCollectTimesRef.current.length >= FRENZY_COIN_THRESHOLD && !frenzyRef.current) {
            frenzyRef.current = true
            setFrenzyMode(true)
            coinCollectTimesRef.current = []
            setTimeout(() => { frenzyRef.current = false; setFrenzyMode(false) }, FRENZY_DURATION)
          }
        }
      }

      // Colision proyectil enemigo - jugador (no en fever)
      if (!feverRef.current) {
        for (const ep of enemyProjectilesRef.current) {
          const dist = Math.hypot(ep.x - playerPx, ep.y - playerPy)
          if (dist < PLAYER_SIZE * 0.32) {
            enemyProjectilesRef.current = enemyProjectilesRef.current.filter(p => p.id !== ep.id)
            if (shieldActive && !shieldUsedRef.current) {
              shieldUsedRef.current = true
              consumePowerup("shield")
              setShieldActive(false)
              playExplosionSfx()
              spawnParticles(playerPx, playerPy, "hsl(190, 90%, 50%)", 5)
            } else {
              healthRef.current -= DAMAGE_ENEMY
              setHealth(healthRef.current)
              playHitSfx()
              spawnParticles(playerPx, playerPy, "hsl(0, 84%, 60%)", 4)
              if (healthRef.current <= 0) {
                finishRun(Math.floor(distanceRef.current / 10), collectedRef.current)
                return
              }
            }
          }
        }

        // Colision jugador - enemigo
        for (const e of enemiesRef.current) {
          const dist = Math.hypot(e.x + e.width/2 - playerPx, e.y + e.height/2 - playerPy)
          if (dist < (e.width + PLAYER_SIZE) * 0.28) {
            if (shieldActive && !shieldUsedRef.current) {
              shieldUsedRef.current = true
              consumePowerup("shield")
              setShieldActive(false)
              playExplosionSfx()
              spawnParticles(e.x + e.width/2, e.y + e.height/2, "hsl(190, 90%, 50%)", 6)
              enemiesRef.current = enemiesRef.current.filter(en => en.id !== e.id)
            } else {
              const dmg = e.type === "boss" ? DAMAGE_BOSS : e.type === "miniBoss" ? DAMAGE_ENEMY * 1.5 : e.type === "enemyShip" ? DAMAGE_ENEMY : DAMAGE_METEOR
              healthRef.current -= dmg
              setHealth(healthRef.current)
              playHitSfx()
              spawnParticles(playerPx, playerPy, "hsl(0, 84%, 60%)", 5)
              enemiesRef.current = enemiesRef.current.filter(en => en.id !== e.id)
              if (healthRef.current <= 0) {
                finishRun(Math.floor(distanceRef.current / 10), collectedRef.current)
                return
              }
            }
          }
        }
      }

      // Particulas
      for (const p of particlesRef.current) {
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.life -= dt
      }
      particlesRef.current = particlesRef.current.filter(p => p.life > 0)

      setScore(Math.floor(distanceRef.current / 10))
      setCoinsThisRun(collectedRef.current)
      renderTick()
    }

    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [phase, gameWidth, gameHeight, finishRun, renderTick, spawnParticles, shipConfig, state.profile?.firstName, shieldActive, bossDefeated, shipEvolution, hasDrone])

  // Revivir
  const handleRevive = useCallback((power: RevivePower) => {
    if (!reviveAvailableRef.current) return

    if (state.isVip || power) {
      reviveAvailableRef.current = false
      setReviveAvailable(false)
      healthRef.current = MAX_HEALTH
      setHealth(MAX_HEALTH)

      if (power === "doubleProgress") {
        collectedRef.current = Math.min(MAX_COINS_PER_RUN, collectedRef.current * 2)
        setCoinsThisRun(collectedRef.current)
      } else if (power === "double") {
        fireRateRef.current = 2
        setFireRateMultiplier(2)
      } else if (power === "triple") {
        fireRateRef.current = 3
        setFireRateMultiplier(3)
      }

      notifyRevive()
      enemiesRef.current = []
      enemyProjectilesRef.current = []
      setPhase("playing")
    } else {
      setReviveAdActive(true)
      setReviveCountdown(5)
      setRevivePower("double")
    }
  }, [state.isVip])

  useEffect(() => {
    if (!reviveAdActive) return
    if (reviveCountdown <= 0) {
      setReviveAdActive(false)
      reviveAvailableRef.current = false
      setReviveAvailable(false)
      healthRef.current = MAX_HEALTH
      setHealth(MAX_HEALTH)
      if (revivePower) {
        fireRateRef.current = revivePower === "triple" ? 3 : 2
        setFireRateMultiplier(revivePower === "triple" ? 3 : 2)
      }
      notifyRevive()
      enemiesRef.current = []
      enemyProjectilesRef.current = []
      setPhase("playing")
      return
    }
    const t = window.setTimeout(() => setReviveCountdown(c => c - 1), 1000)
    return () => window.clearTimeout(t)
  }, [reviveAdActive, reviveCountdown, revivePower])

  function toggleMute() {
    const next = setMuted(!isMuted())
    setMutedState(next)
    if (!next && phase === "playing") setScene("game")
  }

  const playerPx = playerXRef.current * gameWidth
  const playerPy = playerYRef.current * gameHeight
  const healthPercent = Math.max(0, health)

  // Colores por evolucion
  const evolutionColors = [
    { primary: "hsl(190, 90%, 55%)", secondary: "hsl(190, 70%, 35%)", glow: "hsl(190, 90%, 50%)" },
    { primary: "hsl(150, 80%, 50%)", secondary: "hsl(150, 60%, 30%)", glow: "hsl(150, 80%, 45%)" },
    { primary: "hsl(45, 100%, 55%)", secondary: "hsl(45, 100%, 35%)", glow: "hsl(45, 100%, 50%)" },
    { primary: "hsl(330, 90%, 55%)", secondary: "hsl(330, 70%, 35%)", glow: "hsl(330, 90%, 50%)" },
  ]
  const evo = evolutionColors[shipEvolution]

  return (
    <div ref={containerRef} className="relative flex items-center justify-center min-h-screen bg-background">
      {/* Arcade Container for PC */}
      <div
        className="relative overflow-hidden"
        style={{ width: gameWidth, height: gameHeight,
          background: "radial-gradient(ellipse at 50% 0%, oklch(0.10 0.03 264), oklch(0.05 0.02 264))",
          boxShadow: gameWidth < 500 ? "none" : "0 0 40px rgba(0,0,0,0.6), inset 0 0 80px rgba(0,0,0,0.3)",
          borderRadius: gameWidth < 500 ? 0 : 16,
          border: gameWidth < 500 ? "none" : "2px solid oklch(0.20 0.03 264)",
        }}
      >
        {/* Header */}
        <header className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between p-1.5 bg-gradient-to-b from-background/95 to-transparent">
          <Button variant="ghost" size="icon" onClick={handleExit} className="size-7 bg-background/50 shrink-0">
            <ArrowLeft className="size-3.5" />
          </Button>

          <div className="flex items-center gap-1 bg-background/80 rounded-full px-1.5 py-0.5">
            <span className="text-[10px] font-bold text-primary">{formatNumber(score)}</span>
            <span className="text-muted-foreground text-[10px]">|</span>
            <span className="flex items-center gap-0.5 text-[10px] font-bold text-accent">
              <Coins className="size-2.5" /> {coinsThisRun}
            </span>
            {fireRateMultiplier > 1 && <span className="text-[9px] font-bold text-yellow-400">x{fireRateMultiplier}</span>}
            {tripleShot && <span className="text-[9px] font-bold text-green-400">3x</span>}
            {feverMode && <span className="text-[9px] font-bold text-orange-400 animate-pulse">FIEBRE</span>}
          </div>

          <div className="flex items-center gap-1 rounded bg-accent/20 border border-accent/40 px-1.5 py-0.5">
            <Trophy className="size-2.5 text-accent" />
            <span className="text-[10px] font-bold text-accent">{formatNumber(previousScoreRef.current)}</span>
          </div>

          <Button variant="ghost" size="icon" onClick={toggleMute} className="size-7 bg-background/50 shrink-0">
            {isMuted() ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </Button>
        </header>

        {/* Record notification */}
        {recordNotification && (
          <div className="absolute top-9 left-1/2 -translate-x-1/2 z-40 animate-bounce">
            <div className="flex items-center gap-1 rounded-lg bg-accent/90 px-2 py-0.5 text-[10px] font-bold text-accent-foreground shadow-glow-gold">
              <Star className="size-2.5" fill="currentColor" />
              <span>{recordNotification}</span>
            </div>
          </div>
        )}

        {/* Combo */}
        {comboDisplay > 1 && (
          <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40">
            <div className="text-lg font-black text-yellow-400 animate-pulse drop-shadow-lg">x{comboDisplay}</div>
          </div>
        )}

        {/* Health */}
        {(phase === "playing" || phase === "fever") && (
          <div className="absolute top-11 left-1/2 -translate-x-1/2 z-30 w-[40vw] max-w-[140px]">
            <div className="flex items-center gap-0.5">
              <Heart className={`size-2.5 ${healthPercent > 30 ? "text-primary" : "text-destructive animate-pulse"}`} />
              <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                <div className="h-full transition-all duration-150 rounded-full" style={{
                  width: `${healthPercent}%`,
                  background: healthPercent > 60 ? "linear-gradient(90deg, hsl(190, 90%, 50%), hsl(150, 70%, 50%))"
                    : healthPercent > 30 ? "linear-gradient(90deg, hsl(45, 100%, 55%), hsl(30, 90%, 50%))"
                    : "linear-gradient(90deg, hsl(0, 84%, 60%), hsl(330, 90%, 50%))",
                }} />
              </div>
              <span className="text-[8px] font-bold text-muted-foreground">{healthPercent}%</span>
            </div>
          </div>
        )}

        {/* Shield */}
        {shieldActive && (phase === "playing" || phase === "fever") && (
          <div className="absolute top-15 left-1.5 z-30">
            <div className="flex items-center gap-0.5 rounded-full border border-primary/60 bg-primary/20 px-1 py-0.5 text-[8px] font-bold text-primary backdrop-blur">
              <Shield className="size-2.5" />
            </div>
          </div>
        )}

        {/* Game Canvas */}
        <div
          className="w-full h-full relative overflow-hidden"
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => handlePointerMove(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())}
          onPointerUp={(e) => handlePointerMove(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect())}
        >
          {/* Stars */}
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white"
              style={{ left: `${(i * 43) % 100}%`, top: `${(i * 29) % 100}%`, width: 1, height: 1, opacity: 0.12 }} />
          ))}

          {/* Particles */}
          {particlesRef.current.map(p => (
            <div key={p.id} className="absolute rounded-full"
              style={{ left: p.x, top: p.y, width: p.size, height: p.size, background: p.color, opacity: p.life / p.maxLife }} />
          ))}

          {/* Projectiles */}
          {projectilesRef.current.map(p => (
            <div key={p.id} className="absolute"
              style={{ left: p.x - PROJECTILE_SIZE/2, top: p.y, width: PROJECTILE_SIZE, height: PROJECTILE_SIZE * 2,
                background: p.isDrone ? "linear-gradient(180deg, hsl(280, 70%, 55%), hsl(280, 70%, 35%))" : "linear-gradient(180deg, hsl(190, 90%, 60%), hsl(190, 90%, 40%))",
                borderRadius: 2, boxShadow: p.isDrone ? "0 0 4px hsl(280, 70%, 50%)" : "0 0 4px hsl(190, 90%, 50%)" }} />
          ))}

          {/* Enemy projectiles */}
          {enemyProjectilesRef.current.map(ep => (
            <div key={ep.id} className="absolute"
              style={{ left: ep.x - 2, top: ep.y, width: 4, height: 7,
                background: "linear-gradient(180deg, hsl(330, 90%, 50%), hsl(330, 90%, 30%))", borderRadius: 2, boxShadow: "0 0 4px hsl(330, 90%, 50%)" }} />
          ))}

          {/* Enemies */}
          {enemiesRef.current.map(e => (
            <div key={e.id} className="absolute" style={{ left: e.x, top: e.y, width: e.width, height: e.height }}>
              {e.type === "meteor" ? (
                <div className="w-full h-full"
                  style={{ background: "radial-gradient(circle at 35% 35%, oklch(0.45 0.03 60), oklch(0.25 0.02 30))", borderRadius: "40% 60% 50% 50%", transform: `rotate(${e.rotation}deg)` }} />
              ) : e.type === "enemyShip" ? (
                <div className="w-full h-full relative" style={{ transform: "rotate(180deg)" }}>
                  <div className="absolute inset-0" style={{ background: "hsl(330, 90%, 40%)", clipPath: "polygon(50% 0%, 100% 70%, 80% 100%, 20% 100%, 0% 70%)", boxShadow: "0 0 5px hsl(330, 90%, 50%)" }} />
                </div>
              ) : e.type === "miniBoss" ? (
                <div className="w-full h-full relative" style={{ transform: "rotate(180deg)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(280, 70%, 50%), hsl(280, 70%, 30%))", clipPath: "polygon(50% 0%, 90% 30%, 100% 100%, 50% 80%, 0% 100%, 10% 30%)", boxShadow: "0 0 8px hsl(280, 70%, 50%)" }} />
                  <div className="absolute -top-1 left-0 right-0 h-1 rounded bg-border">
                    <div className="h-full rounded bg-purple-400" style={{ width: `${(e.health / e.maxHealth) * 100}%` }} />
                  </div>
                </div>
              ) : (
                <div className="w-full h-full relative" style={{ transform: "rotate(180deg)" }}>
                  <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(45, 100%, 50%), hsl(45, 100%, 35%))", clipPath: "polygon(50% 0%, 100% 20%, 90% 100%, 50% 85%, 10% 100%, 0% 20%)", boxShadow: "0 0 10px hsl(45, 100%, 50%)" }} />
                  <div className="absolute -top-1.5 left-0 right-0 h-1.5 rounded bg-border">
                    <div className="h-full rounded bg-yellow-400" style={{ width: `${(e.health / e.maxHealth) * 100}%` }} />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Supply crates */}
          {supplyCratesRef.current.map(sc => (
            <div key={sc.id} className="absolute flex items-center justify-center" style={{ left: sc.x, top: sc.y, width: 16, height: 16 }}>
              <div className="w-full h-full rounded"
                style={{
                  background: sc.type === "tripleShot" ? "hsl(120, 60%, 40%)" : sc.type === "turbo" ? "hsl(200, 70%, 45%)" : sc.type === "shield" ? "hsl(190, 80%, 45%)" : "hsl(280, 60%, 45%)",
                  boxShadow: `0 0 5px ${sc.type === "tripleShot" ? "hsl(120, 60%, 50%)" : sc.type === "turbo" ? "hsl(200, 70%, 50%)" : sc.type === "shield" ? "hsl(190, 80%, 50%)" : "hsl(280, 60%, 50%)"}`,
                }}>
                <span className="text-white text-[7px] font-black">
                  {sc.type === "tripleShot" ? "3" : sc.type === "turbo" ? "T" : sc.type === "shield" ? "S" : "D"}
                </span>
              </div>
            </div>
          ))}

          {/* Coins */}
          {coinsRef.current.map(c => (
            <div key={c.id} className="absolute flex items-center justify-center" style={{ left: c.x, top: c.y, width: COIN_SIZE, height: COIN_SIZE }}>
              <div className="w-full h-full rounded-full"
                style={{ background: "radial-gradient(circle at 35% 35%, hsl(45, 100%, 70%), hsl(45, 100%, 45%))", boxShadow: "0 0 4px hsl(45, 100%, 50%)" }} />
            </div>
          ))}

          {/* Float coins */}
          {floatCoins.map(f => (
            <div key={f.id} className="absolute animate-coin-float font-bold text-accent text-[9px]" style={{ left: f.x, top: f.y }}>+{f.v}</div>
          ))}

          {/* Drone trails */}
          {dronesRef.current.map(d => d.trail.map((t, i) => (
            <div key={`${d.id}-${i}`} className="absolute rounded-full"
              style={{ left: t.x - 2, top: t.y - 2, width: 4, height: 4, background: "hsl(280, 70%, 60%)", opacity: t.life * 3 }} />
          )))}

          {/* Drones */}
          {dronesRef.current.map(d => {
            const dx = playerPx + d.offsetX
            const dy = playerPy + d.offsetY
            return (
              <div key={d.id}
                className="absolute"
                style={{
                  left: dx - 5,
                  top: dy - 5,
                  width: 10,
                  height: 10,
                  background: "hsl(280, 70%, 50%)",
                  clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)",
                  boxShadow: "0 0 6px hsl(280, 70%, 55%)",
                  transform: `rotate(${d.spinAngle}deg)`,
                }}
              />
            )
          })}

          {/* Player */}
          <div className="absolute" style={{ left: playerPx - PLAYER_SIZE/2, top: playerPy - PLAYER_SIZE/2, width: PLAYER_SIZE, height: PLAYER_SIZE }}>
            <div className="relative w-full h-full" style={{ filter: frenzyMode || feverMode ? "drop-shadow(0 0 8px hsl(30, 90%, 50%))" : feverMode ? `drop-shadow(0 0 12px ${evo.glow})` : undefined }}>
              <div className="absolute inset-0"
                style={{
                  background: frenzyMode ? "linear-gradient(180deg, hsl(30, 90%, 55%), hsl(30, 70%, 35%))"
                    : turboMode ? "linear-gradient(180deg, hsl(200, 90%, 55%), hsl(200, 70%, 35%))"
                    : tripleShot ? "linear-gradient(180deg, hsl(120, 60%, 50%), hsl(120, 60%, 30%))"
                    : feverMode ? `linear-gradient(180deg, ${evo.primary}, ${evo.secondary})`
                    : `linear-gradient(180deg, ${evo.primary}, ${evo.secondary})`,
                  clipPath: "polygon(50% 0%, 85% 25%, 100% 100%, 50% 75%, 0% 100%, 15% 25%)",
                  boxShadow: `0 0 ${shieldActive || shipEvolution >= 2 ? "8px" : "4px"} ${frenzyMode ? "hsl(30, 90%, 50%)" : evo.glow}`,
                }} />
              <div className="absolute" style={{ left: "35%", top: "15%", width: "30%", height: "20%", background: "hsl(200, 90%, 80%)", clipPath: "polygon(50% 0%, 100% 100%, 0% 100%)" }} />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2"
                style={{ width: "35%", height: "25%", background: "linear-gradient(180deg, hsl(45, 100%, 60%), transparent)", borderRadius: "0 0 50% 50%", animation: "flicker 0.1s infinite alternate" }} />
            </div>
            {shieldActive && <div className="absolute -inset-1.5 rounded-full border border-primary/60" style={{ boxShadow: "0 0 10px hsl(190, 90%, 50%, 35%)", animation: "pulse 1s infinite" }} />}
          </div>

          {/* Overlays */}
          {phase === "ready" && (
            <Overlay>
              <div className="mb-1">
                <div className="mx-auto" style={{ width: 32, height: 32, background: `linear-gradient(180deg, ${evo.primary}, ${evo.secondary})`, clipPath: "polygon(50% 0%, 85% 25%, 100% 100%, 50% 75%, 0% 100%, 15% 25%)", boxShadow: `0 0 10px ${evo.glow}` }} />
              </div>
              <h2 className="text-sm font-black text-glow-primary">GarrDash</h2>
              <p className="text-[8px] text-muted-foreground max-w-[130px] text-center mb-1">Movimiento libre. Drones. Jefes cada 120s.</p>
              <Button onClick={startGame} size="lg" className="gap-1.5 text-[11px] font-bold shadow-glow-primary px-6 h-9"><Play className="size-3.5" /> JUGAR</Button>
            </Overlay>
          )}

          {phase === "over" && (
            <Overlay shake>
              {hackDetected ? (
                <div className="text-center">
                  <div className="text-xl text-destructive mb-0.5">X</div>
                  <h2 className="text-sm font-black text-destructive">ANTIHACK</h2>
                  <Button onClick={handleExit} size="lg" variant="secondary" className="gap-1.5 text-[10px] mt-1.5 h-8"><Home className="size-3.5" /> Menu</Button>
                </div>
              ) : (
                <>
                  <div className="text-lg text-destructive mb-0.5">X</div>
                  <h2 className="text-xs font-black text-destructive mb-1">Game Over</h2>
                  <div className="grid grid-cols-3 gap-1 text-center mb-1">
                    <Stat label="Pts" value={formatNumber(score)} />
                    <Stat label="Monedas" value={`${coinsThisRun}`} accent />
                    <Stat label="Boss" value={bossDefeated.toString()} />
                  </div>
                  {reviveAvailable && (
                    <div className="flex flex-col gap-0.5 mb-1">
                      {coinsThisRun <= 30 ? (
                        <Button onClick={() => handleRevive("doubleProgress")} size="lg" className="gap-1.5 text-[10px] bg-accent hover:bg-accent/80 h-8"><TrendingUp className="size-3.5" /> Duplicar ({coinsThisRun * 2})</Button>
                      ) : (
                        <>
                          <Button onClick={() => handleRevive("double")} size="lg" variant="secondary" className="gap-1.5 text-[10px] h-8"><Zap className="size-3.5" /> Disparo x2</Button>
                          <Button onClick={() => handleRevive("triple")} size="lg" className="gap-1.5 text-[10px] bg-neon-pink hover:bg-neon-pink/80 h-8"><Zap className="size-3.5" /> Disparo x3</Button>
                        </>
                      )}
                    </div>
                  )}
                  <div className="flex gap-1">
                    <Button onClick={startGame} size="lg" variant="secondary" className="gap-1.5 text-[10px] h-8"><RotateCcw className="size-3.5" /> Reintentar</Button>
                    <Button onClick={handleExit} size="lg" variant="secondary" className="gap-1.5 text-[10px] h-8"><Home className="size-3.5" /> Menu</Button>
                  </div>
                </>
              )}
            </Overlay>
          )}

          {reviveAdActive && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-1 bg-black/95">
              <Video className="size-4 animate-pulse text-foreground" />
              <p className="font-bold text-foreground text-xs">Anuncio...</p>
              <span className="font-mono text-lg font-black text-accent">{reviveCountdown}</span>
            </div>
          )}
        </div>
      </div>

      {/* AdMob */}
      {!state.isVip && <div className="fixed bottom-0 left-0 right-0 z-40"><AdMobBanner variant="fixed-bottom" /></div>}
    </div>
  )
}

function Overlay({ children, shake }: { children: React.ReactNode; shake?: boolean }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm">
      <div className={shake ? "animate-shake" : ""}>{children}</div>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded border border-border/60 bg-card/80 px-0.5 py-0.5">
      <p className="text-[6px] uppercase text-muted-foreground">{label}</p>
      <p className={`text-[9px] font-black ${accent ? "text-accent" : ""}`}>{value}</p>
    </div>
  )
}
