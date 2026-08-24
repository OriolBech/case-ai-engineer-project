'use client';

/**
 * Las pestañas de navegación entre secciones, `.wf-tab` del design system (§7.3): subrayado al
 * activarse, sin caja. Antes cada pantalla repetía su propia lista de `<a className="wf-btn small">`
 * — el mismo estilo que un botón de acción — y sólo existía en dos de las seis pantallas de la app.
 * Un único componente montado en todas ellas es lo que hace posible saltar entre secciones sin
 * pasar siempre por "/".
 *
 * "Evaluación" no está aquí a propósito: sigue siendo una pantalla real (`/eval-history`), pero el
 * usuario pidió explícitamente sacarla de la navegación principal.
 *
 * El activo se calcula leyendo `window.location.pathname` en un efecto, no con `usePathname` de
 * `next/navigation`: toda la navegación de la app ya son `<a>` normales (recarga completa, sin
 * router de cliente), así que el hook no aportaría nada que el propio `location` no diga ya.
 */
import { useEffect, useState } from 'react';

const TABS = [
  { href: '/como-funciona', label: 'Cómo funciona' },
  { href: '/vocabulario', label: 'Vocabulario' },
  { href: '/mto-history', label: 'Histórico' },
];

export function AppNav() {
  const [pathname, setPathname] = useState<string | null>(null);
  useEffect(() => { setPathname(window.location.pathname); }, []);

  return (
    <nav className="wf-tabs">
      {TABS.map((t) => (
        <a key={t.href} href={t.href} className={`wf-tab${pathname === t.href ? ' active' : ''}`}>
          {t.label}
        </a>
      ))}
    </nav>
  );
}
