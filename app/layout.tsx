import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Reconciliación de MTOs · Tornillería',
  description: 'Extracción y normalización de líneas de tornillería a partir de MTOs de ingeniería.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body style={{ '--logo-mask': "url('/logo-sapira.svg')" } as React.CSSProperties}>
        {children}
      </body>
    </html>
  );
}
