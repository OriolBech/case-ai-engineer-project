'use client';

/**
 * Front sobre el histórico de evaluación (SPEC-010, `src/eval/history/`).
 *
 * Sólo lectura: lista ejecuciones guardadas con `pnpm run eval -- --save` y compara dos. No dispara
 * ninguna evaluación ni escribe nada — llama a `/api/eval-history*`, que son fachadas de `listRuns`
 * y `compareRuns`. Guardar una ejecución nueva sigue siendo cosa de la CLI, igual que dice
 * SPEC-010: la primera interfaz de este componente es la CLI, y esto es sólo una ventana sobre ella.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppTopbar } from './AppTopbar.tsx';

interface StoredRun {
  id: string;
  createdAt: string;
  label: string | null;
  datasetName: string;
  datasetFingerprint: string;
  gitCommit: string | null;
  gitDirty: boolean;
  model: string;
  provider: string;
  routing: string;
  criticRouting: string;
  rows: number;
  goldLines: number;
  systemLines: number;
  latencyMs: number;
  costEur: number | null;
  pricesConfigured: boolean;
}

interface MetricComparison {
  name: string;
  base: number;
  candidate: number;
  delta: number;
  direction: 'improved' | 'regressed' | 'unchanged';
  baseNumerator: number | null;
  baseDenominator: number | null;
  candidateNumerator: number | null;
  candidateDenominator: number | null;
}

interface ChangedLine {
  rowRef: string;
  goldId: string | null;
  change: 'fixed' | 'regressed' | 'status_changed' | 'split_changed';
  details: string[];
}

interface Comparison {
  baseRunId: string;
  candidateRunId: string;
  comparable: boolean;
  incompatibilities: string[];
  metrics: MetricComparison[];
  changedLines: ChangedLine[];
}

/** Regresiones primero: es lo que hay que mirar antes de nada. */
const CHANGE_ORDER: Record<ChangedLine['change'], number> = { regressed: 0, split_changed: 1, status_changed: 2, fixed: 3 };
const CHANGE_LABEL: Record<ChangedLine['change'], string> = {
  fixed: 'corregida', regressed: 'regresión', status_changed: 'cambio de estado', split_changed: 'cambio de split',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' });
}

export function EvalHistoryScreen() {
  const [runs, setRuns] = useState<StoredRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [baseId, setBaseId] = useState<string | null>(null);
  const [candidateId, setCandidateId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [comparing, setComparing] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/eval-history');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRuns(body.runs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const compare = useCallback(async () => {
    if (!baseId || !candidateId) return;
    setComparing(true);
    setError(null);
    setComparison(null);
    try {
      const res = await fetch(`/api/eval-history/compare?base=${encodeURIComponent(baseId)}&candidate=${encodeURIComponent(candidateId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setComparison(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setComparing(false);
    }
  }, [baseId, candidateId]);

  return (
    <>
      <AppTopbar />
      <div className="vocab-page">
      <div className="vocab-page-inner">
        <header className="kpi-head">
          <div>
            <h2>Histórico de evaluación</h2>
            <p className="kpi-sub">
              Cada fila es una ejecución guardada con <code>pnpm run eval -- --save</code>: dataset,
              políticas, coste y resultado por línea, tal como quedaron en ese momento. Esta pantalla
              sólo consulta el histórico — guardar una ejecución nueva sigue siendo un comando de la
              CLI, no un botón de aquí.
            </p>
          </div>
        </header>

        {error && <p className="kpi-verdict">{error}</p>}

        <section className="kpi-section">
          <h3>Ejecuciones guardadas {runs ? `(${runs.length})` : ''}</h3>
          {!runs ? (
            <p className="kpi-help">Cargando…</p>
          ) : runs.length === 0 ? (
            <p className="kpi-help">
              Histórico vacío todavía. Guarda la primera ejecución con <code>pnpm run eval -- --save</code>.
            </p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="vocab-table">
                <thead>
                  <tr>
                    <th>Base</th>
                    <th>Candidata</th>
                    <th>Ejecución</th>
                    <th>Fecha</th>
                    <th>Commit</th>
                    <th>Modelo</th>
                    <th>Dataset</th>
                    <th>Coste</th>
                    <th>Latencia</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id}>
                      <td><input type="radio" name="base" aria-label="Usar como base" checked={baseId === r.id} onChange={() => setBaseId(r.id)} /></td>
                      <td><input type="radio" name="candidate" aria-label="Usar como candidata" checked={candidateId === r.id} onChange={() => setCandidateId(r.id)} /></td>
                      <td>
                        <code title={r.id}>{r.id.slice(0, 8)}</code>
                        {r.label && <div className="kpi-help">{r.label}</div>}
                      </td>
                      <td>{formatDate(r.createdAt)}</td>
                      <td>
                        {r.gitCommit ? r.gitCommit.slice(0, 10) : '(sin commit)'}
                        {r.gitDirty && <span className="badge review" style={{ marginLeft: 6 }}><span className="dot" />dirty</span>}
                      </td>
                      <td>
                        {r.model}
                        <div className="kpi-help">{r.routing} · crítico {r.criticRouting}</div>
                      </td>
                      <td>
                        <code title={r.datasetFingerprint}>{r.datasetFingerprint.slice(0, 10)}…</code>
                        <div className="kpi-help">gold {r.goldLines} · sistema {r.systemLines}</div>
                      </td>
                      <td>{r.pricesConfigured && r.costEur !== null ? `${r.costEur.toFixed(4)} €` : '—'}</td>
                      <td>{(r.latencyMs / 1000).toFixed(1)}s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {runs && runs.length >= 2 && (
            <div style={{ marginTop: '0.9rem' }}>
              <button className="wf-btn primary" disabled={!baseId || !candidateId || comparing} onClick={compare}>
                {comparing ? 'Comparando…' : 'Comparar seleccionadas'}
              </button>
              {(!baseId || !candidateId) && <span className="kpi-help" style={{ marginLeft: '0.6rem' }}>Marca una base y una candidata.</span>}
            </div>
          )}
        </section>

        {comparison && (
          <section className="kpi-section">
            <h3>Comparación</h3>

            {!comparison.comparable && (
              <div className="kpi-alarm">
                <strong>No comparable</strong>
                <ul>
                  {comparison.incompatibilities.map((i) => <li key={i}>{i}</li>)}
                </ul>
                <p className="kpi-help" style={{ margin: '0.4rem 0 0' }}>
                  Se muestran los números igualmente, pero ninguno se declara mejora ni regresión.
                </p>
              </div>
            )}

            <div className="kpi-rows">
              {comparison.metrics.map((m) => (
                <div className="kpi-row wide" key={m.name}>
                  <span className="kpi-row-label"><code>{m.name}</code></span>
                  <span className="kpi-row-pct">
                    {m.base.toFixed(2)} → {m.candidate.toFixed(2)}
                    {m.baseDenominator !== null && (
                      <> &nbsp;[{m.baseNumerator}/{m.baseDenominator} → {m.candidateNumerator}/{m.candidateDenominator}]</>
                    )}
                  </span>
                  <span className={`badge ${m.direction === 'improved' ? 'confirmed' : m.direction === 'regressed' ? 'review' : ''}`}>
                    <span className="dot" />
                    {m.direction === 'improved' ? 'mejora' : m.direction === 'regressed' ? 'regresión' : 'igual'}
                  </span>
                </div>
              ))}
            </div>

            <div className="kpi-cant">
              <h3 style={{ marginTop: 0 }}>Líneas que explican el delta ({comparison.changedLines.length})</h3>
              {comparison.changedLines.length === 0 ? (
                <p className="kpi-help">Ninguna línea cambió de estado o de resultado entre ambas ejecuciones.</p>
              ) : (
                <ul className="kpi-cant-list">
                  {[...comparison.changedLines]
                    .sort((a, b) => CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change])
                    .map((l, i) => (
                      <li key={`${l.rowRef}-${l.goldId ?? ''}-${i}`}>
                        <strong>{CHANGE_LABEL[l.change]}</strong> — fila {l.rowRef}, gold <code>{l.goldId ?? '?'}</code>
                        {l.details.length > 0 && <>: {l.details.join('; ')}</>}
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </section>
        )}
      </div>
      </div>
    </>
  );
}
