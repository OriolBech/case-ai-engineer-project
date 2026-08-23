'use client';

/**
 * Shell de topbar compartido por las seis pantallas de la app: subida, resultado en caliente,
 * y las cuatro páginas satélite (Cómo funciona, Vocabulario, Histórico de MTOs, Histórico de
 * evaluación). Antes cada página satélite era un callejón sin salida — sólo un "← Volver" a "/" — y
 * la única forma de llegar a otra sección era pasar por ahí. Con la marca como enlace a inicio y
 * las mismas pestañas (`AppNav`) en todas partes, cualquier página es un salto directo a cualquier
 * otra.
 *
 * `right` es lo único que cambia entre montajes: los botones de acción de la pantalla de resultado
 * (Cómo ha ido, Nuevo MTO), nada en las demás. Las stats en vivo y el nombre del fichero NO viven
 * aquí: apretaban la topbar contra las pestañas y los botones. Van en `.wf-section-head`, la
 * cabecera de contenido justo debajo — ver `App.tsx`.
 */
import type { ReactNode } from 'react';
import { AppNav } from './AppNav.tsx';

export function AppTopbar({ right }: { right?: ReactNode }) {
  return (
    <header className="wf-topbar">
      <div className="wf-topbar-inner">
        <a href="/" className="wf-brand">
          <span className="wf-logo-mark" aria-hidden />
          <span className="wf-brand-name">Tornillería</span>
        </a>
        <AppNav />
        <div className="wf-topbar-right">{right}</div>
      </div>
    </header>
  );
}
