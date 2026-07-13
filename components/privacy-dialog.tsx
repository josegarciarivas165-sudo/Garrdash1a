"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Shield } from "lucide-react"

const PRIVACY_FULL_TEXT = `Política de Privacidad de GarrDash

Última actualización: junio 2026

1. RESPONSABLE DEL TRATAMIENTO
El responsable del tratamiento de tus datos personales es GarrDash ("nosotros", "nuestro"). Esta app funciona sobre Firebase (Google), por lo que los datos se almacenan en los servidores de Google bajo sus reglas de seguridad.

2. DATOS QUE RECOPILAMOS
Al registrarte solicitamos:
• Nombre
• Edad
• Nacionalidad
• Correo electrónico
• Contraseña (almacenada como hash por Firebase Authentication, nunca en texto plano)

Durante el juego registramos:
• Monedas, Puntos de Canje y Diamantes
• Record de puntuacion y partidas jugadas
• Estado de canje de premios

3. FINALIDAD DEL TRATAMIENTO
Tus datos se usan UNICAMENTE para:
• Funcionamiento del Top Global de GarrDash.
• Entrega segura de los premios (diamantes) cuando canjeas.
• Autenticacion y recuperacion de cuenta.

4. NO VENDEMOS NI COMPARTIMOS
No vendemos ni compartimos tu información personal con terceros con fines publicitarios. La app solo muestra anuncios a través de AdMob, que es un proveedor de anuncios de Google y trata datos según su propia política, independientemente de los datos que tú nos proporcionas.

5. SEGURIDAD
Todos los datos se almacenan en Firebase bajo reglas de seguridad estrictas de Firestore. El acceso a tu documento de usuario está restringido a tu propia cuenta. Nadie más puede leer ni modificar tus datos.

6. ANTI-CHEAT
Para proteger la integridad del juego y la economía de diamantes, GarrDash implementa un sistema anti-cheat que detecta incrementos imposibles de monedas. Si se detecta actividad sospechosa, la cuenta se congela por seguridad y el guardado en Firebase se bloquea para proteger a usuarios legítimos.

7. RETENCIÓN Y ELIMINACIÓN
Tus datos se conservan mientras tu cuenta esté activa. Puedes solicitar la eliminación de tu cuenta y de todos tus datos asociados en cualquier momento escribiendo a soporte. Tu derecho de eliminación no aplica si el anticheat detectó actividad fraudulenta (en cuyo caso los datos se conservan como evidencia durante el periodo legal aplicable).

8. DERECHOS DEL USUARIO
Puedes ejercer tus derechos de acceso, rectificación, eliminación y oposición escribiéndonos. Responderemos en un plazo máximo de 30 días.

9. MENORES
GarrDash no está dirigido a menores de 8 años. Al registrarte confirmas que tienes al menos 8 años, o que cuentas con autorización de un padre o tutor legal.

10. CONTACTO
Si tienes cualquier duda sobre esta política, puedes contactarnos a través de la sección de soporte de la app.`

export function PrivacyDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85dvh] max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <Shield className="size-5" aria-hidden /> Política de Privacidad Completa
          </DialogTitle>
          <DialogDescription>
            GarrDash · Última actualización: junio 2026
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55dvh] pr-4">
          <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-muted-foreground">
            {PRIVACY_FULL_TEXT}
          </pre>
        </ScrollArea>
        <Button onClick={() => onOpenChange(false)} className="gap-2 bg-primary font-bold text-primary-foreground hover:bg-primary/90">
          Entendido
        </Button>
      </DialogContent>
    </Dialog>
  )
}
