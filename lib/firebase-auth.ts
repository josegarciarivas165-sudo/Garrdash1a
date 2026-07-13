"use client"

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth"
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  Unsubscribe,
} from "firebase/firestore"
import { auth, db } from "./firebase"
import type { PlayerProfile } from "./types"

export interface FirestoreUserDoc {
  uid: string
  nombre: string
  edad: number
  nacionalidad: string
  email: string
  monedas: number
  diamantes: number
  puntos: number
  es_vip: boolean
  estado_canje: "ninguno" | "pendiente" | "aprobado"
  bestScore: number
  totalRuns: number
  totalCoinsFromRuns: number
  createdAt: ReturnType<typeof serverTimestamp> | null
}

export interface SessionData {
  uid: string
  nombre: string
  edad: number
  nacionalidad: string
  email: string
  monedas: number
  diamantes: number
  puntos: number
  es_vip: boolean
  estado_canje: "ninguno" | "pendiente" | "aprobado"
  bestScore: number
  totalRuns: number
  totalCoinsFromRuns: number
}

const USERS = "usuarios"

function userDocRef(uid: string) {
  return doc(db, USERS, uid)
}

/**
 * Registro: crea la cuenta en Firebase Auth y un documento en /usuarios/{uid}
 * con los datos del perfil y los valores económicos iniciales.
 */
export async function registerUser(input: {
  nombre: string
  edad: number
  nacionalidad: string
  email: string
  password: string
}): Promise<{ ok: true; session: SessionData } | { ok: false; reason: string }> {
  try {
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password)
    await updateProfile(cred.user, { displayName: input.nombre })
    const docData: Omit<FirestoreUserDoc, "createdAt"> = {
      uid: cred.user.uid,
      nombre: input.nombre,
      edad: input.edad,
      nacionalidad: input.nacionalidad,
      email: input.email,
      monedas: 500,
      diamantes: 0,
      puntos: 0,
      es_vip: false,
      estado_canje: "ninguno",
      bestScore: 0,
      totalRuns: 0,
      totalCoinsFromRuns: 0,
    }
    await setDoc(userDocRef(cred.user.uid), { ...docData, createdAt: serverTimestamp() })
    return {
      ok: true,
      session: {
        uid: cred.user.uid,
        nombre: input.nombre,
        edad: input.edad,
        nacionalidad: input.nacionalidad,
        email: input.email,
        monedas: 500,
        diamantes: 0,
        puntos: 0,
        es_vip: false,
        estado_canje: "ninguno",
        bestScore: 0,
        totalRuns: 0,
        totalCoinsFromRuns: 0,
      },
    }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? ""
    if (code === "auth/email-already-in-use") {
      return { ok: false, reason: "Ese correo ya está registrado. Inicia sesión." }
    }
    if (code === "auth/weak-password") {
      return { ok: false, reason: "La contraseña debe tener al menos 6 caracteres." }
    }
    if (code === "auth/invalid-email") {
      return { ok: false, reason: "Correo electrónico inválido." }
    }
    return { ok: false, reason: `Error de registro: ${code || "desconocido"}` }
  }
}

/**
 * Login: valida credenciales contra Firebase y carga el documento del usuario.
 * Devuelve los datos económicos y el estado VIP para hidratar la wallet segura.
 */
export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: true; session: SessionData } | { ok: false; reason: string }> {
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password)
    const snap = await getDoc(userDocRef(cred.user.uid))
    if (!snap.exists()) {
      return { ok: false, reason: "Tu cuenta no tiene perfil. Regístrate primero." }
    }
    const data = snap.data() as Partial<FirestoreUserDoc>
    const session: SessionData = {
      uid: cred.user.uid,
      nombre: data.nombre ?? cred.user.displayName ?? "Jugador",
      edad: data.edad ?? 0,
      nacionalidad: data.nacionalidad ?? "",
      email: data.email ?? email,
      monedas: data.monedas ?? 0,
      diamantes: data.diamantes ?? 0,
      puntos: data.puntos ?? 0,
      es_vip: data.es_vip ?? false,
      estado_canje: data.estado_canje ?? "ninguno",
      bestScore: data.bestScore ?? 0,
      totalRuns: data.totalRuns ?? 0,
      totalCoinsFromRuns: data.totalCoinsFromRuns ?? 0,
    }
    return { ok: true, session }
  } catch (err: unknown) {
    const code = (err as { code?: string }).code ?? ""
    if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
      return { ok: false, reason: "Correo o contraseña incorrectos." }
    }
    if (code === "auth/user-not-found") {
      return { ok: false, reason: "No existe una cuenta con ese correo." }
    }
    if (code === "auth/too-many-requests") {
      return { ok: false, reason: "Demasiados intentos. Espera unos minutos." }
    }
    return { ok: false, reason: `Error de acceso: ${code || "desconocido"}` }
  }
}

export async function logoutUser(): Promise<void> {
  await signOut(auth)
}

/**
 * Persiste el documento del usuario en Firestore. La store llama a esto
 * para guardar monedas/récords/vip. Si el anticheat está activo, NO se persiste.
 */
export async function saveUserDoc(
  uid: string,
  patch: Partial<FirestoreUserDoc>,
): Promise<boolean> {
  if (!uid) return false
  try {
    await setDoc(userDocRef(uid), patch, { merge: true })
    return true
  } catch (err) {
    console.warn("[firebase] saveUserDoc falló:", err)
    return false
  }
}

/**
 * Suscribe un listener en tiempo real al documento del usuario.
 * Lo usa el sistema de notificaciones de canje y para hidratar estado VIP.
 */
type Listener = (session: SessionData | null) => void

export function subscribeUserDoc(uid: string, onChange: Listener): Unsubscribe {
  return onSnapshot(
    userDocRef(uid),
    (snap) => {
      if (!snap.exists()) {
        onChange(null)
        return
      }
      const d = snap.data() as Partial<FirestoreUserDoc>
      onChange({
        uid,
        nombre: d.nombre ?? "",
        edad: d.edad ?? 0,
        nacionalidad: d.nacionalidad ?? "",
        email: d.email ?? "",
        monedas: d.monedas ?? 0,
        diamantes: d.diamantes ?? 0,
        puntos: d.puntos ?? 0,
        es_vip: d.es_vip ?? false,
        estado_canje: d.estado_canje ?? "ninguno",
        bestScore: d.bestScore ?? 0,
        totalRuns: d.totalRuns ?? 0,
        totalCoinsFromRuns: d.totalCoinsFromRuns ?? 0,
      })
    },
    (err) => console.warn("[firebase] subscribeUserDoc error:", err),
  )
}

/** Observer de Auth: ¿hay sesión activa? */
export function onAuthChange(cb: (user: User | null) => void): Unsubscribe {
  return onAuthStateChanged(auth, cb)
}

/** Marca el canje como pendiente en Firestore (candado anti-spam). */
export async function setExchangePending(uid: string): Promise<boolean> {
  return saveUserDoc(uid, { estado_canje: "pendiente" })
}

/** Marca el canje como aprobado (lo hace un admin o el backend). */
export async function setExchangeApproved(uid: string): Promise<boolean> {
  return saveUserDoc(uid, { estado_canje: "aprobado" })
}

/** Vuelve el estado de canje a 'ninguno' tras cerrar la notificación. */
export async function resetExchangeStatus(uid: string): Promise<boolean> {
  return saveUserDoc(uid, { estado_canje: "ninguno" })
}

export function toProfile(s: SessionData): PlayerProfile {
  return {
    firstName: s.nombre,
    lastName: "",
    age: s.edad,
    nationality: s.nacionalidad,
    email: s.email,
    createdAt: Date.now(),
  }
}
