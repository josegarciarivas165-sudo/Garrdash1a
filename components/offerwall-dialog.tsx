"use client"

import { useEffect, useState } from "react"
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
import { completeOfferwallTask } from "@/lib/store"
import { toast } from "sonner"
import { Gift, CheckCircle2, Loader2, ShieldCheck, Download } from "lucide-react"
import type { OfferwallTask } from "@/lib/types"

type TaskState = "idle" | "running" | "done"

export function OfferwallDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const state = useGameStore()
  const [runningId, setRunningId] = useState<string | null>(null)
  const [taskStates, setTaskStates] = useState<Record<string, TaskState>>({})

  // Reset running states when reopened.
  useEffect(() => {
    if (open) setTaskStates({})
  }, [open])

  function handleStartTask(task: OfferwallTask) {
    if (task.completed) return
    setRunningId(task.id)
    setTaskStates((prev) => ({ ...prev, [task.id]: "running" }))
    // Simula la descarga + uso de la app (2.5s = callback pendiente).
    window.setTimeout(() => {
      const result = completeOfferwallTask(task.id)
      setRunningId(null)
      setTaskStates((prev) => ({ ...prev, [task.id]: "done" }))
      if (result.ok) {
        toast.success(`Callback recibido. +${formatNumber(result.reward)} monedas sumadas.`)
      } else {
        toast.error(result.reason)
      }
    }, 2500)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !runningId && onOpenChange(v)}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-accent text-glow-gold">
            <Gift className="size-5" aria-hidden /> 🎁 Monedas Gratis
          </DialogTitle>
          <DialogDescription>
            Completa tareas del muro de ofertas para ganar monedas. Pago seguro vía callback S2S.
          </DialogDescription>
        </DialogHeader>

        {/* Balance actual */}
        <div className="flex items-center justify-between rounded-xl border border-accent/40 bg-accent/10 px-4 py-2">
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="size-4 text-accent" aria-hidden /> Billetera
          </span>
          <span className="font-black text-accent">{formatNumber(state.coins)}</span>
        </div>

        {/* Lista de tareas */}
        <div className="flex flex-col gap-2">
          {state.offerwallTasks.map((task) => {
            const taskState = taskStates[task.id] ?? (task.completed ? "done" : "idle")
            const running = runningId === task.id
            return (
              <div
                key={task.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-card/70 p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Download className="size-4" aria-hidden />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{task.title}</p>
                    <p className="text-[11px] text-muted-foreground">App: {task.app}</p>
                    <p className="mt-0.5 text-xs font-bold text-accent">
                      +{formatNumber(task.reward)} monedas
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  {taskState === "done" || task.completed ? (
                    <Badge variant="outline" className="gap-1 border-primary/50 text-primary">
                      <CheckCircle2 className="size-3" /> Completado
                    </Badge>
                  ) : running ? (
                    <Button size="sm" variant="secondary" disabled className="gap-2">
                      <Loader2 className="size-3 animate-spin" /> Procesando
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleStartTask(task)}
                      disabled={runningId !== null}
                    >
                      Completar
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
          <ShieldCheck className="size-3" aria-hidden /> Las recompensas se validan con un callback seguro del proveedor.
        </p>
      </DialogContent>
    </Dialog>
  )
}
