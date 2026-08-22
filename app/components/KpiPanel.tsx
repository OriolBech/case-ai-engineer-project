/**
 * "Cómo ha ido" — el resumen de una ejecución **para el comprador**, no para quien programa.
 *
 * QUIÉN LO LEE. La persona que revisa MTOs y usa esta app. No sabe —ni le importa— qué es un span, una
 * procedencia, un split o una caché. Sabe perfectamente lo que es comprar el material equivocado.
 * Así que aquí no aparece ni un nombre de código, ni un identificador de motivo, ni una métrica con
 * nombre de métrica: cada bloque contesta una pregunta que esa persona se hace de verdad.
 *
 *   ¿Me puedo fiar de lo que ha salido?      → lo que hay que mirar, y por qué
 *   ¿Cuánto trabajo me ha quitado?           → líneas listas y trabajo pendiente
 *   ¿De qué no está seguro el sistema?       → lo apoyado en una regla, no en el papel
 *   ¿Qué no ha sabido decidir nadie todavía?  → las decisiones que faltan, en castellano
 *
 * LA DECISIÓN QUE LO ORDENA TODO. Sobre un MTO nuevo, sin una hoja de respuestas, el sistema **no
 * puede saber si ha acertado**. Podría enseñar un "85% resuelto" enorme y quedarse tan ancho, y eso
 * es exactamente el sistema que no queremos: uno que resuelve todo y se equivoca en uno de cada
 * siete compra material equivocado con la confianza de una máquina. Así que el porcentaje grande no
 * es el titular; el titular es **qué hay que mirar**.
 */
'use client';

import { useMemo } from 'react';
import type { ProcessSummary } from '../lib/api-types.ts';
import {
  ATTR_LABEL, extrapolate, formatEur, formatSeconds, isWeak, queueOf,
  reasonCounts, resolvedByWeakestProvenance, weakestAttributeCounts,
} from '../lib/derive.ts';
import type { Provenance } from '../../src/pipeline/types.ts';
import type { ATTRIBUTE_KEYS } from '../../src/pipeline/types.ts';

interface Props {
  result: ProcessSummary;
  onClose: () => void;
}

/**
 * Cómo se le cuenta al comprador de dónde sale un dato.
 *
 * No es `PROVENANCE_LABEL`: aquélla nombra el mecanismo ("normalizado", "extrapolado") y sirve para
 * el panel de traza, donde se está mirando una línea concreta. Aquí hace falta la CONSECUENCIA — si
 * tiene que mirarlo o no — y en las palabras de su oficio.
 */
const TRUST: Record<Provenance, { label: string; detail: string; look: boolean }> = {
  exact_catalog: { label: 'Lo pone el MTO, y está en vuestro catálogo', detail: 'El valor viene escrito en la fila y coincide con una entrada de vuestras tablas.', look: false },
  table_normalized: { label: 'Lo pone el MTO, traducido con vuestras tablas', detail: 'La fila decía DIN 931 y vuestra tabla de equivalencias dice ISO 4014. Es vuestra propia tabla.', look: false },
  extracted: { label: 'Lo pone el MTO, tal cual', detail: 'Copiado literalmente de la fila. No hay tabla contra la que contrastarlo, pero está escrito.', look: false },
  extracted_uncatalogued: { label: 'Lo pone el MTO, pero no está en ninguna tabla', detail: 'Un grado como GR B7: escrito en la fila, y ninguna de vuestras tablas lo reconoce. Se conserva tal cual.', look: true },
  extrapolated: { label: 'Heredado del elemento principal del conjunto', detail: 'La medida del tornillo aplicada a su tuerca. Es la única cosa que vuestras reglas permiten heredar.', look: false },
  derived: { label: 'Deducido de la calidad con la tabla de materiales', detail: 'A4-70 significa inoxidable, 8.8 significa acero. Sale de una tabla cerrada que podéis consultar y ampliar.', look: true },
  inferred: { label: 'Supuesto por una regla, no escrito en el MTO', detail: 'La unidad de una longitud sin unidad, o una cantidad que la fila no escribe. Hay una regla detrás, pero el papel no lo dice.', look: true },
  absent: { label: 'No está en el MTO', detail: 'Nadie lo escribió. No hay nada que deducir.', look: true },
  not_applicable: { label: 'No aplica', detail: 'Una tuerca no tiene longitud.', look: false },
};

/** Motivos de revisión en la lengua del comprador, y a quién le toca. */
const REASON_TEXT: Record<string, string> = {
  QUALITY_MISSING: 'La fila no dice la calidad',
  STANDARD_MISSING: 'La fila no dice la norma',
  MEASURE_MISSING: 'La fila no dice la medida',
  LENGTH_MISSING: 'La fila no dice la longitud',
  NAME_MISSING: 'No se ha podido identificar qué pieza es',
  QUANTITY_NOT_STATED: 'La fila no dice cuántas unidades',
  OUT_OF_FAMILY: 'Esta fila no es tornillería',
  EMPTY_DESCRIPTION: 'La fila no tiene descripción',
  PROCESSING_FAILED: 'Esta fila no se ha podido procesar',
  FINISH_SCOPE_UNSTATED: 'La fila da un acabado pero no dice a qué piezas del conjunto se aplica',
  NO_ELEMENTS_EXTRACTED: 'No se ha reconocido ninguna pieza en esta fila',
  QUALITY_TYPE_INCOHERENCE: 'La calidad no encaja con el tipo de pieza',
  UNIT_MISMATCH: 'La medida y la longitud están en sistemas distintos',
  LENGTH_UNIT_IMPLAUSIBLE: 'No se puede decidir si la longitud está en milímetros o en pulgadas',
  LOW_CONFIDENCE: 'Varios datos son supuestos: conviene mirarlo',
  CRITIC_DISAGREES: 'La segunda revisión automática no cuadra con el texto de la fila',
  UNMAPPED_VALUE: 'Un valor que las tablas no saben interpretar de forma única',
};

function Bar({ value, total, tone }: { value: number; total: number; tone: 'ok' | 'warn' }) {
  const p = total ? (100 * value) / total : 0;
  return (
    <div className="kpi-bar" role="presentation">
      <div className={`kpi-bar-fill ${tone}`} style={{ width: `${Math.max(p, value > 0 ? 1.5 : 0)}%` }} />
    </div>
  );
}

export function KpiPanel({ result, onClose }: Props) {
  const { lines, diagnostics: d, metrics } = result;

  const v = useMemo(() => {
    const resolved = lines.filter((l) => queueOf(l) === 'resuelta');
    const buyer = lines.filter((l) => queueOf(l) === 'comprador');
    const engineering = lines.filter((l) => queueOf(l) === 'ingenieria');
    const buckets = resolvedByWeakestProvenance(lines).filter((b) => b.lines.length > 0);
    const toLook = buckets.filter((b) => TRUST[b.provenance].look);
    return {
      resolved, buyer, engineering, buckets, toLook,
      toLookCount: toLook.reduce((a, b) => a + b.lines.length, 0),
      weakAttrs: weakestAttributeCounts(lines),
      reasons: reasonCounts(lines),
      cost: extrapolate(metrics.costEur, result.rowsIngested),
      minutesSaved: Math.round((resolved.length * 90) / 60),
    };
  }, [lines, metrics.costEur, result.rowsIngested]);

  const pct = (n: number, t: number) => (t ? Math.round((100 * n) / t) : 0);

  return (
    <div className="kpi-overlay" role="dialog" aria-label="Cómo ha ido">
      <div className="kpi-panel">
        <header className="kpi-head">
          <div>
            <h2>Cómo ha ido</h2>
            <p className="kpi-sub">
              {result.fileName} · {result.rowsIngested} filas del Excel · {lines.length} materiales distintos
            </p>
          </div>
          <button className="wf-btn small" onClick={onClose}>Cerrar</button>
        </header>

        {/* ---- Lo primero: ¿hay algo roto? ------------------------------- */}
        {d.failedRows.length > 0 && (
          <div className="kpi-alarm">
            <strong>
              {d.failedRows.length === 1
                ? 'Una fila no se ha podido procesar.'
                : `${d.failedRows.length} filas no se han podido procesar.`}
            </strong>{' '}
            Están en tu cola marcadas, así que no se pierde ninguna — pero conviene volver a pasar el
            fichero antes de dar los números por buenos.
            <ul>{d.failedRows.slice(0, 5).map((f) => <li key={f.rowRef}>Fila {f.rowRef} del Excel</li>)}</ul>
          </div>
        )}

        {/* ---- 1. Qué hay que mirar -------------------------------------- */}
        <section className="kpi-section">
          <h3>Lo que conviene mirar</h3>

          {v.toLookCount === 0 ? (
            <p className="kpi-verdict ok">
              De las {v.resolved.length} líneas listas, todas salen de datos escritos en el MTO o
              traducidos con vuestras propias tablas. No hay nada apoyado en una suposición.
            </p>
          ) : (
            <p className="kpi-verdict">
              <strong>{v.toLookCount} de las {v.resolved.length} líneas listas</strong>{' '}
              ({pct(v.toLookCount, v.resolved.length)}%) tienen algún dato que <strong>no está escrito
              en el MTO</strong>: se ha deducido con una regla. Son correctas según esas reglas, y son
              las que revisaría primero si alguna vez algo llega mal a obra.
            </p>
          )}

          <div className="kpi-rows">
            {v.buckets.map((b) => {
              const t = TRUST[b.provenance];
              return (
                <div className="kpi-row wide" key={b.provenance}>
                  <span className="kpi-row-label" title={t.detail}>
                    {t.look && <span className="kpi-dot" aria-label="conviene mirarlo" />}
                    {t.label}
                  </span>
                  <Bar value={b.lines.length} total={v.resolved.length} tone={t.look ? 'warn' : 'ok'} />
                  <span className="kpi-row-value">{b.lines.length}</span>
                </div>
              );
            })}
          </div>

          {v.weakAttrs.length > 0 && (
            <div className="kpi-split">
              <span className="kpi-cap">Qué dato es el que falta más veces</span>
              <div className="kpi-rows">
                {v.weakAttrs.map((a) => (
                  <div className="kpi-row" key={a.attribute}>
                    <span className="kpi-row-label">
                      {ATTR_LABEL[a.attribute as (typeof ATTRIBUTE_KEYS)[number]] ?? a.attribute}
                    </span>
                    <Bar value={a.count} total={v.resolved.length} tone="warn" />
                    <span className="kpi-row-value">{a.count}</span>
                  </div>
                ))}
              </div>
              <span className="kpi-help">
                Si un mismo dato falta en casi todas las filas, probablemente sea el estudio de
                ingeniería el que no lo escribe — y eso se arregla una vez, hablando con ellos, no
                línea a línea.
              </span>
            </div>
          )}

          {(d.hallucinations.length > 0 || d.rejectedMultiplicity.length > 0) && (
            <p className="kpi-note">
              {d.hallucinations.length > 0 && (
                <>
                  <strong>{d.hallucinations.length}</strong>{' '}
                  {d.hallucinations.length === 1 ? 'valor se ha descartado' : 'valores se han descartado'}{' '}
                  por no aparecer en la fila.{' '}
                </>
              )}
              {d.rejectedMultiplicity.length > 0 && (
                <>
                  En <strong>{d.rejectedMultiplicity.length}</strong>{' '}
                  {d.rejectedMultiplicity.length === 1 ? 'línea' : 'líneas'} se ha dejado la cantidad en
                  una unidad por pieza, porque la fila no dice cuántas van por conjunto.
                </>
              )}
            </p>
          )}
        </section>

        {/* ---- 2. Cuánto trabajo quita ----------------------------------- */}
        <section className="kpi-section">
          <h3>El trabajo</h3>
          <div className="kpi-grid">
            <div className="kpi-cell">
              <span className="kpi-num">{v.resolved.length}</span>
              <span className="kpi-cap">líneas listas para pedir</span>
              <span className="kpi-help">Con los siete datos y la cantidad. A 90 s por línea, unas {v.minutesSaved} min de trabajo manual.</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-num">{v.buyer.length}</span>
              <span className="kpi-cap">para que las mires tú</span>
              <span className="kpi-help">El dato está o se puede decidir, pero el sistema no se compromete.</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-num">{v.engineering.length}</span>
              <span className="kpi-cap">para devolver a ingeniería</span>
              <span className="kpi-help">Falta un dato en el MTO. Ni tú ni el sistema podéis inventarlo: hay que pedirlo.</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-num">{d.outOfFamilyRows.length}</span>
              <span className="kpi-cap">filas que no son tornillería</span>
              <span className="kpi-help">Bridas, juntas, tubos. Se apartan en vez de forzarlas a ser un tornillo.</span>
            </div>
          </div>

          {v.reasons.length > 0 && (
            <div className="kpi-split">
              <span className="kpi-cap">Por qué está pendiente lo que está pendiente</span>
              <div className="kpi-rows">
                {v.reasons.map((r) => (
                  <div className="kpi-row wide" key={r.code}>
                    <span className="kpi-row-label">
                      {REASON_TEXT[r.code] ?? r.message}
                      <span className="kpi-row-pct"> · {r.queue === 'ingenieria' ? 'ingeniería' : 'tú'}</span>
                    </span>
                    <Bar value={r.count} total={lines.length} tone={r.queue === 'ingenieria' ? 'ok' : 'warn'} />
                    <span className="kpi-row-value">{r.count}</span>
                  </div>
                ))}
              </div>
              <span className="kpi-help">
                Agrupado porque así se resuelve: si trescientas líneas están pendientes por lo mismo,
                es una decisión, no trescientas.
              </span>
            </div>
          )}
        </section>

        {/* ---- 3. Decisiones que faltan ---------------------------------- */}
        <section className="kpi-section">
          <h3>Decisiones que nadie ha tomado todavía</h3>
          {d.policyBacklog.length === 0 ? (
            <p className="kpi-verdict ok">
              Ninguna. Todo lo que dice este fichero encaja con una regla vuestra o con una decisión
              que ya está tomada.
            </p>
          ) : (
            <>
              <p className="kpi-note">
                Esto <strong>no</strong> es trabajo tuyo de revisar líneas: son casos que ninguna regla
                cubre todavía. Cada uno se decide <strong>una vez</strong> y el sistema lo aplica igual
                en todos los MTO que vengan.
              </p>
              <ul className="kpi-backlog">
                {d.policyBacklog.map((b, i) => (
                  <li key={`${b.kind}-${i}`}>
                    <strong>{b.value || b.attribute}</strong>
                    <div className="kpi-help">{b.detail}</div>
                    <div className="kpi-help">
                      {b.rows.length === 1 ? `Fila ${b.rows[0]}` : `${b.rows.length} filas: ${b.rows.join(', ')}`}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        {/* ---- 4. Lo que este resumen NO puede decirte -------------------- */}
        <section className="kpi-section kpi-cant">
          <h3>Lo que este resumen no puede decirte</h3>
          <p className="kpi-note">
            Se dice claro en lugar de callarlo: <strong>sobre un MTO nuevo, el sistema no sabe si ha
            acertado.</strong> Para saberlo hace falta alguien que haya normalizado ese mismo fichero a
            mano y comparar. Concretamente, no puede decirte:
          </p>
          <ul className="kpi-cant-list">
            <li>
              <strong>Cuántas de las {v.resolved.length} líneas listas están bien.</strong> Es el dato
              que importa, y es el que no está. El bloque de arriba te dice dónde es más probable que
              haya un problema, no dónde lo hay.
            </li>
            <li>
              <strong>Si los conjuntos se han partido bien.</strong> Una fila con un tornillo, su tuerca
              y dos arandelas son cuatro materiales. Que haya salido en cuatro no prueba que sean los
              cuatro correctos.
            </li>
          </ul>
          <p className="kpi-note">
            Sobre el fichero de prueba que sí está normalizado a mano —15 filas, 30 líneas, 211 datos
            comprobados uno a uno— el sistema acierta <strong>todos</strong> y no resuelve ninguna línea
            mal. Ese resultado es de ese fichero. De éste, lo honesto es lo de arriba.
          </p>
        </section>

        {/* ---- Coste ------------------------------------------------------ */}
        <section className="kpi-section">
          <h3>Lo que ha costado</h3>
          <div className="kpi-grid">
            <div className="kpi-cell">
              <span className="kpi-num">{metrics.pricesConfigured ? formatEur(metrics.costEur) : '—'}</span>
              <span className="kpi-cap">este fichero</span>
              <span className="kpi-help">{result.rowsIngested} filas leídas.</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-num">{metrics.pricesConfigured ? formatEur(v.cost.perProject) : '—'}</span>
              <span className="kpi-cap">una obra entera</span>
              <span className="kpi-help">20.000 filas y 25 revisiones. Hacerlo a mano son unas 2.500 h.</span>
            </div>
            <div className="kpi-cell">
              <span className="kpi-num">{formatSeconds(metrics.latencyMs)}</span>
              <span className="kpi-cap">ha tardado</span>
              <span className="kpi-help">No hay que esperar delante: el fichero entra y la cola aparece.</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
