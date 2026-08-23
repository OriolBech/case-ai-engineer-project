'use client';

/**
 * Lista los MTOs procesados desde la pantalla de subida (`app/lib/mto-history-db.ts`).
 *
 * "Ver" no abre nada nuevo aquí: enlaza a `/?mto=<id>`, y es `App.tsx` quien, al detectar ese
 * parámetro, pide `/api/mto-history?id=...` e hidrata el mismo `result` que ya usa para un
 * procesamiento en caliente. Cero UI duplicada — QueueScreen, KpiPanel y TracePanel son los mismos.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppTopbar } from './AppTopbar.tsx';

interface ProcessedMtoSummary {
  id: string;
  createdAt: string;
  fileName: string;
  rowsIngested: number;
  rowsSkipped: number;
  linesCount: number;
  resolvedCount: number;
  costEur: number | null;
  pricesConfigured: boolean;
  latencyMs: number;
  llmCalls: number;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export function MtoHistoryScreen() {
  const [items, setItems] = useState<ProcessedMtoSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/mto-history');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setItems(body.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <>
      <AppTopbar />
      <div className="vocab-page">
      <div className="vocab-page-inner">
        <header className="kpi-head">
          <div>
            <h2>Histórico de MTOs procesados</h2>
            <p className="kpi-sub">
              Cada fila es un Excel subido desde la pantalla principal. No es una evaluación contra
              respuestas conocidas — para eso está el <a href="/eval-history">histórico de
              evaluación</a> — es lo que la app ya te enseñó al procesarlo, guardado para reabrirlo
              sin volver a subir el fichero.
            </p>
          </div>
        </header>

        {error && <p className="kpi-verdict">{error}</p>}

        <section className="kpi-section">
          <h3>MTOs procesados {items ? `(${items.length})` : ''}</h3>
          {!items ? (
            <p className="kpi-help">Cargando…</p>
          ) : items.length === 0 ? (
            <p className="kpi-help">Todavía no se ha procesado ningún MTO desde la app.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="vocab-table">
                <thead>
                  <tr>
                    <th>Fichero</th>
                    <th>Fecha</th>
                    <th>Filas / líneas</th>
                    <th>Resueltas</th>
                    <th>Coste</th>
                    <th>Latencia</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => {
                    const pct = it.linesCount ? Math.round((100 * it.resolvedCount) / it.linesCount) : 0;
                    return (
                      <tr key={it.id}>
                        <td>{it.fileName}</td>
                        <td>{formatDate(it.createdAt)}</td>
                        <td>{it.rowsIngested} filas · {it.linesCount} líneas</td>
                        <td>{it.resolvedCount}/{it.linesCount} ({pct}%)</td>
                        <td>{it.pricesConfigured && it.costEur !== null ? `${it.costEur.toFixed(4)} €` : '—'}</td>
                        <td>{(it.latencyMs / 1000).toFixed(1)}s</td>
                        <td><a className="wf-btn small" href={`/?mto=${encodeURIComponent(it.id)}`}>Ver</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      </div>
    </>
  );
}
