'use client';

/**
 * Vista de comprador: diff entre dos revisiones del histórico. SPEC-014.
 * Cuatro cubos (nuevo / desaparecido / cantidad / ambiguo) + sin cambio colapsable.
 */
import { useCallback, useEffect, useState } from 'react';
import type { IdentityParts } from '../../src/domain/identity.ts';
import type { AnnotatedRevisionDelta } from '../../src/revisions/diff-service.ts';
import { AppTopbar } from './AppTopbar.tsx';

interface DiffResponse {
  projectId: string;
  previous: { id: string; fileName: string };
  current: { id: string; fileName: string };
  summary: { added: number; removed: number; qtyChanged: number; unchanged: number; ambiguous: number };
  deltas: AnnotatedRevisionDelta[];
}

function formatParts(p: IdentityParts): string {
  const bits = [
    p.name,
    p.material,
    p.quality,
    p.measure,
    p.length,
    p.standard,
    p.finish ?? '(sin acabado)',
  ].filter(Boolean);
  return bits.join(' · ');
}

function LineRow({
  line,
  qty,
  status,
  rfqExported,
}: {
  line: { parts: IdentityParts; rowRef: string; itemRef: string | null };
  qty: number | null;
  status?: string;
  rfqExported?: boolean;
}) {
  return (
    <tr>
      <td>{line.rowRef}</td>
      <td>{formatParts(line.parts)}</td>
      <td>{qty ?? '—'}</td>
      {status !== undefined && <td><span className={`status-pill ${status === 'RESUELTA' ? 'ok' : 'warn'}`}>{status === 'RESUELTA' ? 'Resuelta' : 'En revisión'}</span></td>}
      {rfqExported !== undefined && (
        <td>{rfqExported ? <span className="status-pill ok" title="Exportado a RFQ en la revisión previa">Exportado a RFQ</span> : '—'}</td>
      )}
    </tr>
  );
}

function DeltaTable({
  title,
  deltas,
  showRfq,
}: {
  title: string;
  deltas: AnnotatedRevisionDelta[];
  showRfq?: boolean;
}) {
  if (deltas.length === 0) return null;
  return (
    <section className="kpi-section">
      <h3>{title} ({deltas.length})</h3>
      <div style={{ overflowX: 'auto' }}>
        <table className="vocab-table">
          <thead>
            <tr>
              <th>Fila</th>
              <th>Material</th>
              <th>Cantidad</th>
              {showRfq && <th>RFQ previa</th>}
            </tr>
          </thead>
          <tbody>
            {deltas.map((d, i) => {
              if (d.kind === 'added') {
                return <LineRow key={`a-${i}`} line={d.current} qty={d.current.quantity} status={d.current.status} />;
              }
              if (d.kind === 'removed') {
                return <LineRow key={`r-${i}`} line={d.previous} qty={d.previous.quantity} status={d.previous.status} />;
              }
              if (d.kind === 'qty_changed') {
                return (
                  <tr key={`q-${i}`}>
                    <td>{d.current.rowRef}</td>
                    <td>{formatParts(d.current.parts)}</td>
                    <td>{d.from ?? '—'} → {d.to ?? '—'}</td>
                    {showRfq && (
                      <td>{d.rfqExported ? <span className="status-pill ok">Exportado a RFQ</span> : '—'}</td>
                    )}
                  </tr>
                );
              }
              if (d.kind === 'ambiguous') {
                return (
                  <tr key={`x-${i}`}>
                    <td colSpan={showRfq ? 4 : 3}>
                      <p className="kpi-help" style={{ margin: '0.25rem 0' }}>
                        Huella repetida — no se puede afirmar que sea el mismo pedido.
                      </p>
                      <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                        {d.previous.map((l) => (
                          <li key={`p-${l.id}`}>Previo: fila {l.rowRef}, cant. {l.quantity ?? '—'} — {formatParts(l.parts)}</li>
                        ))}
                        {d.current.map((l) => (
                          <li key={`c-${l.id}`}>Actual: fila {l.rowRef}, cant. {l.quantity ?? '—'} — {formatParts(l.parts)}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                );
              }
              return null;
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function RevisionCompareScreen({ previousId, currentId }: { previousId: string; currentId: string }) {
  const [data, setData] = useState<DiffResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showUnchanged, setShowUnchanged] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const qs = new URLSearchParams({ previous: previousId, current: currentId });
      const res = await fetch(`/api/revisions/diff?${qs}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setData(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [previousId, currentId]);

  useEffect(() => { load(); }, [load]);

  const added = data?.deltas.filter((d) => d.kind === 'added') ?? [];
  const removed = data?.deltas.filter((d) => d.kind === 'removed') ?? [];
  const qtyChanged = data?.deltas.filter((d) => d.kind === 'qty_changed') ?? [];
  const ambiguous = data?.deltas.filter((d) => d.kind === 'ambiguous') ?? [];
  const unchanged = data?.deltas.filter((d) => d.kind === 'unchanged') ?? [];

  return (
    <>
      <AppTopbar />
      <div className="vocab-page">
        <div className="vocab-page-inner">
          <header className="kpi-head">
            <div>
              <h2>Comparar revisiones</h2>
              {data && (
                <p className="kpi-sub">
                  Proyecto <strong>{data.projectId}</strong> · previa: {data.previous.fileName} → actual: {data.current.fileName}
                </p>
              )}
            </div>
            <a className="wf-btn small" href="/mto-history">← Histórico</a>
          </header>

          {error && <p className="kpi-verdict">{error}</p>}
          {!data && !error && <p className="kpi-help">Calculando diff…</p>}

          {data && (
            <>
              <section className="kpi-section">
                <h3>Resumen</h3>
                <div className="wf-meta-inline" style={{ flexWrap: 'wrap', gap: '1rem' }}>
                  <span>Nuevo <b className="wf-num accent">{data.summary.added}</b></span>
                  <span>Desaparecido <b className="wf-num">{data.summary.removed}</b></span>
                  <span>Cantidad cambiada <b className="wf-num">{data.summary.qtyChanged}</b></span>
                  <span>Ambiguo <b className="wf-num">{data.summary.ambiguous}</b></span>
                  <span>Sin cambio <b className="wf-num">{data.summary.unchanged}</b></span>
                </div>
              </section>

              <DeltaTable title="Nuevo en la revisión actual" deltas={added} />
              <DeltaTable title="Desaparecido respecto a la previa" deltas={removed} />
              <DeltaTable title="Cantidad cambiada" deltas={qtyChanged} showRfq />
              <DeltaTable title="Ambiguo" deltas={ambiguous} />

              {unchanged.length > 0 && (
                <section className="kpi-section">
                  <h3>
                    Sin cambio ({unchanged.length})
                    <button
                      type="button"
                      className="wf-btn small"
                      style={{ marginLeft: '0.75rem' }}
                      onClick={() => setShowUnchanged((v) => !v)}
                    >
                      {showUnchanged ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </h3>
                  {showUnchanged && (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="vocab-table">
                        <thead>
                          <tr>
                            <th>Fila</th>
                            <th>Material</th>
                            <th>Cantidad</th>
                            <th>RFQ previa</th>
                          </tr>
                        </thead>
                        <tbody>
                          {unchanged.map((d, i) => {
                            if (d.kind !== 'unchanged') return null;
                            return (
                              <LineRow
                                key={`u-${i}`}
                                line={d.current}
                                qty={d.current.quantity}
                                rfqExported={d.rfqExported}
                              />
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
