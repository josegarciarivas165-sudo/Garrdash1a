import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'GarrDash - Runner Arcade',
  description:
    'Corre, salta obstaculos y acumula monedas para canjear diamantes.',
  viewport:
    'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover',
  themeColor: '#0b1020',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <head />
      <body style={{ fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        {children}
      </body>
    </html>
  );
}
