'use client';

import { useCallback, useEffect, useState } from 'react';
import type { KpiDashboard } from '../../src/kpi/metrics.ts';
import { AppTopbar } from './AppTopbar.tsx';
import { LifecycleKpiSection } from './LifecycleKpiSection.tsx';

function pct(value: number): string {
  return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%`;
}

function eur(value: number, decimals = 2): string {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

function minutes(value: number): string {
  if (value < 60) return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} min`;
  return `${(value / 60).toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
}

function Status({ kind }: { kind: 'measured' | 'target' | 'unavailable' }) {
  const labels = { measured: 'Medido', target: 'Objetivo', unavailable: 'No disponible' };
  return <span className={`kpi-source ${kind}`}>{labels[kind]}</span>;
}

function EmptyCard({ label, detail }: { label: string; detail?: string }) {
  return (
    <div className="kpi-cell">
      <div><Status kind="unavailable" /></div>
      <span className="kpi-num">—</span>
      <span className="kpi-cap">{label}</span>
      <span className="kpi-help">
        {detail ?? 'Todavía no hay una ejecución guardada que permita calcularlo.'}
      </span>
    </div>
  );
}

export function KpiDashboardScreen() {
  const [data, setData] = useState<KpiDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch('/api/kpis');
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setData(body as KpiDashboard);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const evaluation = data?.evaluation ?? null;
  const correction = data?.corrections ?? null;

  return (
    <>
      <AppTopbar />
      <main className="vocab-page">
        <div className="vocab-page-inner kpi-dashboard">
          <header className="kpi-head">
            <div>
              <h2>Resultados y compromiso</h2>
              <p className="kpi-sub">
                Separamos lo medido, los objetivos y lo que todavía no tiene muestra. La calidad usa
                la última evaluación guardada; nunca se atribuye al MTO abierto sin una respuesta de referencia.
              </p>
            </div>
          </header>

          {error && <p className="kpi-verdict">{error}</p>}
          {!data && !error && <p className="kpi-help">Cargando resultados…</p>}

          {data && (
            <>
              <section className="kpi-section">
                <h3>Calidad verificada</h3>
                <p className="kpi-note">
                  <Status kind="target" /> Compromiso: cero errores silenciosos sobre datos decididos
                  por el cliente. La autonomía es un resultado, no una promesa.
                </p>
                {evaluation ? (
                  <p className="kpi-note">
                    <Status kind="measured" /> Última evaluación: {new Date(evaluation.run.createdAt).toLocaleString('es-ES')}
                    {' · '}{evaluation.run.model} · {evaluation.run.rows} filas y {evaluation.run.goldLines} líneas de referencia.
                    {evaluation.run.label && <> Etiqueta: <strong>{evaluation.run.label}</strong>.</>}
                  </p>
                ) : (
                  <p className="kpi-verdict">
                    <Status kind="unavailable" /> No hay evaluaciones guardadas. Guarda una con
                    {' '}<code>pnpm run eval -- --save</code>; hasta entonces no se muestran ceros como si fueran resultados.
                  </p>
                )}

                <div className="kpi-grid">
                  {evaluation?.silentError ? (
                    <div className="kpi-cell">
                      <div><Status kind="measured" /></div>
                      <span className="kpi-num">{pct(evaluation.silentError.pct)}</span>
                      <span className="kpi-cap">error silencioso</span>
                      <span className="kpi-help">
                        {evaluation.silentError.count} errores entre {evaluation.silentError.resolved} líneas resueltas.
                        Tasa y recuento se leen juntos.
                      </span>
                    </div>
                  ) : <EmptyCard label="error silencioso" />}

                  {evaluation?.usefulAutonomy ? (
                    <div className="kpi-cell">
                      <div><Status kind="measured" /></div>
                      <span className="kpi-num">{pct(evaluation.usefulAutonomy.pct)}</span>
                      <span className="kpi-cap">autonomía útil</span>
                      <span className="kpi-help">
                        {evaluation.usefulAutonomy.count} líneas resueltas y correctas de {evaluation.usefulAutonomy.total}.
                      </span>
                    </div>
                  ) : <EmptyCard label="autonomía útil" />}

                  {evaluation?.splitFidelity ? (
                    <div className="kpi-cell">
                      <div><Status kind="measured" /></div>
                      <span className="kpi-num">{pct(evaluation.splitFidelity.pct)}</span>
                      <span className="kpi-cap">separación correcta de conjuntos</span>
                      <span className="kpi-help">
                        {evaluation.splitFidelity.count} de {evaluation.splitFidelity.total} filas produjeron el número correcto de materiales.
                      </span>
                    </div>
                  ) : <EmptyCard label="separación de conjuntos" />}

                  {evaluation?.queueNoise ? (
                    <div className="kpi-cell">
                      <div><Status kind="measured" /></div>
                      <span className="kpi-num">{pct(evaluation.queueNoise.pct)}</span>
                      <span className="kpi-cap">ruido en la cola</span>
                      <span className="kpi-help">
                        {evaluation.queueNoise.count} revisiones innecesarias entre {evaluation.queueNoise.total} líneas enviadas a revisión.
                      </span>
                    </div>
                  ) : <EmptyCard label="ruido en la cola" />}
                </div>
              </section>

              <LifecycleKpiSection lifecycle={data.lifecycle} onSaved={reload} />

              <section className="kpi-section">
                <h3>Acierto por dato</h3>
                {evaluation && evaluation.attributes.length > 0 ? (
                  <div className="kpi-rows">
                    {evaluation.attributes.map((attribute) => (
                      <div className="kpi-row" key={attribute.attribute}>
                        <span className="kpi-row-label">{attribute.label}</span>
                        <div className="kpi-bar">
                          <div className="kpi-bar-fill ok" style={{ width: `${attribute.pct}%` }} />
                        </div>
                        <span className="kpi-row-value">
                          {pct(attribute.pct)} <small>({attribute.count}/{attribute.total})</small>
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="kpi-verdict">
                    <Status kind="unavailable" /> No hay desglose por atributo guardado. La cantidad
                    aparecerá aquí como la octava celda cuando exista una evaluación completa.
                  </p>
                )}
              </section>

              <section className="kpi-section">
                <h3>Coste, capacidad y trabajo evitado</h3>
                <p className="kpi-note">
                  <Status kind="target" /> Coste ≤0,0001 € por fila leída y ≤50 € por una obra de
                  500.000 lecturas. El tiempo para 1.000 filas se informa con cautela, no como SLA.
                </p>
                <div className="kpi-grid">
                  {evaluation?.cost ? (
                    <>
                      <div className="kpi-cell">
                        <div><Status kind="measured" /></div>
                        <span className="kpi-num">{eur(evaluation.cost.perRowEur, 6)}</span>
                        <span className="kpi-cap">coste por fila leída</span>
                        <span className="kpi-help">Precios configurados en la evaluación guardada.</span>
                      </div>
                      <div className="kpi-cell">
                        <div><Status kind="measured" /></div>
                        <span className="kpi-num">{eur(evaluation.cost.projectedProjectEur)}</span>
                        <span className="kpi-cap">coste proyectado por obra</span>
                        <span className="kpi-help">
                          Extrapolación lineal a {evaluation.cost.projectRows.toLocaleString('es-ES')} filas leídas.
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
                      <EmptyCard
                        label="coste por fila"
                        detail="La última evaluación no conserva un coste positivo sin caché. Coste desconocido no se presenta como cero."
                      />
                      <EmptyCard
                        label="coste proyectado por obra"
                        detail="Sin coste por fila medido no se proyectan las 500.000 lecturas de una obra."
                      />
                    </>
                  )}

                  {evaluation?.latency ? (
                    <div className="kpi-cell">
                      <div><Status kind="measured" /></div>
                      <span className="kpi-num">{minutes(evaluation.latency.serialMinutesPerThousand)}</span>
                      <span className="kpi-cap">1.000 filas, ejecución serial</span>
                      <span className="kpi-help">
                        Concurrencia 8 ideal: {minutes(evaluation.latency.idealMinutesAtConcurrency8)}.
                        Una sola ejecución extrapolada: no es un SLA; faltan repeticiones y límites reales del proveedor.
                      </span>
                    </div>
                  ) : (
                    <EmptyCard
                      label="tiempo para 1.000 filas"
                      detail="La última evaluación no conserva una latencia positiva. Falta una medición repetida sin caché."
                    />
                  )}

                  {evaluation?.estimatedHoursSaved !== null && evaluation ? (
                    <div className="kpi-cell">
                      <div><Status kind="measured" /></div>
                      <span className="kpi-num">~{Math.round(evaluation.estimatedHoursSaved).toLocaleString('es-ES')} h</span>
                      <span className="kpi-cap">trabajo estimado evitado por obra</span>
                      <span className="kpi-help">
                        2.500 h manuales × autonomía útil medida. Es una estimación, no tiempo fichado.
                      </span>
                    </div>
                  ) : <EmptyCard label="horas estimadas evitadas" />}
                </div>
              </section>

              <section className="kpi-section">
                <h3>Corrección y vocabulario reutilizado</h3>
                <p className="kpi-note">
                  <Status kind="target" /> Corregir una línea desde abrirla hasta guardar la decisión en ≤90 s.
                  Aceptar una sugerencia guarda el vocabulario y lo reaplica sin pasar por una cola intermedia.
                </p>
                <div className="kpi-grid">
                  <div className="kpi-cell">
                    <div><Status kind={correction && correction.timing.sampleCount > 0 ? 'measured' : 'unavailable'} /></div>
                    <span className="kpi-num">
                      {correction && correction.timing.p50Seconds !== null
                        ? `${correction.timing.p50Seconds.toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`
                        : '—'}
                    </span>
                    <span className="kpi-cap">tiempo de corrección p50</span>
                    <span className="kpi-help">
                      {correction && correction.timing.sampleCount > 0
                        ? `${correction.timing.sampleCount} correcciones medidas; ${correction.timing.withinTargetCount} dentro del objetivo.`
                        : 'Sin pares abrir/guardar completos todavía.'}
                    </span>
                  </div>
                  <div className="kpi-cell">
                    <div><Status kind={correction && correction.timing.sampleCount > 0 ? 'measured' : 'unavailable'} /></div>
                    <span className="kpi-num">
                      {correction && correction.timing.p90Seconds !== null
                        ? `${correction.timing.p90Seconds.toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`
                        : '—'}
                    </span>
                    <span className="kpi-cap">tiempo de corrección p90</span>
                    <span className="kpi-help">Objetivo: ≤90 s. Se muestra el tamaño de muestra para no esconder una medición débil.</span>
                  </div>
                </div>

                {correction && (
                  <div className="kpi-funnel">
                    <div><strong>{correction.reuseCount}</strong><span>Reutilizaciones observadas</span></div>
                  </div>
                )}
                <p className="kpi-help">
                  <Status kind="measured" /> Cuenta aplicaciones reales de entradas guardadas desde
                  la UI en MTOs posteriores; crear una entrada sin volver a usarla no incrementa el dato.
                </p>
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
