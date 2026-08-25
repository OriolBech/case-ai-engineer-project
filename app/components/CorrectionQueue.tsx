'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  decideCorrection,
  getCorrectionQueue,
  type CorrectionQueueData,
} from '../lib/corrections-client.ts';
import { AppTopbar } from './AppTopbar.tsx';

const empty: CorrectionQueueData = { pending: [], approved: [], conflicts: [] };

export function CorrectionQueue() {
  const [data, setData] = useState<CorrectionQueueData>(empty);
  const [actor, setActor] = useState('compras');
  const [confirmed, setConfirmed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setData(await getCorrectionQueue());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const conflicted = useMemo(
    () =>
      new Set(
        data.conflicts.flatMap((conflict) =>
          conflict.values.map((value) => value.correctionId),
        ),
      ),
    [data.conflicts],
  );

  const act = useCallback(
    async (
      id: string,
      action: 'approve' | 'reject' | 'promote',
    ) => {
      setBusy(id);
      setError(null);
      try {
        const next = await decideCorrection({
          id,
          action,
          actor,
          regressionConfirmed: action === 'promote' ? confirmed[id] === true : undefined,
        });
        setData(next);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(null);
      }
    },
    [actor, confirmed],
  );

  return (
    <>
      <AppTopbar />
      <main className="vocab-page">
        <div className="vocab-page-inner">
          <header className="kpi-head">
            <div>
              <h2>Correcciones pendientes</h2>
              <p className="kpi-sub">
                Aprobar o rechazar conserva la traza. Promover exige confirmar una regresión
                ejecutada fuera de esta pantalla.
              </p>
            </div>
          </header>

          <label>
            Actor de esta decisión
            <input value={actor} onChange={(e) => setActor(e.target.value)} />
          </label>
          {error && <p className="kpi-verdict">{error}</p>}

          {data.conflicts.length > 0 && (
            <section className="kpi-section">
              <h3>Conflictos sin resolver ({data.conflicts.length})</h3>
              {data.conflicts.map((conflict) => (
                <p key={`${conflict.rowRef}-${conflict.attribute}-${conflict.evidence}`}>
                  Fila {conflict.rowRef} · {conflict.attribute} · «{conflict.evidence}»:{' '}
                  {conflict.values.map((value) => value.value ?? '—').join(' / ')}
                </p>
              ))}
            </section>
          )}

          <section className="kpi-section">
            <h3>Pendientes ({data.pending.length})</h3>
            <CorrectionTable
              rows={data.pending}
              conflicted={conflicted}
              busy={busy}
              onApprove={(id) => void act(id, 'approve')}
              onReject={(id) => void act(id, 'reject')}
            />
          </section>

          <section className="kpi-section">
            <h3>Aprobadas, esperando regresión ({data.approved.length})</h3>
            {data.approved.length === 0 ? (
              <p className="kpi-help">No hay correcciones listas para promover.</p>
            ) : (
              <table className="vocab-table">
                <thead>
                  <tr>
                    <th>Fila</th>
                    <th>Atributo</th>
                    <th>Alias → valor</th>
                    <th>Promoción</th>
                  </tr>
                </thead>
                <tbody>
                  {data.approved.map((row) => (
                    <tr key={row.id}>
                      <td>{row.rowRef}</td>
                      <td>{row.attribute}</td>
                      <td>
                        <code>{row.evidence}</code> → {row.correctedValue ?? '—'}
                        {conflicted.has(row.id) && <div className="vocab-warning">Conflicto sin resolver</div>}
                      </td>
                      <td>
                        <label className="vocab-check">
                          <input
                            type="checkbox"
                            checked={confirmed[row.id] ?? false}
                            onChange={(e) =>
                              setConfirmed((current) => ({
                                ...current,
                                [row.id]: e.target.checked,
                              }))
                            }
                          />
                          Regresión confirmada
                        </label>
                        <button
                          className="wf-btn primary small"
                          disabled={
                            busy === row.id ||
                            conflicted.has(row.id) ||
                            !actor.trim() ||
                            !confirmed[row.id]
                          }
                          onClick={() => void act(row.id, 'promote')}
                        >
                          Promover
                        </button>{' '}
                        <button
                          className="wf-btn small"
                          disabled={busy === row.id || !actor.trim()}
                          onClick={() => void act(row.id, 'reject')}
                        >
                          Rechazar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </main>
    </>
  );
}

function CorrectionTable({
  rows,
  conflicted,
  busy,
  onApprove,
  onReject,
}: {
  rows: CorrectionQueueData['pending'];
  conflicted: Set<string>;
  busy: string | null;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  if (rows.length === 0) return <p className="kpi-help">No hay correcciones pendientes.</p>;
  return (
    <table className="vocab-table">
      <thead>
        <tr>
          <th>Fila</th>
          <th>Atributo</th>
          <th>Anterior → corregido</th>
          <th>Evidencia</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.rowRef}</td>
            <td>{row.attribute}</td>
            <td>
              {row.previousValue ?? '—'} → {row.correctedValue ?? '—'}
              {conflicted.has(row.id) && <div className="vocab-warning">Conflicto</div>}
            </td>
            <td>
              <code>{row.evidence}</code>
              <div className="kpi-help">{row.rationale}</div>
            </td>
            <td>
              <button
                className="wf-btn primary small"
                disabled={busy === row.id}
                onClick={() => onApprove(row.id)}
              >
                Aprobar
              </button>{' '}
              <button
                className="wf-btn small"
                disabled={busy === row.id}
                onClick={() => onReject(row.id)}
              >
                Rechazar
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
