"use client"

import { useEffect, useState } from "react"
import { SplashScreen } from "@/components/splash-screen"
import { AuthScreen } from "@/components/auth-screen"
import { MainMenu } from "@/components/main-menu"
import { RunnerGame } from "@/components/runner-game"
import { VipDialog } from "@/components/vip-dialog"
import { RecordsDialog } from "@/components/records-dialog"
import { ShopDialog } from "@/components/shop-dialog"
import { WheelDialog } from "@/components/wheel-dialog"
import { ComingSoonDialog } from "@/components/coming-soon-dialog"
import { PushNotificationCenter } from "@/components/push-notification-center"
import { useGameStore } from "@/lib/use-game-store"
import { resetDailyWheelIfNeeded, pushNotification, clearExchangeAfterNotification, setExchangeStatus } from "@/lib/store"
import { subscribeUserDoc } from "@/lib/firebase-auth"

type Screen = "splash" | "auth" | "menu" | "game"
type DialogTarget = "shop" | "records" | "wheel" | "vip" | null

export default function Page() {
  const state = useGameStore()
  const [screen, setScreen] = useState<Screen>("splash")
  const [hydrated, setHydrated] = useState(false)
  const [dialog, setDialog] = useState<DialogTarget>(null)
  const [soon, setSoon] = useState<{ title: string; description: string } | null>(null)

  useEffect(() => {
    setHydrated(true)
    resetDailyWheelIfNeeded()
  }, [])

  function handleSplashDone() {
    setScreen(state.authUid ? "menu" : "auth")
  }

  // Guard: menu/game solo accesibles si hay sesión Firebase.
  useEffect(() => {
    if (!hydrated) return
    if ((screen === "menu" || screen === "game") && !state.authUid) {
      setScreen("auth")
    }
  }, [hydrated, screen, state.authUid])

  // Listener en tiempo real de Firestore: detecta cuando estado_canje
  // cambia de 'pendiente' a 'aprobado' y lanza la notificación flotante.
  useEffect(() => {
    if (!state.authUid) return
    let prev = state.exchangeStatus
    const unsub = subscribeUserDoc(state.authUid, (session) => {
      if (!session) return
      const next = session.estado_canje
      setExchangeStatus(next)
      if (prev === "pendiente" && next === "aprobado") {
        pushNotification(
          "Tus diamantes han sido enviados! Revisa tu cuenta de juego. Gracias por jugar!",
        )
      }
      prev = next
    })
    return () => unsub()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.authUid])

  // Cuando se cierra la notificación de aprobación, volver interno a 'ninguno'
  // y desbloquear el botón de la tienda. Lo hacemos reaccionando al cambio
  // de exchangeStatus a 'aprobado': tras unos segundos, limpiamos.
  useEffect(() => {
    if (state.exchangeStatus !== "aprobado") return
    const t = window.setTimeout(() => {
      clearExchangeAfterNotification()
    }, 8000)
    return () => window.clearTimeout(t)
  }, [state.exchangeStatus])

  if (screen === "splash") {
    return <SplashScreen onDone={handleSplashDone} />
  }

  if (screen === "auth") {
    return <AuthScreen onAuthed={() => setScreen("menu")} />
  }

  if (screen === "game") {
    return (
      <>
        <PushNotificationCenter />
        <RunnerGame onExit={() => setScreen("menu")} />
      </>
    )
  }

  return (
    <>
      <PushNotificationCenter />
      <MainMenu
        onPlay={() => setScreen("game")}
        onOpenShop={() => setDialog("shop")}
        onOpenRecords={() => setDialog("records")}
        onOpenWheel={() => setDialog("wheel")}
        onOpenVip={() => setDialog("vip")}
      />

      <ShopDialog open={dialog === "shop"} onOpenChange={(v) => !v && setDialog(null)} />
      <RecordsDialog open={dialog === "records"} onOpenChange={(v) => !v && setDialog(null)} />
      <WheelDialog open={dialog === "wheel"} onOpenChange={(v) => !v && setDialog(null)} />
      <VipDialog open={dialog === "vip"} onOpenChange={(v) => !v && setDialog(null)} />

      <ComingSoonDialog
        open={soon !== null}
        onOpenChange={(v) => !v && setSoon(null)}
        title={soon?.title ?? ""}
        description={soon?.description ?? ""}
      />
    </>
  )
}
