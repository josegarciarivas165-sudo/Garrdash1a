"use client"

/**
 * Sistema de audio GarrDash — engine limpio sin distorsión.
 *
 * Diagnóstico previo: la distorsión venía de:
 *  1. Osciladores sawtooth con armónicos agresivos sin filtrar bien.
 *  2. Suma de capas (drone + bass + arp + sub) que excede 1.0 → clipping.
 *  3. Sin DynamicsCompressor/limiter antes del destination.
 *
 * Solución aplicada:
 *  - Solo ondas sine/triangle (sin sawtooth saturado).
 *  - Cada capa con su propio filtro pasa-bajos y volumen conservador.
 *  - Limiter (DynamicsCompressor con threshold bajo) antes del destination.
 *  - masterGain a 0.6, buses bajos (bgmBus 0.4, sfxBus 0.5).
 *  - Sample rate: se respeta el nativo del dispositivo (no se fuerza).
 *
 * No hay archivos MP3/OGG externos: todo se sintetiza con Web Audio API,
 * original y libre de copyright.
 */

const MUTE_KEY = "garrdash:muted"

let muted = false
try {
  muted = localStorage.getItem(MUTE_KEY) === "1"
} catch {
  /* ignore */
}

let audioCtx: AudioContext | null = null
let bgmNodes: { stop: () => void } | null = null
let masterGain: GainNode | null = null
let limiter: DynamicsCompressorNode | null = null
let bgmBus: GainNode | null = null
let sfxBus: GainNode | null = null
let noiseBuffer: AudioBuffer | null = null
let currentTrack: "menu" | "game" | null = null

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (audioCtx) {
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {})
    return audioCtx
  }
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  try {
    audioCtx = new AC()

    // Cadena de master: buses -> masterGain -> limiter -> destination.
    // El limiter (DynamicsCompressor) previene clipping cuando la suma
    // de capas excede 1.0, eliminando la distorsión audible.
    limiter = audioCtx.createDynamicsCompressor()
    limiter.threshold.value = -10   // actúa antes de saturar
    limiter.knee.value = 6          // transición suave
    limiter.ratio.value = 12        // compresión firme
    limiter.attack.value = 0.003    // rápido
    limiter.release.value = 0.25    // liberación natural
    limiter.connect(audioCtx.destination)

    masterGain = audioCtx.createGain()
    masterGain.gain.value = muted ? 0 : 0.6
    masterGain.connect(limiter)

    bgmBus = audioCtx.createGain()
    bgmBus.gain.value = 0.4
    bgmBus.connect(masterGain)

    sfxBus = audioCtx.createGain()
    sfxBus.gain.value = 0.5
    sfxBus.connect(masterGain)

    // Buffer de ruido blanco precargado (SFX de choque/hi-hat sin lag).
    const len = Math.floor(audioCtx.sampleRate * 0.5)
    noiseBuffer = audioCtx.createBuffer(1, len, audioCtx.sampleRate)
    const data = noiseBuffer.getChannelData(0)
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1
  } catch {
    return null
  }
  return audioCtx
}

export function unlockAudio() {
  const ctx = getCtx()
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {})
}

export function isMuted() {
  return muted
}

export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(MUTE_KEY, next ? "1" : "0")
  } catch {
    /* ignore */
  }
  const ctx = getCtx()
  if (masterGain && ctx) {
    masterGain.gain.setTargetAtTime(next ? 0 : 0.6, ctx.currentTime, 0.02)
  }
  if (next) stopBgm()
  currentTrack = null
  return muted
}

function buildReverb(ctx: AudioContext, out: GainNode) {
  const reverb = ctx.createConvolver()
  const impulseLen = Math.floor(ctx.sampleRate * 1.8)
  const impulse = ctx.createBuffer(2, impulseLen, ctx.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const chData = impulse.getChannelData(ch)
    for (let i = 0; i < impulseLen; i++) {
      chData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / impulseLen, 3)
    }
  }
  reverb.buffer = impulse
  const reverbGain = ctx.createGain()
  reverbGain.gain.value = 0.25
  out.connect(reverb)
  reverb.connect(reverbGain)
  reverbGain.connect(out)
  return reverb
}

/**
 * Construye un track de BGM limpio (solo sine/triangle, sin sawtooth).
 * track="menu": ambient pad suave en Do menor.
 * track="game": cyberpunk ambiental en Re menor con bajo pulsante + arpegio.
 */
function buildTrack(ctx: AudioContext, track: "menu" | "game", out: GainNode) {
  buildReverb(ctx, out)

  if (track === "menu") {
    // === TRACK A: ambient menú (sine pad, sin saturación) ===
    const droneFreqs = [65.41, 98.0] // C2, G2
    const droneFilter = ctx.createBiquadFilter()
    droneFilter.type = "lowpass"
    droneFilter.frequency.value = 600
    droneFilter.Q.value = 0.7
    const droneGain = ctx.createGain()
    droneGain.gain.value = 0.12
    const droneOscs: OscillatorNode[] = []
    droneFreqs.forEach((f, i) => {
      const osc = ctx.createOscillator()
      osc.type = "sine" // solo sine: sin armónicos saturados
      osc.frequency.value = f
      osc.detune.value = i === 0 ? -3 : 3
      osc.connect(droneFilter)
      osc.start()
      droneOscs.push(osc)
    })
    droneFilter.connect(droneGain)
    droneGain.connect(out)

    const scale = [261.63, 311.13, 392.0, 466.16, 523.25]
    const pattern = [0, 2, 4, 2, 3, 1, 2, 0]
    let step = 0
    const arpInterval = window.setInterval(() => {
      const c = getCtx()
      if (!c || !bgmBus || muted) return
      const freq = scale[pattern[step % pattern.length]]
      step++
      const osc = c.createOscillator()
      const g = c.createGain()
      const filt = c.createBiquadFilter()
      osc.type = "sine"
      osc.frequency.value = freq
      filt.type = "lowpass"
      filt.frequency.value = 1600
      const now = c.currentTime
      g.gain.setValueAtTime(0, now)
      g.gain.linearRampToValueAtTime(0.07, now + 0.03)
      g.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)
      osc.connect(filt)
      filt.connect(g)
      g.connect(out)
      osc.start(now)
      osc.stop(now + 1.5)
    }, 900)

    return {
      stop: () => {
        window.clearInterval(arpInterval)
        try {
          const now = ctx.currentTime
          out.gain.setTargetAtTime(0, now, 0.4)
          droneOscs.forEach((o) => o.stop(now + 1.2))
        } catch {
          /* ignore */
        }
      },
    }
  }

  // === TRACK B: cyberpunk ambiental limpio (juego) ===
  const droneFreqs = [73.42, 110.0] // D2, A2
  const droneOscs: OscillatorNode[] = []
  const droneFilter = ctx.createBiquadFilter()
  droneFilter.type = "lowpass"
  droneFilter.frequency.value = 700
  droneFilter.Q.value = 0.8
  const droneGain = ctx.createGain()
  droneGain.gain.value = 0.11
  droneFreqs.forEach((f, i) => {
    const osc = ctx.createOscillator()
    osc.type = "sine"
    osc.frequency.value = f
    osc.detune.value = i === 0 ? -3 : 3
    osc.connect(droneFilter)
    osc.start()
    droneOscs.push(osc)
  })
  droneFilter.connect(droneGain)
  droneGain.connect(out)

  // Bajo pulsante triangle (suave) con LFO de volumen.
  const bassOsc = ctx.createOscillator()
  const bassGain = ctx.createGain()
  bassOsc.type = "triangle"
  bassOsc.frequency.value = 73.42
  bassGain.gain.value = 0.10
  const bassLfo = ctx.createOscillator()
  const bassLfoGain = ctx.createGain()
  bassLfo.type = "sine"
  bassLfo.frequency.value = 1.6
  bassLfoGain.gain.value = 0.06
  bassLfo.connect(bassLfoGain)
  bassLfoGain.connect(bassGain.gain)
  const bassFilter = ctx.createBiquadFilter()
  bassFilter.type = "lowpass"
  bassFilter.frequency.value = 350
  bassOsc.connect(bassFilter)
  bassFilter.connect(bassGain)
  bassGain.connect(out)
  bassOsc.start()
  bassLfo.start()

  // Arpegio lento en pentatónica de Dm (sine limpio).
  const scale = [293.66, 349.23, 440.0, 523.25, 587.33]
  const pattern = [0, 2, 4, 2, 1, 3, 2, 0]
  let step = 0
  const arpInterval = window.setInterval(() => {
    const c = getCtx()
    if (!c || !bgmBus || muted) return
    const freq = scale[pattern[step % pattern.length]]
    step++
    const osc = c.createOscillator()
    const g = c.createGain()
    const filt = c.createBiquadFilter()
    osc.type = "sine"
    osc.frequency.value = freq
    filt.type = "lowpass"
    filt.frequency.value = 1800
    const now = c.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.08, now + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    osc.connect(filt)
    filt.connect(g)
    g.connect(out)
    osc.start(now)
    osc.stop(now + 1.0)
  }, 650)

  // Sub-bass esporádico (sine puro, muy bajo volumen).
  let subCount = 0
  const subInterval = window.setInterval(() => {
    subCount++
    if (subCount % 8 !== 0) return
    const c = getCtx()
    if (!c || !bgmBus || muted) return
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = "sine"
    osc.frequency.value = 36.71
    const now = c.currentTime
    g.gain.setValueAtTime(0, now)
    g.gain.linearRampToValueAtTime(0.08, now + 0.05)
    g.gain.exponentialRampToValueAtTime(0.0001, now + 1.5)
    osc.connect(g)
    g.connect(out)
    osc.start(now)
    osc.stop(now + 1.6)
  }, 1300)

  return {
    stop: () => {
      window.clearInterval(arpInterval)
      window.clearInterval(subInterval)
      try {
        const now = ctx.currentTime
        out.gain.setTargetAtTime(0, now, 0.2)
        droneOscs.forEach((o) => o.stop(now + 0.6))
        bassOsc.stop(now + 0.6)
        bassLfo.stop(now + 0.6)
      } catch {
        /* ignore */
      }
    },
  }
}

export function startBgm(track: "menu" | "game" = "game") {
  const ctx = getCtx()
  if (!ctx || !bgmBus) return
  if (muted) return
  if (bgmNodes && currentTrack === track) return
  if (bgmNodes) {
    const old = bgmNodes
    old.stop()
    bgmNodes = null
  }

  const out = ctx.createGain()
  out.gain.value = 0
  out.connect(bgmBus)
  out.gain.setTargetAtTime(1, ctx.currentTime, track === "menu" ? 1.6 : 1.2)

  bgmNodes = buildTrack(ctx, track, out)
  currentTrack = track
}

export function setScene(scene: "menu" | "game") {
  const ctx = getCtx()
  if (!ctx) return
  if (muted) return
  if (currentTrack === scene) return
  startBgm(scene)
}

export function stopBgm() {
  if (!bgmNodes) return
  bgmNodes.stop()
  bgmNodes = null
  currentTrack = null
}

function tone(freq: number, durationMs: number, type: OscillatorType, vol: number, startOffsetSec = 0) {
  if (muted) return
  const ctx = getCtx()
  if (!ctx || !sfxBus) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const filt = ctx.createBiquadFilter()
  osc.type = type
  osc.frequency.value = freq
  filt.type = "lowpass"
  filt.frequency.value = Math.min(4000, freq * 4)
  const start = ctx.currentTime + startOffsetSec
  const dur = durationMs / 1000
  g.gain.setValueAtTime(0, start)
  g.gain.linearRampToValueAtTime(vol, start + 0.004)
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
  osc.connect(filt)
  filt.connect(g)
  g.connect(sfxBus)
  osc.start(start)
  osc.stop(start + dur + 0.02)
}

export function playJumpSfx() {
  if (muted) return
  const ctx = getCtx()
  if (!ctx || !sfxBus) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  const filt = ctx.createBiquadFilter()
  osc.type = "sine"
  filt.type = "lowpass"
  filt.frequency.value = 2000
  const now = ctx.currentTime
  osc.frequency.setValueAtTime(440, now)
  osc.frequency.exponentialRampToValueAtTime(720, now + 0.10)
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.08, now + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12)
  osc.connect(filt)
  filt.connect(g)
  g.connect(sfxBus)
  osc.start(now)
  osc.stop(now + 0.15)
}

export function playCoinSfx() {
  tone(880, 70, "sine", 0.07, 0)
  tone(1175, 110, "sine", 0.07, 0.07)
}

export function playHitSfx() {
  if (muted) return
  const ctx = getCtx()
  if (!ctx || !sfxBus || !noiseBuffer) return
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const lp = ctx.createBiquadFilter()
  lp.type = "lowpass"
  const now = ctx.currentTime
  lp.frequency.setValueAtTime(600, now)
  lp.frequency.exponentialRampToValueAtTime(100, now + 0.25)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.15, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3)
  noise.connect(lp)
  lp.connect(g)
  g.connect(sfxBus)
  noise.start()
  noise.stop(now + 0.35)
}

export function playButtonSfx() {
  tone(520, 35, "sine", 0.05)
}

export function playShootSfx() {
  if (muted) return
  const ctx = getCtx()
  if (!ctx || !sfxBus) return
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = "square"
  const now = ctx.currentTime
  osc.frequency.setValueAtTime(880, now)
  osc.frequency.exponentialRampToValueAtTime(220, now + 0.08)
  g.gain.setValueAtTime(0, now)
  g.gain.linearRampToValueAtTime(0.06, now + 0.005)
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.08)
  const filt = ctx.createBiquadFilter()
  filt.type = "lowpass"
  filt.frequency.value = 2000
  osc.connect(filt)
  filt.connect(g)
  g.connect(sfxBus)
  osc.start(now)
  osc.stop(now + 0.1)
}

export function playExplosionSfx() {
  if (muted) return
  const ctx = getCtx()
  if (!ctx || !sfxBus || !noiseBuffer) return
  const noise = ctx.createBufferSource()
  noise.buffer = noiseBuffer
  const lp = ctx.createBiquadFilter()
  lp.type = "lowpass"
  const now = ctx.currentTime
  lp.frequency.setValueAtTime(1200, now)
  lp.frequency.exponentialRampToValueAtTime(80, now + 0.35)
  const g = ctx.createGain()
  g.gain.setValueAtTime(0.18, now)
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4)
  noise.connect(lp)
  lp.connect(g)
  g.connect(sfxBus)
  noise.start()
  noise.stop(now + 0.45)
}
