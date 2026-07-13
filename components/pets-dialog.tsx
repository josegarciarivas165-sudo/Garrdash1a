"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { useGameStore, formatNumber } from "@/lib/use-game-store"
import { unlockDrone, equipDrone } from "@/lib/store"
import { Coins, Lock, Check, Zap, Shield, Star } from "lucide-react"
import { playButtonSfx, unlockAudio } from "@/lib/audio"
import { ShipType } from "@/lib/types"

interface Pet {
  id: ShipType
  name: string
  description: string
  cost: number
  effect: string
  unlockCost: number
}

const PETS: Pet[] = [
  {
    id: "drone-attack" as ShipType,
    name: "Dron de Ataque",
    description: "Dos drones que te acompañan y disparan automáticamente a los enemigos.",
    cost: 0,
    effect: "Disparo automático dual",
    unlockCost: 800,
  },
  {
    id: "drone-shield" as ShipType,
    name: "Dron Escudo",
    description: "Un dron que orbita alrededor de tu nave absorbiendo proyectiles enemigos.",
    cost: 0,
    effect: "Protección orbital",
    unlockCost: 1200,
  },
  {
    id: "drone-collector" as ShipType,
    name: "Dron Recolector",
    description: "Un dron que atrae monedas cercanas automáticamente hacia tu nave.",
    cost: 0,
    effect: "Atracción magnética",
    unlockCost: 1500,
  },
]

interface PetsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function PetsDialog({ open, onOpenChange }: PetsDialogProps) {
  const state = useGameStore()
  const [pendingPurchase, setPendingPurchase] = useState<ShipType | null>(null)

  const unlockedPets = state.unlockedShips.filter(s => s.startsWith("drone")) as ShipType[]

  function handleUnlock(petId: ShipType) {
    unlockAudio()
    playButtonSfx()

    const result = unlockDrone(petId)
    if (result.ok) {
      setPendingPurchase(null)
    } else {
      console.log("Error:", result.reason)
    }
  }

  function handleEquip(petId: ShipType) {
    unlockAudio()
    playButtonSfx()
    equipDrone(petId)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Zap className="size-5" /> Mascotas
          </DialogTitle>
          <DialogDescription>
            Companeros automatizados que te ayudan en combate.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between mb-3">
          <span className="text-sm text-muted-foreground">Tus monedas:</span>
          <div className="flex items-center gap-1 rounded-full border border-accent/40 bg-accent/10 px-2 py-0.5">
            <Coins className="size-3.5 text-accent" />
            <span className="text-sm font-bold text-accent">{formatNumber(state.coins)}</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {PETS.map((pet) => {
            const isUnlocked = unlockedPets.includes(pet.id)
            const canAfford = state.coins >= pet.unlockCost
            const isEquipped = state.selectedShip === pet.id

            return (
              <Card
                key={pet.id}
                className={`p-3 border transition-all ${
                  isEquipped
                    ? "border-primary bg-primary/10"
                    : isUnlocked
                    ? "border-border hover:border-primary/50"
                    : "border-border/40 opacity-70"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-sm font-bold">{pet.name}</h3>
                      {isUnlocked && (
                        <Badge variant="outline" className="text-[9px] h-4 px-1 border-green-500/50 text-green-500">
                          <Check className="size-2.5 mr-0.5" /> Desbloqueado
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{pet.description}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <Badge variant="secondary" className="text-[8px] h-4">{pet.effect}</Badge>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {!isUnlocked ? (
                      <>
                        <Badge variant="outline" className="text-[10px] gap-0.5">
                          <Coins className="size-2.5 text-accent" />
                          {formatNumber(pet.unlockCost)}
                        </Badge>
                        <Button
                          size="sm"
                          disabled={!canAfford}
                          onClick={() => handleUnlock(pet.id)}
                          className="text-[10px] h-6 px-2"
                        >
                          {canAfford ? "Comprar" : <Lock className="size-3" />}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant={isEquipped ? "default" : "outline"}
                        onClick={() => handleEquip(pet.id)}
                        className="text-[10px] h-6 px-2"
                      >
                        {isEquipped ? "Equipado" : "Equipar"}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            )
          })}
        </div>

        <div className="mt-3 pt-3 border-t border-border/60">
          <Card className="p-2 bg-primary/5 border-primary/30">
            <div className="flex items-center gap-2">
              <Star className="size-4 text-primary" />
              <div>
                <p className="text-[10px] font-bold">Dron de Ataque - Efecto</p>
                <p className="text-[9px] text-muted-foreground">
                  Dispara automaticamente cada 180ms, duplicando tu poder de fuego.
                </p>
              </div>
            </div>
          </Card>
        </div>

        <Button
          onClick={() => onOpenChange(false)}
          className="w-full mt-2"
          variant="secondary"
        >
          Cerrar
        </Button>
      </DialogContent>
    </Dialog>
  )
}
