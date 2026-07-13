"use client"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useGameStore, formatNumber } from "@/lib/use-game-store"
import {
  Play, Store, Trophy, Gift, Crown, Coins, Target, Shield,
  Volume2, VolumeX, Lock, Plane, Star, TrendingUp, Zap, Hammer,
} from "lucide-react"
import { AdMobBanner } from "@/components/admob-banner"
import { PrivacyDialog } from "@/components/privacy-dialog"
import { ShipSelectDialog } from "@/components/ship-select-dialog"
import { PetsDialog } from "@/components/pets-dialog"
import { useState, useEffect, useRef, useCallback } from "react"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog"
import { isMuted, setMuted, playButtonSfx, unlockAudio, setScene } from "@/lib/audio"
import { setMutedState, GLOBAL_LEADERBOARD_SEED } from "@/lib/store"
import { SHIPS } from "@/lib/types"

// Animated preview canvas
function AnimatedPreview() {
  const canvasRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const shipXRef = useRef(0.5)
  const meteorYRef = useRef(0)
  const projectileYRef = useRef(-100)
  const particleRef = useRef<{ x: number; y: number; life: number }[]>([])
  const [, render] = useState(0)

  useEffect(() => {
    let raf: number
    let lastTime = 0
    let projectileActive = false
    let shooting = true

    function animate(ts: number) {
      raf = requestAnimationFrame(animate)
      const dt = Math.min(0.033, (ts - lastTime) / 1000)
      lastTime = ts
      if (!Number.isFinite(dt) || dt <= 0) return

      frameRef.current++

      // Movimiento del avion (oscilacion)
      shipXRef.current = 0.5 + Math.sin(ts * 0.0015) * 0.25

      // Disparo automatico cada ~800ms
      if (!projectileActive && shooting) {
        projectileYRef.current = 55
        projectileActive = true
      }

      // Proyectil sube
      if (projectileActive) {
        projectileYRef.current -= 180 * dt
        if (projectileYRef.current < 30) {
          projectileActive = false
          projectileYRef.current = -100
        }
      }

      // Meteorito baja
      meteorYRef.current += 25 * dt
      if (meteorYRef.current > 100) {
        meteorYRef.current = -10
      }

      // Colision proyectil-meteorito (simulada cada ~2s)
      if (frameRef.current % 120 === 0 && projectileActive) {
        // Spawn particulas
        particleRef.current = [
          { x: 50 + Math.random() * 10, y: meteorYRef.current, life: 0.5 },
          { x: 50 - Math.random() * 10, y: meteorYRef.current, life: 0.5 },
          { x: 50, y: meteorYRef.current - 5, life: 0.5 },
        ]
        meteorYRef.current = -15 // Reset meteorito
        projectileActive = false
        projectileYRef.current = -100
      }

      // Actualizar particulas
      particleRef.current = particleRef.current.filter(p => {
        p.life -= dt
        p.y -= 30 * dt
        return p.life > 0
      })

      render(n => n + 1)
    }

    raf = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(raf)
  }, [])

  const shipX = shipXRef.current * 100
  const meteorY = meteorYRef.current
  const projectileY = projectileYRef.current
  const particles = particleRef.current

  return (
    <div
      ref={canvasRef}
      className="absolute inset-0 overflow-hidden rounded-lg opacity-60"
      style={{ background: "radial-gradient(ellipse at 50% 0%, oklch(0.12 0.03 264), oklch(0.06 0.02 264))" }}
    >
      {/* Stars */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute rounded-full bg-white"
          style={{
            left: `${(i * 37) % 100}%`,
            top: `${(i * 31) % 100}%`,
            width: '1px',
            height: '1px',
            opacity: 0.3,
          }}
        />
      ))}

      {/* Ship */}
      <div
        className="absolute"
        style={{
          left: `${shipX}%`,
          bottom: '8%',
          width: 18,
          height: 18,
          transform: 'translateX(-50%)',
        }}
      >
        <div
          className="w-full h-full"
          style={{
            background: 'linear-gradient(180deg, hsl(190, 90%, 55%), hsl(190, 70%, 35%))',
            clipPath: 'polygon(50% 0%, 85% 25%, 100% 100%, 50% 75%, 0% 100%, 15% 25%)',
            boxShadow: '0 0 6px hsl(190, 90%, 50%)',
          }}
        />
      </div>

      {/* Projectile */}
      <div
        className="absolute"
        style={{
          left: `${shipX}%`,
          top: `${projectileY}%`,
          width: 3,
          height: 12,
          transform: 'translateX(-50%)',
          background: 'linear-gradient(180deg, hsl(190, 90%, 60%), hsl(190, 90%, 40%))',
          borderRadius: 2,
          boxShadow: '0 0 4px hsl(190, 90%, 50%)',
        }}
      />

      {/* Meteor */}
      <div
        className="absolute"
        style={{
          left: '50%',
          top: `${meteorY}%`,
          width: 14,
          height: 14,
          transform: 'translateX(-50%) rotate(45deg)',
          background: 'radial-gradient(circle at 35% 35%, oklch(0.48 0.03 60), oklch(0.26 0.02 30))',
          borderRadius: '40% 60% 50% 50%',
          boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.5)',
        }}
      />

      {/* Particles */}
      {particles.map((p, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: 4,
            height: 4,
            background: 'hsl(45, 100%, 60%)',
            opacity: p.life,
          }}
        />
      ))}
    </div>
  )
}

export function MainMenu({
  onPlay,
  onOpenShop,
  onOpenRecords,
  onOpenWheel,
  onOpenVip,
}: {
  onPlay: () => void
  onOpenShop: () => void
  onOpenRecords: () => void
  onOpenWheel: () => void
  onOpenVip: () => void
}) {
  const state = useGameStore()
  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [privacyFullOpen, setPrivacyFullOpen] = useState(false)
  const [shipSelectOpen, setShipSelectOpen] = useState(false)
  const [petsOpen, setPetsOpen] = useState(false)

  const playerBestScore = state.gameStats.bestScore
  const top1Score = Math.max(playerBestScore, ...GLOBAL_LEADERBOARD_SEED.map(p => p.score))
  const isTop1 = playerBestScore >= top1Score && playerBestScore > 0

  const allScores = [...GLOBAL_LEADERBOARD_SEED.map(p => p.score), playerBestScore].sort((a, b) => b - a)
  const playerPosition = allScores.indexOf(playerBestScore) + 1

  useEffect(() => {
    unlockAudio()
    setScene("menu")
  }, [])

  function toggleMute() {
    unlockAudio()
    const next = setMuted(!isMuted())
    setMutedState(next)
    if (!next) setScene("menu")
  }

  const selectedShip = SHIPS.find(s => s.id === state.selectedShip) ?? SHIPS[0]

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-background pb-[48px]">
      {/* Background */}
      <div className="absolute inset-0 bg-grid opacity-15" />
      <div className="absolute inset-0 animate-grid-drift bg-grid opacity-15" />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between p-2.5">
        <h1 className="text-xl font-black tracking-tight">
          <span className="text-glow-primary">Garr</span>
          <span className="text-accent text-glow-gold">Dash</span>
        </h1>

        <div className="flex items-center gap-1">
          <div className="flex items-center gap-0.5 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
            <Coins className="size-3.5 text-accent" />
            <span className="text-xs font-bold text-accent">{formatNumber(state.coins)}</span>
          </div>
          <div className="flex items-center gap-0.5 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5">
            <Target className="size-3.5 text-primary" />
            <span className="text-xs font-bold text-primary">{state.goalPoints}</span>
          </div>
          {state.isVip && (
            <Badge className="gap-0.5 bg-accent text-accent-foreground shadow-glow-gold text-[10px] px-1.5">
              <Crown className="size-3" /> VIP
            </Badge>
          )}
        </div>

        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={toggleMute} className="size-8">
            {isMuted() ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setPrivacyOpen(true)} className="size-8">
            <Lock className="size-4" />
          </Button>
        </div>
      </header>

      {/* Top #1 Golden Card */}
      <div className="relative z-10 px-2.5 pb-1.5">
        <Card
          className={`flex items-center justify-between gap-2 p-2 ${
            isTop1
              ? "border-accent bg-gradient-to-r from-accent/15 to-yellow-500/15 shadow-glow-gold"
              : "border-border/60 bg-card/70"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex size-9 items-center justify-center rounded-full ${
              isTop1 ? "bg-accent/25" : "bg-primary/15"
            }`}>
              <Trophy className={`size-4 ${isTop1 ? "text-accent" : "text-primary"}`} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground">Tu record</p>
              <p className="text-sm font-bold text-foreground">
                {state.profile?.firstName}: <span className={isTop1 ? "text-accent" : "text-primary"}>{formatNumber(playerBestScore)}</span>
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end">
            {isTop1 ? (
              <Badge className="gap-0.5 bg-accent text-accent-foreground shadow-glow-gold animate-pulse text-[9px] px-1.5">
                <Star className="size-3" fill="currentColor" /> TOP #1
              </Badge>
            ) : playerBestScore > 0 ? (
              <Badge variant="outline" className="border-primary/50 text-primary text-[9px]">
                <TrendingUp className="size-3 mr-0.5" /> #{playerPosition}
              </Badge>
            ) : null}
          </div>
        </Card>
      </div>

      {/* Animated Preview + Play Button */}
      <div className="relative z-10 px-2.5 mb-2">
        <div className="relative h-36 rounded-xl border border-border/60 overflow-hidden">
          <AnimatedPreview />
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/40 backdrop-blur-[2px]">
            <Button
              onClick={() => { unlockAudio(); playButtonSfx(); onPlay() }}
              size="lg"
              className="h-12 gap-2 text-base font-black shadow-glow-primary px-8"
            >
              <Play className="size-5" />
              JUGAR
            </Button>
          </div>
        </div>
      </div>

      {/* Player card */}
      <div className="relative z-10 px-2.5 pb-1.5">
        <Card className="flex items-center justify-between gap-2 border-border/60 bg-card/70 p-2">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-full bg-primary/15">
              <Plane className="size-4 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">{state.profile?.firstName}</p>
              <p className="text-[10px] text-muted-foreground">
                {state.profile?.age} - {state.profile?.nationality}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { unlockAudio(); playButtonSfx(); setShipSelectOpen(true) }}
            className="gap-1 text-[10px] h-7"
          >
            {selectedShip.emoji} {selectedShip.name}
          </Button>
        </Card>
      </div>

      {/* Actions Grid */}
      <main className="relative z-10 flex flex-1 flex-col gap-2 px-2.5 pb-14">
        <div className="grid grid-cols-2 gap-2">
          <MenuTile
            label="Tienda"
            description="Diamantes FF"
            icon={<Store className="size-4" />}
            accent="primary"
            onClick={() => { unlockAudio(); playButtonSfx(); onOpenShop() }}
          />
          <MenuTile
            label="Records"
            description="Top global"
            icon={<Trophy className="size-4" />}
            accent="gold"
            onClick={() => { unlockAudio(); playButtonSfx(); onOpenRecords() }}
          />
          <MenuTile
            label="Mascotas"
            description="Drones de apoyo"
            icon={<Zap className="size-4" />}
            accent="pink"
            onClick={() => { unlockAudio(); playButtonSfx(); setPetsOpen(true) }}
          />
          <MenuTile
            label="Ruleta"
            description="Giro gratis"
            icon={<Gift className="size-4" />}
            accent="primary"
            onClick={() => { unlockAudio(); playButtonSfx(); onOpenWheel() }}
          />
        </div>
        <div className="flex justify-center mt-1">
          <MenuTile
            label="VIP"
            description="Beneficios exclusivos"
            icon={<Crown className="size-4" />}
            accent="gold"
            onClick={() => { unlockAudio(); playButtonSfx(); onOpenVip() }}
            fullWidth
          />
        </div>
      </main>

      {/* AdMob Banner */}
      {!state.isVip && <AdMobBanner variant="fixed-bottom" />}

      {/* Dialogs */}
      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Shield className="size-5" /> Privacidad
            </DialogTitle>
            <DialogDescription>Como usamos tus datos en GarrDash.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 text-sm text-muted-foreground">
            <p>Tus datos se usan unicamente para el <strong className="text-primary">Top Global</strong> y entrega de premios.</p>
            <p>No compartimos tu informacion.</p>
          </div>
          <Button onClick={() => { setPrivacyOpen(false); setPrivacyFullOpen(true) }} className="gap-2 bg-primary font-bold">
            <Shield className="size-4" /> Ver politica
          </Button>
        </DialogContent>
      </Dialog>

      <PrivacyDialog open={privacyFullOpen} onOpenChange={setPrivacyFullOpen} />
      <ShipSelectDialog open={shipSelectOpen} onOpenChange={setShipSelectOpen} />
      <PetsDialog open={petsOpen} onOpenChange={setPetsOpen} />
    </div>
  )
}

function MenuTile({
  label,
  description,
  icon,
  accent,
  onClick,
  fullWidth,
}: {
  label: string
  description: string
  icon: React.ReactNode
  accent: "primary" | "gold" | "pink"
  onClick: () => void
  fullWidth?: boolean
}) {
  const accentClass =
    accent === "primary"
      ? "text-primary border-primary/35"
      : accent === "gold"
      ? "text-accent border-accent/35"
      : "text-neon-pink border-neon-pink/35"
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-start gap-1 rounded-lg border bg-card/60 p-2.5 text-left backdrop-blur transition-transform hover:scale-[1.02] active:scale-95 ${accentClass} ${fullWidth ? 'w-full' : ''}`}
    >
      {icon}
      <span className="text-xs font-bold text-foreground">{label}</span>
      <span className="text-[9px] text-muted-foreground">{description}</span>
    </button>
  )
}
