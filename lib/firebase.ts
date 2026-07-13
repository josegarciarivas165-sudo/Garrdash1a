import { initializeApp, getApps, getApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"

// Configuración real del proyecto Firebase "garrdash".
const firebaseConfig = {
  apiKey: "AIzaSyCUk2GWPm_AcBOFvzCpw1K5E-P5FdfeBho",
  authDomain: "garrdash.firebaseapp.com",
  projectId: "garrdash",
  storageBucket: "garrdash.firebasestorage.app",
  messagingSenderId: "913250323167",
  appId: "1:913250323167:web:9a04296cfb1566de51f76a",
  measurementId: "G-5PZJZKJNYJ",
}

// Evita inicializar doble en HMR / Next dev.
export const firebaseApp =
  getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)

export const auth = getAuth(firebaseApp)
export const db = getFirestore(firebaseApp)
