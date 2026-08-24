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
 */
'use client';

import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, type Attributes, type OutputLine } from '../../src/pipeline/types.ts';
import { ATTR_LABEL, PROVENANCE_LABEL, isWeak } from '../lib/derive.ts';
import { lineNeedsFinishVocab } from '../lib/finish-vocab-ui.ts';
import type { SuggestionPatch } from './App.tsx';
import { FinishVocabAddPanel } from './FinishVocabAddPanel.tsx';

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
  onClose,
  onApplied,
}: {
  line: OutputLine;
  sourceText: string | null;
  onClose: () => void;
  onApplied?: (p: SuggestionPatch) => void;
}) {
  const [active, setActive] = useState<AttrKey | null>(null);
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

          {lineNeedsFinishVocab(line) && line.attributes.finish.raw && (
            <div className="trace-finish-vocab">
              <FinishVocabAddPanel
                defaultAlias={line.attributes.finish.raw}
                source="UI comprador (traza)"
                collapsible={false}
                onApplied={onApplied}
              />
            </div>
          )}

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
                  </div>
                  {a.raw && a.raw !== a.normalized && <div className="trace-kv-raw">tal cual en el MTO: “{a.raw}”</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
