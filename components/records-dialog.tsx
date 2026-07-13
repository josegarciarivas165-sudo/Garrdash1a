"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { useGameStore, maskName, formatNumber } from "@/lib/use-game-store"
import { GLOBAL_LEADERBOARD_SEED } from "@/lib/store"
import {
  Trophy,
  Coins,
  Gamepad2,
  Gem,
  Hourglass,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import type { RedemptionStatus } from "@/lib/types"

const STATUS_META: Record<
  RedemptionStatus,
  { label: string; icon: React.ReactNode; className: string }
> = {
  "En Revisión": {
    label: "⏱️ En Revisión (24-72h)",
    icon: <Hourglass className="size-3" />,
    className: "border-accent/50 text-accent",
  },
  "Completado": {
    label: "✅ Completado / Enviado",
    icon: <CheckCircle2 className="size-3" />,
    className: "border-primary/50 text-primary",
  },
  "Cancelado": {
    label: "❌ Cancelado / Cuenta Suspendida",
    icon: <XCircle className="size-3" />,
    className: "border-destructive/50 text-destructive",
  },
}

export function RecordsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const state = useGameStore()
  const { gameStats, redemptions } = state

  const pending = redemptions.filter((r) => r.status === "En Revisión").length
  const completed = redemptions.filter((r) => r.status === "Completado").length

  const stats = [
    { label: "Récord", value: formatNumber(gameStats.bestScore), icon: <Trophy className="size-4 text-accent" /> },
    { label: "Última", value: formatNumber(gameStats.lastScore), icon: <Gamepad2 className="size-4 text-primary" /> },
    { label: "Partidas", value: formatNumber(gameStats.totalRuns), icon: <Gamepad2 className="size-4 text-neon-pink" /> },
    { label: "Ganadas", value: formatNumber(gameStats.totalCoinsFromRuns), icon: <Coins className="size-4 text-accent" /> },
  ]

  // Top de récord: seed global + el usuario real (con máscara de privacidad).
  const playerName = state.profile ? `${state.profile.firstName} ${state.profile.lastName}` : "Tú"
  const leaderboard = [
    ...GLOBAL_LEADERBOARD_SEED,
    { name: playerName, score: gameStats.bestScore },
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-glow-primary">
            <Trophy className="size-5 text-accent" aria-hidden /> Récords e Historial
          </DialogTitle>
          <DialogDescription>
            Estadísticas, récord de monedas y estado de tus reclamos en tiempo real.
          </DialogDescription>
        </DialogHeader>

        {/* Stats grid */}
        <div className="grid grid-cols-4 gap-2">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex flex-col gap-1 rounded-xl border border-border/60 bg-card/70 p-2 text-center"
            >
              <div className="flex items-center justify-center gap-1 text-[9px] uppercase tracking-wide text-muted-foreground">
                {s.icon} {s.label}
              </div>
              <p className="text-base font-black">{s.value}</p>
            </div>
          ))}
        </div>

        <Tabs defaultValue="leaderboard" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="leaderboard" className="gap-1">
              <Coins className="size-4" aria-hidden /> Récord
            </TabsTrigger>
            <TabsTrigger value="claims" className="gap-1">
              <Gem className="size-4" aria-hidden /> Reclamos
              {pending > 0 && (
                <Badge variant="outline" className="border-accent/50 text-accent">
                  {pending}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="leaderboard">
            <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
              {leaderboard.map((row, i) => (
                <div
                  key={`${row.name}-${i}`}
                  className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                    row.name === playerName
                      ? "border border-primary/50 bg-primary/10"
                      : "bg-card/70"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`flex size-6 items-center justify-center rounded-full text-xs font-bold ${
                        i === 0
                          ? "bg-accent text-accent-foreground"
                          : i < 3
                          ? "bg-primary/30 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="text-sm font-medium">{maskName(row.name)}</span>
                    {row.name === playerName && (
                      <Badge variant="outline" className="border-primary/50 text-primary">
                        Tú
                      </Badge>
                    )}
                  </div>
                  <span className="text-sm font-black text-accent">
                    {formatNumber(row.score)} pts
                  </span>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="claims">
            {redemptions.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border/60 p-4 text-center text-xs text-muted-foreground">
                Aún no hay reclamos. Compra Puntos de Objetivo en la tienda y reclama diamantes.
              </p>
            ) : (
              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto">
                {redemptions.map((r) => {
                  const meta = STATUS_META[r.status]
                  return (
                    <div
                      key={r.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card/70 px-3 py-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden>💎</span>
                        <div>
                          <p className="text-sm font-semibold">{r.packName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            ID: <span className="font-mono">{r.freeFireId}</span> · {timeAgo(r.createdAt)}
                          </p>
                        </div>
                      </div>
                      <Badge variant="outline" className={`gap-1 ${meta.className}`}>
                        {meta.label}
                      </Badge>
                    </div>
                  )
                })}
              </div>
            )}
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <div className="rounded-lg border border-accent/40 bg-accent/10 p-2 text-xs">
                <p className="text-muted-foreground">Pendientes</p>
                <p className="font-black text-accent">{pending}</p>
              </div>
              <div className="rounded-lg border border-primary/40 bg-primary/10 p-2 text-xs">
                <p className="text-muted-foreground">Completados</p>
                <p className="font-black text-primary">{completed}</p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function timeAgo(ts: number): string {
  const secs = Math.floor((Date.now() - ts) / 1000)
  if (secs < 60) return "hace un momento"
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `hace ${days} d`
}
