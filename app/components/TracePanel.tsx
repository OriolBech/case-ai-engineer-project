/**
 * El panel de traza: por qué cada atributo vale lo que vale, en el texto de la fila.
 *
 * QUÉ NO LLEVA, y es una decisión, no un olvido. Tenía un pie con `confianza 0,95` y
 * `políticas: P-1, P-3`, y las dos cifras se quitaron porque **le restaban al comprador en vez de
 * sumarle**:
 *
 *  - La confianza es un escalar interno calibrado sobre los ficheros de prueba, no sobre éste. En
 *    una pantalla que existe para justificar un valor concreto, un 0,95 se lee como "acierto del
 *    95%", que es justo lo que el panel de KPI se esfuerza en decir que NO se puede saber. Y la
 *    fila 63 lo demuestra: sus dos líneas mal leídas salían con 0,95.
 *  - La lista de políticas al pie repite, agregada y sin contexto, lo que cada atributo ya dice
 *    con precisión en su propia regla. Saber que "en esta línea actuó P-1" sin saber en qué campo
 *    no es trazabilidad, es un código más que descifrar.
 *
 * Lo que sí lleva es lo que SPEC-008 pide: el span en el texto original y la regla que produjo cada
 * atributo, atributo por atributo. Ahí la política aparece donde significa algo.
 *
 * Y lleva dos cosas más, que son distintas entre sí y conviene no mezclar. Una, **corregir un
 * atributo de esta línea** (`AttributeCorrection`): cambiarlo, quitarlo cuando la pieza no lo lleva,
 * o escribir el que el sistema no vio. Eso arregla la fila y queda como etiqueta con su evidencia
 * (SPEC-015), sin tocar ninguna regla. Dos, las DECISIONES pendientes de la línea (`LineDecisions`): calidad, material y
 * acabado que ninguna regla cubre todavía. Estaban en "Cómo ha ido", que es un resumen de métricas y
 * se lee de una pasada; una decisión de vocabulario se toma mirando esta pantalla —el texto de la
 * fila, el resto de atributos, de dónde sale cada uno—, así que es aquí donde va.
 */
'use client';

import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, type Attributes, type OutputLine } from '../../src/pipeline/types.ts';
import type { PolicyBacklogItem } from '../../src/pipeline/coverage.ts';
import { ATTR_LABEL, PROVENANCE_LABEL, isWeak } from '../lib/derive.ts';
import type { SuggestionPatch } from './App.tsx';
import { LineDecisions } from './LineDecisions.tsx';
import { AttributeCorrection } from './AttributeCorrection.tsx';

type AttrKey = (typeof ATTRIBUTE_KEYS)[number];

interface Segment {
  text: string;
  attrKey: AttrKey | null;
}

function buildSegments(sourceText: string, attributes: Attributes): Segment[] {
  const spans = ATTRIBUTE_KEYS
    .map((k) => ({ k, span: attributes[k].span }))
    .filter((s): s is { k: AttrKey; span: { start: number; end: number } } => s.span !== null)
    .sort((a, b) => a.span.start - b.span.start);

  const segments: Segment[] = [];
  let cursor = 0;
  for (const { k, span } of spans) {
    if (span.start < cursor) continue; // overlapping span (shared donor cell): skip, first wins
    if (span.start > cursor) segments.push({ text: sourceText.slice(cursor, span.start), attrKey: null });
    segments.push({ text: sourceText.slice(span.start, span.end), attrKey: k });
    cursor = span.end;
  }
  if (cursor < sourceText.length) segments.push({ text: sourceText.slice(cursor), attrKey: null });
  return segments;
}

export function TracePanel({
  line,
  sourceText,
  backlog = [],
  onClose,
  onApplied,
  onCorrected,
}: {
  line: OutputLine;
  sourceText: string | null;
  /** Decisiones que el proyecto debe. Aquí se filtran a las que ESTA línea puede cerrar. */
  backlog?: readonly PolicyBacklogItem[];
  onClose: () => void;
  onApplied?: (p: SuggestionPatch) => void;
  onCorrected?: (lineId: string, attribute: AttrKey, value: string | null) => void;
}) {
  const [active, setActive] = useState<AttrKey | null>(null);
  const [editing, setEditing] = useState<AttrKey | null>(null);
  const segments = useMemo(
    () => (sourceText ? buildSegments(sourceText, line.attributes) : []),
    [sourceText, line.attributes],
  );

  return (
    <div className="trace-overlay" onClick={onClose}>
      <div className="trace-panel" onClick={(e) => e.stopPropagation()}>
        <div className="trace-head">
          <div className="trace-dots"><span /><span /><span /></div>
          <div className="trace-title">Traza · línea {line.id} · fila {line.rowRef}</div>
          <button className="trace-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="trace-body">
          <div className="trace-source">
            <div className="trace-source-label">Texto original de la fila</div>
            <div className="trace-source-text">
              {sourceText === null && '— la fila no está disponible en esta sesión —'}
              {segments.map((seg, i) =>
                seg.attrKey ? (
                  <span
                    key={i}
                    className={`trace-span${active === seg.attrKey ? ' active' : ''}`}
                    onMouseEnter={() => setActive(seg.attrKey)}
                    onMouseLeave={() => setActive(null)}
                  >
                    {seg.text}
                  </span>
                ) : (
                  <span key={i}>{seg.text}</span>
                ),
              )}
            </div>
          </div>

          {line.reasons.length > 0 && (
            <div className="trace-reasons">
              {line.reasons.map((r, i) => (
                <div className="trace-reason" key={i}>
                  <span className="mark">▲</span>
                  <span>{r.message}</span>
                </div>
              ))}
            </div>
          )}

          {/* Toda decisión de vocabulario se toma aquí, mirando la fila. El panel de KPIs las cuenta;
              este panel es donde se cierran. Ver la cabecera de `LineDecisions.tsx`. */}
          <LineDecisions line={line} backlog={backlog} onApplied={onApplied} />

          <div className="trace-kv-list">
            {ATTRIBUTE_KEYS.map((k) => {
              const a = line.attributes[k];
              return (
                <div
                  key={k}
                  className={`trace-kv${active === k ? ' active' : ''}`}
                  onMouseEnter={() => setActive(k)}
                  onMouseLeave={() => setActive(null)}
                >
                  <div className="trace-kv-top">
                    <span className="trace-kv-label">{ATTR_LABEL[k]}</span>
                    <span className={`trace-kv-value${a.normalized === null ? ' empty' : ''}`}>
                      {a.normalized ?? '— no aplica / ausente —'}
                    </span>
                  </div>
                  <div className="trace-kv-meta">
                    <span className={`trace-kv-prov${isWeak(a.provenance) ? ' weak' : ''}`}>
                      {PROVENANCE_LABEL[a.provenance]}
                    </span>
                    {a.rule && <span className="trace-kv-rule">{a.rule}</span>}
                    {/* El botón vive junto a la procedencia porque es ahí donde se ve el motivo para
                        pulsarlo: "supuesto por una regla" es justo lo que a veces está mal. */}
                    <button
                      type="button"
                      className="trace-kv-edit"
                      onClick={(e) => { e.stopPropagation(); setEditing(editing === k ? null : k); }}
                    >
                      {editing === k ? 'cancelar' : a.normalized === null ? 'añadir' : 'corregir'}
                    </button>
                  </div>
                  {a.raw && a.raw !== a.normalized && <div className="trace-kv-raw">tal cual en el MTO: “{a.raw}”</div>}
                  {editing === k && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <AttributeCorrection
                        line={line}
                        attribute={k}
                        sourceText={sourceText}
                        onCorrected={onCorrected}
                        onClose={() => setEditing(null)}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
