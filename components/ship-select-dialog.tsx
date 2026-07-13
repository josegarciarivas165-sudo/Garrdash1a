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
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Coins, Lock, Check, Zap, Target, Gauge } from "lucide-react"
import { useGameStore, formatNumber } from "@/lib/use-game-store"
import { selectShip, unlockShip } from "@/lib/store"
import { SHIPS, type ShipType, type ShipConfig } from "@/lib/types"
import { playButtonSfx, unlockAudio } from "@/lib/audio"

export function ShipSelectDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const state = useGameStore()
  const [selected, setSelected] = useState<ShipType>(state.selectedShip)

  function handleSelect(shipId: ShipType) {
    unlockAudio()
    playButtonSfx()
    if (state.unlockedShips.includes(shipId)) {
      selectShip(shipId)
      setSelected(shipId)
      toast.success(`Nave seleccionada: ${SHIPS.find(s => s.id === shipId)?.name}`)
    }
  }

  function handleUnlock(ship: ShipConfig) {
    unlockAudio()
    playButtonSfx()
    const result = unlockShip(ship.id)
    if (result.ok) {
      toast.success(`Nave desbloqueada: ${ship.name}`)
      setSelected(ship.id)
    } else {
      toast.error(result.reason)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-glow-primary">
            Seleccion de Nave
          </DialogTitle>
          <DialogDescription>
            Elige tu nave para la batalla. Cada una tiene habilidades unicas.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {SHIPS.map((ship) => {
            const isUnlocked = state.unlockedShips.includes(ship.id)
            const isSelected = state.selectedShip === ship.id
            const canAfford = state.coins >= ship.unlockCost

            return (
              <div
                key={ship.id}
                className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-glow-primary"
                    : isUnlocked
                    ? "border-border/60 bg-card/70 hover:border-primary/40 cursor-pointer"
                    : "border-border/40 bg-card/40 opacity-80"
                }`}
                onClick={() => isUnlocked && handleSelect(ship.id)}
                role={isUnlocked ? "button" : undefined}
                aria-label={`Nave ${ship.name}${isUnlocked ? "" : " (bloqueada)"}`}
              >
                {/* Background gradient */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{
                    background: `radial-gradient(circle at 70% 20%, hsl(${ship.premium ? "var(--neon-pink)" : "var(--primary)"} / 40%), transparent 60%)`,
                  }}
                />

                <div className="relative flex items-center gap-4">
                  {/* Ship emoji */}
                  <div
                    className={`flex size-16 items-center justify-center rounded-xl text-4xl ${
                      isUnlocked ? "bg-primary/20" : "bg-muted/30"
                    }`}
                    style={{
                      filter: isUnlocked ? "drop-shadow(0 0 12px hsl(var(--primary)/50%))" : "grayscale(80%)",
                    }}
                  >
                    {ship.emoji}
                  </div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-foreground">{ship.name}</h3>
                      {ship.premium && (
                        <Badge variant="outline" className="border-neon-pink/60 text-neon-pink text-[10px]">
                          PREMIUM
                        </Badge>
                      )}
                      {isSelected && (
                        <Badge className="bg-primary text-primary-foreground text-[10px]">
                          <Check className="size-3 mr-1" /> ACTIVO
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{ship.description}</p>

                    {/* Stats */}
                    <div className="flex gap-4 mt-2">
                      <div className="flex items-center gap-1 text-xs text-primary">
                        <Gauge className="size-3" />
                        <span>{Math.round(ship.speed * 100)}%</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-accent">
                        <Target className="size-3" />
                        <span>{Math.round(ship.fireRate * 100)}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Unlock button or lock icon */}
                  {!isUnlocked && (
                    <div className="flex flex-col items-end gap-2">
                      <Lock className="size-5 text-muted-foreground" />
                      <Button
                        size="sm"
                        variant={canAfford ? "default" : "secondary"}
                        disabled={!canAfford}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleUnlock(ship)
                        }}
                        className="gap-1 text-xs"
                      >
                        <Coins className="size-3" />
                        {formatNumber(ship.unlockCost)}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>Tus monedas:</span>
          <span className="flex items-center gap-1 font-bold text-accent">
            <Coins className="size-4" />
            {formatNumber(state.coins)}
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}
