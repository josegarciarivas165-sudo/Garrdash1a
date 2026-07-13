"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useGameStore, formatNumber } from "@/lib/use-game-store"
import { POWERUP_PACKS, buyPowerup } from "@/lib/store"
import { toast } from "sonner"
import { Coins, Zap } from "lucide-react"

export function PowerupsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const state = useGameStore()

  function handleBuy(type: "shield" | "superJump") {
    const result = buyPowerup(type)
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    const pack = POWERUP_PACKS.find((p) => p.type === type)!
    toast.success(`${pack.icon} ${pack.name} comprado (${pack.cost} monedas).`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-glow-primary">
            <Zap className="size-5 text-primary" aria-hidden /> Tienda de Poderes
          </DialogTitle>
          <DialogDescription>
            Compra poderes con monedas para potenciar tu cubo en la próxima partida.
            Se consumen automáticamente al usarlos.
          </DialogDescription>
        </DialogHeader>

        {/* Balance */}
        <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Coins className="size-4 text-accent" aria-hidden /> Monedas
          </span>
          <span className="font-black text-accent">{formatNumber(state.coins)}</span>
        </div>

        {/* Power-ups */}
        <div className="grid grid-cols-1 gap-3">
          {POWERUP_PACKS.map((pack) => {
            const owned = state.powerups[pack.type]
            const affordable = state.coins >= pack.cost
            return (
              <div
                key={pack.type}
                className="flex items-start gap-3 rounded-xl border border-border/60 bg-card/70 p-3"
              >
                <div className="text-3xl" aria-hidden>{pack.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">{pack.name}</p>
                    <Badge variant="outline" className="border-primary/40 text-primary">
                      x{owned}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{pack.description}</p>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm font-bold text-accent">
                      <Coins className="size-3" aria-hidden /> {formatNumber(pack.cost)}
                    </span>
                    <Button size="sm" disabled={!affordable} onClick={() => handleBuy(pack.type)} className="gap-1">
                      Comprar
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center text-[11px] text-muted-foreground">
          Los poderes se activan automáticamente al iniciar la partida y se ven en la esquina superior.
        </p>
      </DialogContent>
    </Dialog>
  )
}
