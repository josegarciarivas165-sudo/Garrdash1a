"use client"

interface AdMobBannerProps {
  variant?: "fixed-bottom" | "inline"
  className?: string
}

/**
 * Contenedor visual simulado para el banner de AdMob.
 * - fixed-bottom: barra fija al fondo del viewport (juego y menú).
 * - inline: barra dentro del flujo (usada cuando ya hay footer).
 *
 * No es un banner real: es un placeholder visual gris/negro que AdMob
 * reemplazará al integrar el SDK nativo de Android.
 */
export function AdMobBanner({ variant = "fixed-bottom", className = "" }: AdMobBannerProps) {
  const isFixed = variant === "fixed-bottom"
  const base = "bg-black/90 text-muted-foreground flex items-center justify-center text-[11px] font-medium border-t border-border/60"
  const fixed = isFixed
    ? "fixed bottom-0 left-0 right-0 h-[40px] z-30"
    : "h-[40px] w-full"

  return (
    <div
      className={`${base} ${fixed} ${className}`}
      role="complementary"
      aria-label="Espacio publicitario"
      data-ad-slot="admob-banner"
    >
      [Espacio para Banner AdMob]
    </div>
  )
}
