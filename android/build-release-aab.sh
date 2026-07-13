#!/bin/bash
# Script para generar AAB firmado de produccion
# Ejecutar desde la RAIZ del proyecto (no desde android/)

set -e

echo "=== Generando App Bundle de Release para GarrDash ==="

# Verificar que keytool existe
if ! command -v keytool &> /dev/null; then
    echo "ERROR: keytool no encontrado. Instala Java JDK primero."
    exit 1
fi

# --- 1. Build del frontend (Next.js exportacion estatica → dist/) ---
echo ""
echo "[1/4] Compilando frontend Next.js → dist/ ..."
npm run build

# --- 2. Sincronizar Capacitor (copia dist/ → android/app/src/main/assets/public/) ---
echo ""
echo "[2/4] Sincronizando Capacitor ..."
npx cap sync android

# Verificar que los assets se copiaron
ASSETS_DIR="android/app/src/main/assets/public"
if [ ! -f "$ASSETS_DIR/index.html" ]; then
    echo "ERROR: index.html no encontrado en $ASSETS_DIR"
    echo "Asegurate de que next build genero correctamente dist/index.html"
    exit 1
fi
echo "Assets verificados: $ASSETS_DIR/index.html OK"

# --- 3. Keystore ---
KEYSTORE_PATH="android/garrdash-release.keystore"
if [ ! -f "$KEYSTORE_PATH" ]; then
    echo ""
    echo "[3/4] Creando keystore de release ..."
    keytool -genkeypair -v \
        -keystore "$KEYSTORE_PATH" \
        -alias garrdash \
        -keyalg RSA \
        -keysize 2048 \
        -validity 10000 \
        -storepass garrdash2024release \
        -keypass garrdash2024release \
        -dname "CN=GarrCraft, OU=Development, O=GarrCraft, L=Madrid, ST=Madrid, C=ES"
    echo "Keystore creado: $KEYSTORE_PATH"
    echo "IMPORTANTE: Guarda este archivo y las contrasenas en un lugar seguro!"
else
    echo ""
    echo "[3/4] Keystore existente: $KEYSTORE_PATH"
fi

# --- 4. Generar AAB ---
echo ""
echo "[4/4] Generando App Bundle (Release) ..."
cd android
./gradlew clean bundleRelease

AAB="app/build/outputs/bundle/release/app-release.aab"
if [ -f "$AAB" ]; then
    echo ""
    echo "=== EXITO ==="
    echo "AAB generado en: android/$AAB"
    ls -la "$AAB"
else
    echo "ERROR: No se genero el AAB"
    exit 1
fi
