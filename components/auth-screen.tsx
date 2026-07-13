"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Coins, UserPlus, LogIn, Shield } from "lucide-react"
import { registerUser, loginUser } from "@/lib/firebase-auth"
import { hydrateFromFirebase } from "@/lib/store"
import { toast } from "sonner"
import { playButtonSfx } from "@/lib/audio"
import { PrivacyDialog } from "@/components/privacy-dialog"

const NATIONALITIES = [
  "Argentina", "Bolivia", "Chile", "Colombia", "Costa Rica", "Cuba", "Ecuador",
  "El Salvador", "Guatemala", "Honduras", "México", "Nicaragua", "Panamá",
  "Paraguay", "Perú", "Puerto Rico", "Rep. Dominicana", "Uruguay", "Venezuela",
  "España", "Estados Unidos", "Otro",
]

type Mode = "login" | "register"

export function AuthScreen({ onAuthed }: { onAuthed: () => void }) {
  const [mode, setMode] = useState<Mode>("login")
  const [submitting, setSubmitting] = useState(false)
  const [privacyOpen, setPrivacyOpen] = useState(false)

  // Campos compartidos / de registro
  const [name, setName] = useState("")
  const [age, setAge] = useState("")
  const [nationality, setNationality] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [accepted, setAccepted] = useState(false)

  const canSubmitRegister = Boolean(
    name.trim() && age && nationality && email && password.length >= 6 && accepted,
  )
  const canSubmitLogin = Boolean(email && password)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmitRegister) return
    playButtonSfx()
    const ageNum = Number.parseInt(age, 10)
    if (!Number.isFinite(ageNum) || ageNum < 8 || ageNum > 99) {
      toast.error("Introduce una edad válida (8 a 99).")
      return
    }
    setSubmitting(true)
    const result = await registerUser({
      nombre: name.trim(),
      edad: ageNum,
      nacionalidad: nationality,
      email: email.trim(),
      password,
    })
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    hydrateFromFirebase({
      uid: result.session.uid,
      nombre: result.session.nombre,
      edad: result.session.edad,
      nacionalidad: result.session.nacionalidad,
      email: result.session.email,
      monedas: result.session.monedas,
      diamantes: result.session.diamantes,
      puntos: result.session.puntos,
      es_vip: result.session.es_vip,
      estado_canje: result.session.estado_canje,
      bestScore: result.session.bestScore,
      totalRuns: result.session.totalRuns,
      totalCoinsFromRuns: result.session.totalCoinsFromRuns,
    })
    toast.success(`¡Bienvenido, ${name.trim()}! Cuenta creada en Firebase.`)
    window.setTimeout(onAuthed, 400)
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmitLogin) return
    playButtonSfx()
    setSubmitting(true)
    const result = await loginUser(email.trim(), password)
    setSubmitting(false)
    if (!result.ok) {
      toast.error(result.reason)
      return
    }
    hydrateFromFirebase({
      uid: result.session.uid,
      nombre: result.session.nombre,
      edad: result.session.edad,
      nacionalidad: result.session.nacionalidad,
      email: result.session.email,
      monedas: result.session.monedas,
      diamantes: result.session.diamantes,
      puntos: result.session.puntos,
      es_vip: result.session.es_vip,
      estado_canje: result.session.estado_canje,
      bestScore: result.session.bestScore,
      totalRuns: result.session.totalRuns,
      totalCoinsFromRuns: result.session.totalCoinsFromRuns,
    })
    toast.success(`¡Hola de nuevo, ${result.session.nombre}! Monedas cargadas desde la nube.`)
    window.setTimeout(onAuthed, 400)
  }

  const inputClass =
    "border-accent/30 bg-input/60 focus-visible:border-accent focus-visible:ring-accent/40"

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden bg-background bg-grid p-4">
      <div className="absolute inset-0 animate-grid-drift bg-grid opacity-30" />
      <div className="relative w-full max-w-lg rounded-3xl border border-border/60 bg-card/80 p-6 shadow-glow-primary backdrop-blur sm:p-8">
        {/* Toggle login/registro */}
        <div className="mb-6 flex items-center justify-center gap-2 rounded-full border border-border/60 bg-secondary/40 p-1">
          <ToggleButton active={mode === "login"} onClick={() => setMode("login")}>
            <LogIn className="size-4" aria-hidden /> Iniciar Sesión
          </ToggleButton>
          <ToggleButton active={mode === "register"} onClick={() => setMode("register")}>
            <UserPlus className="size-4" aria-hidden /> Registrarse
          </ToggleButton>
        </div>

        <header className="mb-5 flex flex-col items-center text-center">
          <h2 className="text-3xl font-black tracking-tight text-glow-primary">
            {mode === "register" ? "Crea tu cuenta" : "Bienvenido de nuevo"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "register"
              ? "Conectado a Firebase en tiempo real."
              : "Ingresa tus datos para recuperar tu progreso."}
          </p>
        </header>

        {mode === "register" ? (
          <form onSubmit={handleRegister} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nombre">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Juan" className={inputClass} maxLength={32} autoComplete="given-name" />
            </Field>
            <Field label="Edad">
              <Input type="number" inputMode="numeric" min={8} max={99} value={age} onChange={(e) => setAge(e.target.value)} placeholder="Ej. 18" className={inputClass} />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Nacionalidad">
                <select value={nationality} onChange={(e) => setNationality(e.target.value)} className={`flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ${inputClass}`}>
                  <option value="">Selecciona…</option>
                  {NATIONALITIES.map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Correo electrónico">
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={inputClass} autoComplete="email" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Contraseña (mín. 6)">
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className={inputClass} autoComplete="new-password" />
              </Field>
            </div>

            <div className="sm:col-span-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/60 bg-secondary/30 p-3 text-sm">
                <Checkbox checked={accepted} onCheckedChange={(v) => setAccepted(v === true)} className="mt-0.5 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[state=checked]:text-accent-foreground" />
                <span className="text-muted-foreground">
                  Acepto las{" "}
                  <button
                    type="button"
                    onClick={() => setPrivacyOpen(true)}
                    className="font-bold text-accent underline"
                  >
                    Políticas de Privacidad
                  </button>
                  .
                </span>
              </label>
            </div>

            <div className="sm:col-span-2">
              <div className="mb-4 flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-3 text-accent">
                <Coins className="size-5" aria-hidden />
                <span className="font-bold">Bono de bienvenida: 500 monedas</span>
              </div>
              <Button type="submit" size="lg" disabled={!canSubmitRegister || submitting} className="w-full gap-2 font-bold shadow-glow-gold">
                <UserPlus className="size-5" aria-hidden />
                {submitting ? "Creando cuenta…" : "Registrarse"}
              </Button>
              {!accepted && (
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Debes marcar el checkbox de privacidad para habilitar el registro.
                </p>
              )}
            </div>
          </form>
        ) : (
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Field label="Correo electrónico">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tucorreo@ejemplo.com" className={inputClass} autoComplete="email" />
            </Field>
            <Field label="Contraseña">
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" className={inputClass} autoComplete="current-password" />
            </Field>
            <Button type="submit" size="lg" disabled={!canSubmitLogin || submitting} className="gap-2 font-bold shadow-glow-primary">
              <LogIn className="size-5" aria-hidden />
              {submitting ? "Validando…" : "Iniciar Sesión"}
            </Button>
            <p className="flex items-center justify-center gap-1 text-center text-[11px] text-muted-foreground">
              <Shield className="size-3" aria-hidden /> Recuperamos tus monedas, récords y VIP desde Firebase.
            </p>
          </form>
        )}
      </div>

      {/* Política de privacidad completa (local, sin enlace externo) */}
      <PrivacyDialog open={privacyOpen} onOpenChange={setPrivacyOpen} />
    </div>
  )
}

function ToggleButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
        active ? "bg-primary text-primary-foreground shadow-glow-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}
