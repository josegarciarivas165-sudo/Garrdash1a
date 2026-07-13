"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useGameStore, formatNumber } from "@/lib/use-game-store"
import {
  DIAMOND_PACKS,
  GOAL_POINT_COST_IN_COINS,
  buyGoalPoint,
  redeemDiamonds,
  setExchangeStatus,
} from "@/lib/store"
import { setExchangePending as setPendingFirebase } from "@/lib/firebase-auth"
import type { DiamondPack } from "@/lib/types"
import { toast } from "sonner"
import {
  Coins,
  Gem,
  Target,
  Plus,
  Mail,
  Crown,
  Gift,
  Zap,
  Lock,
} from "lucide-react"
import { OfferwallDialog } from "@/components/offerwall-dialog"
import { PowerupsDialog } from "@/components/powerups-dialog"
import { playButtonSfx } from "@/lib/audio"

export function ShopDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const state = useGameStore()
  const [selected, setSelected] = useState<DiamondPack | null>(null)
  const [freeFireId, setFreeFireId] = useState("")
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [offerwallOpen, setOfferwallOpen] = useState(false)
  const [powerupsOpen, setPowerupsOpen] = useState(false)

  // Candado anti-spam: si exchangeStatus !== 'ninguno', botones grises.
  const locked = state.exchangeStatus !== "ninguno"

  function handleBuyGoalPoint() {
    playButtonSfx()
    const result = buyGoalPoint()
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    toast.success(`+1 Punto de Canje (-${formatNumber(GOAL_POINT_COST_IN_COINS)} monedas).`)
  }

  function openClaim(pack: DiamondPack) {
    if (locked) return
    if (state.goalPoints < pack.goalPointCost) {
      toast.error(`Necesitas ${pack.goalPointCost} Puntos de Canje para ${pack.name}.`)
      return
    }
    playButtonSfx()
    setSelected(pack)
    setFreeFireId("")
    setEmail("")
  }

  async function confirmClaim() {
    if (!selected) return
    setSubmitting(true)
    const result = redeemDiamonds(selected, freeFireId, email)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    // Marca en Firebase como 'pendiente' (candado anti-spam).
    if (state.authUid) {
      await setPendingFirebase(state.authUid)
    }
    setExchangeStatus("pendiente")
    // Alerta flotante exacta solicitada.
    toast.success(
      "¡Reclamo recibido con éxito! Te llegarán los diamantes entre 24 y 72 horas. Por favor, espera a que sea aprobado para realizar un nuevo canje.",
      { duration: 6000 },
    )
    setSelected(null)
    setFreeFireId("")
    setEmail("")
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-glow-gold">
              <Gem className="size-5 text-accent" aria-hidden /> Tienda de Recompensas
            </DialogTitle>
            <DialogDescription>
              Compra <strong className="text-primary">Puntos de Canje</strong> con monedas y canjealos
              por diamantes. Se requiere ID de jugador y correo.
            </DialogDescription>
          </DialogHeader>

          {/* Candado anti-spam banner */}
          {locked && (
            <div className="flex items-center gap-2 rounded-xl border border-muted-foreground/40 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              <span>
                Tienes un canje <strong className="text-accent">{state.exchangeStatus}</strong>. Espera la aprobación para reclamar de nuevo.
              </span>
            </div>
          )}

          {/* Balances */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Balance icon={<Coins className="size-4 text-accent" />} label="Monedas" value={formatNumber(state.coins)} accent />
            <Balance icon={<Target className="size-4 text-primary" />} label="Puntos" value={formatNumber(state.goalPoints)} />
            <Balance icon={<Gem className="size-4 text-neon-pink" />} label="Diamantes" value={formatNumber(state.diamonds)} />
          </div>

          {/* Accesos rápidos */}
          <div className="grid grid-cols-2 gap-3">
            <QuickBtn accent="primary" onClick={() => setOfferwallOpen(true)}>
              <Gift className="size-5" aria-hidden /> 🎁 Monedas Gratis
            </QuickBtn>
            <QuickBtn accent="gold" onClick={() => setPowerupsOpen(true)}>
              <Zap className="size-5" aria-hidden /> Poderes del Cubo
            </QuickBtn>
          </div>

          {/* Comprar Puntos de Canje */}
          <div className="rounded-2xl border border-primary/40 bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-primary">Comprimir Puntos de Canje</p>
                <p className="text-xs text-muted-foreground">
                  Intercambia {formatNumber(GOAL_POINT_COST_IN_COINS)} monedas por 1 Punto de Canje.
                </p>
              </div>
              <Button onClick={handleBuyGoalPoint} disabled={locked || state.coins < GOAL_POINT_COST_IN_COINS} className="gap-2 font-bold">
                <Plus className="size-4" aria-hidden /> Comprar
              </Button>
            </div>
          </div>

          {/* Packs de diamantes */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {DIAMOND_PACKS.map((pack) => {
              const affordable = state.goalPoints >= pack.goalPointCost
              return (
                <div
                  key={pack.id}
                  className={`relative flex flex-col items-center gap-1 rounded-2xl border p-4 text-center ${
                    pack.popular
                      ? "border-accent/70 bg-accent/5 shadow-glow-gold"
                      : "border-border/60 bg-card/70"
                  } ${locked ? "opacity-50" : ""}`}
                >
                  {pack.popular && (
                    <Badge className="absolute -top-2 bg-accent text-accent-foreground">Popular</Badge>
                  )}
                  <span className="text-3xl" aria-hidden>💎</span>
                  <span className="text-xl font-black text-primary">{pack.diamonds}</span>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">diamantes</span>
                  <div className="mt-1 flex items-center gap-1 text-xs font-semibold text-accent">
                    <Target className="size-3" aria-hidden /> {pack.goalPointCost} Puntos
                  </div>
                  <Button
                    size="sm"
                    className="mt-2 w-full gap-1 bg-accent font-bold text-accent-foreground hover:bg-accent/90"
                    disabled={locked || !affordable}
                    onClick={() => openClaim(pack)}
                  >
                    {locked ? (
                      <>
                        <Lock className="size-3" aria-hidden /> Bloqueado
                      </>
                    ) : affordable ? (
                      `Reclamar ${pack.diamonds} 💎`
                    ) : (
                      "Puntos insuf."
                    )}
                  </Button>
                </div>
              )
            })}
          </div>

          {state.redemptions.length > 0 && (
            <p className="text-center text-xs text-muted-foreground">
              Tienes {state.redemptions.length} reclamo(s). Mira el estado en la pestaña{" "}
              <strong className="text-accent">Reclamos</strong> del menú Récords.
            </p>
          )}
        </DialogContent>
      </Dialog>

      <OfferwallDialog open={offerwallOpen} onOpenChange={setOfferwallOpen} />
      <PowerupsDialog open={powerupsOpen} onOpenChange={setPowerupsOpen} />

      {/* Modal de reclamo: ID de jugador + Correo */}
      <Dialog open={selected !== null} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gem className="size-5 text-accent" aria-hidden /> Reclamar {selected?.diamonds} Diamantes
            </DialogTitle>
            <DialogDescription>
              Se descontaran <strong className="text-primary">{selected?.goalPointCost} Puntos de Canje</strong>.
              Ingresa tu ID de jugador y un correo de contacto.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ff-id" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                ID de jugador *
              </Label>
              <Input
                id="ff-id"
                inputMode="numeric"
                pattern="[0-9]{6,12}"
                value={freeFireId}
                onChange={(e) => setFreeFireId(e.target.value.replace(/\D/g, ""))}
                placeholder="Ej. 123456789"
                maxLength={12}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ff-email" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Correo electrónico *
              </Label>
              <Input
                id="ff-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tucorreo@ejemplo.com"
                autoComplete="email"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tu reclamo pasará a <span className="font-semibold text-accent">En Revisión</span> (24-72h).
              Al ser aprobado, recibirás una notificación flotante en tiempo real.
            </p>
            {state.isVip && (
              <div className="flex items-center gap-2 rounded-lg border border-accent/50 bg-accent/10 px-3 py-2 text-xs text-accent">
                <Crown className="size-4" aria-hidden /> VIP: tus reclamos tendrán prioridad.
              </div>
            )}
          </div>

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button
              onClick={confirmClaim}
              disabled={submitting || freeFireId.length < 6 || !email.includes("@")}
              className="gap-2 bg-accent font-bold text-accent-foreground hover:bg-accent/90"
            >
              <Mail className="size-4" aria-hidden /> Confirmar reclamo
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function Balance({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-2">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">{icon} {label}</span>
      <span className={`font-black ${accent ? "text-accent" : "text-primary"}`}>{value}</span>
    </div>
  )
}

function QuickBtn({ children, onClick, accent }: { children: React.ReactNode; onClick: () => void; accent: string }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border p-3 text-left font-bold transition-transform hover:scale-[1.02] active:scale-95 ${
        accent === "text-accent"
          ? "border-accent/50 bg-accent/10 text-accent"
          : "border-primary/50 bg-primary/10 text-primary"
      }`}
    >
      {children}
    </button>
  )
}
