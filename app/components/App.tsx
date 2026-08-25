'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProcessEvent, ProcessSummary } from '../lib/api-types.ts';
import { ATTRIBUTE_KEYS, type OutputLine, type Provenance } from '../../src/pipeline/types.ts';
import { effectiveQueue, formatEur, formatSeconds, queueOf } from '../lib/derive.ts';
import { recordCorrectionKpiEvent } from '../lib/kpi-client.ts';
import { UploadScreen, type UploadProgress } from './UploadScreen.tsx';
import { QueueScreen } from './QueueScreen.tsx';
import { TracePanel } from './TracePanel.tsx';
import { KpiPanel } from './KpiPanel.tsx';
import { AppTopbar } from './AppTopbar.tsx';
import { VocabularyView } from './VocabularyView.tsx';

type Phase = 'upload' | 'processing' | 'ready';

/**
 * Lo que una persona ha cambiado en esta sesión sobre la salida cruda del pipeline.
 *
 * Antes era **un** parche por línea, con una clave de dos valores (`finish` | `material`): bastaba
 * para el único caso que existía, aceptar una sugerencia de vocabulario. Con las correcciones por
 * línea (SPEC-015) deja de bastar — el comprador puede quitar la calidad de una fila Y escribir la
 * norma que faltaba— así que el parche pasa a ser un mapa por atributo. El `result` crudo sigue sin
 * mutarse: esto vive en la sesión, y lo que persiste es la corrección registrada con su evidencia.
 */
type AttrPatch = { value: string | null; provenance: Provenance; rule: string };
type AppliedPatch = Partial<Record<(typeof ATTRIBUTE_KEYS)[number], AttrPatch>>;

/** Normaliza para casar el texto del alta con el `raw` de la línea, sin acentos ni mayúsculas. */
function norm(s: string): string {
  return s.trim().toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/** El atributo cuyo `raw` dispara cada sugerencia: acabado por el suyo, material por la calidad. */
function rawFor(line: OutputLine, key: 'finish' | 'material'): string | null {
  return key === 'material' ? line.attributes.quality.raw : line.attributes.finish.raw;
}

export interface SuggestionPatch {
  attribute: 'finish' | 'material';
  match: string;
  value: string | null;
}

export function App() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessSummary | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [traceLineId, setTraceLineId] = useState<string | null>(null);
  const [showKpis, setShowKpis] = useState(false);
  const [showVocab, setShowVocab] = useState(false);
  // Sugerencias aceptadas y re-aplicadas en caliente. `applied` sobrescribe el valor de la línea.
  // Guardar la decisión es darla por buena: esas líneas cuentan como resueltas en esta sesión.
  const [applied, setApplied] = useState<Map<string, AppliedPatch>>(new Map());
  const [processedMtoId, setProcessedMtoId] = useState<string | null>(null);
  const [kpiSessionId] = useState(() =>
    globalThis.crypto?.randomUUID?.() ?? `session-${Date.now()}-${Math.random().toString(36).slice(2)}`,
  );

  const rowsSourceText = useMemo(() => {
    const m = new Map<string, string>();
    if (result) for (const r of result.rows) m.set(r.itemRef, r.sourceText);
    return m;
  }, [result]);

  // Las líneas tal como se pintan: con las sugerencias aceptadas ya aplicadas encima del resultado
  // original del pipeline. El `result` crudo no se muta; el parche vive solo en esta sesión.
  const displayLines = useMemo<OutputLine[]>(() => {
    if (!result) return [];
    if (applied.size === 0) return result.lines;
    return result.lines.map((l) => {
      const p = applied.get(l.id);
      if (!p) return l;
      const attributes = { ...l.attributes };
      for (const key of ATTRIBUTE_KEYS) {
        const patch = p[key];
        if (!patch) continue;
        // Cast: `finish` está tipado con la unión `Finish` y el valor llega como string. Es un valor
        // válido de su catálogo, pero TS no lo sabe con una clave calculada. Parche solo de pintado.
        (attributes as Record<string, unknown>)[key] = {
          ...l.attributes[key],
          normalized: patch.value,
          provenance: patch.provenance,
          rule: patch.rule,
        };
      }
      return { ...l, attributes } as OutputLine;
    });
  }, [result, applied]);

  const openTrace = useCallback((lineId: string) => {
    setTraceLineId(lineId);
    const line = displayLines.find((candidate) => candidate.id === lineId);
    if (line && queueOf(line) === 'revision') {
      recordCorrectionKpiEvent(kpiSessionId, lineId, 'started');
    }
  }, [displayLines, kpiSessionId]);

  // Reabre un MTO desde `/mto-history`: ?mto=<id> en la URL trae el mismo `ProcessSummary` que ya
  // se enseñó en su momento, guardado por `app/api/process/route.ts` en cada procesamiento. Cero UI
  // nueva — hidrata el mismo `result` que produce un procesamiento en caliente.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('mto');
    if (!id) return;
    setPhase('processing');
    setProcessedMtoId(id);
    (async () => {
      try {
        const res = await fetch(`/api/mto-history?id=${encodeURIComponent(id)}`);
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setResult(body);
        setPhase('ready');
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        setPhase('upload');
      } finally {
        window.history.replaceState(null, '', '/');
      }
    })();
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setFileName(file.name);
    setError(null);
    setProgress(null);
    setPhase('processing');

    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/process', { method: 'POST', body: form });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? `El servidor respondió ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as ProcessEvent;
          if (ev.type === 'progress') setProgress({ done: ev.done, total: ev.total });
          else if (ev.type === 'done') {
            setResult(ev.result);
            if (ev.processedMtoId) setProcessedMtoId(ev.processedMtoId);
            setPhase('ready');
          }
          else if (ev.type === 'error') throw new Error(ev.message);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase('upload');
    }
  }, []);

  const reset = useCallback(() => {
    setPhase('upload');
    setResult(null);
    setFileName(null);
    setProgress(null);
    setError(null);
    setConfirmed(new Set());
    setApplied(new Map());
    setTraceLineId(null);
    setProcessedMtoId(null);
    window.history.replaceState(null, '', '/');
  }, []);

  // Validar = una persona da por buena la línea. Pasa a resuelta. También lo hace aceptar una
  // sugerencia de vocabulario: guardar es decidir, no hay un segundo paso.
  const validateLines = useCallback(async (ids: string[]) => {
    for (const id of ids) recordCorrectionKpiEvent(kpiSessionId, id, 'saved');
    setConfirmed((prev) => new Set([...prev, ...ids]));
  }, [kpiSessionId]);

  // Aceptar una sugerencia: re-aplica el vocabulario en caliente a las líneas del MTO abierto cuyo
  // texto coincide, y las da por resueltas en esta sesión.
  const applySuggestion = useCallback(async (p: SuggestionPatch) => {
    if (!result) return;
    if (p.attribute === 'material' && !p.value) return;
    const value = p.value;
    const provenance: Provenance =
      p.attribute === 'material' ? 'derived' : value === null ? 'absent' : 'table_normalized';
    const needle = norm(p.match);
    const ids: string[] = [];
    for (const l of result.lines) {
      if (l.attributes[p.attribute].normalized !== null) continue;
      const raw = rawFor(l, p.attribute);
      if (raw && norm(raw) === needle) {
        ids.push(l.id);
      }
    }
    if (ids.length === 0) return;
    for (const id of ids) recordCorrectionKpiEvent(kpiSessionId, id, 'saved');
    setApplied((prev) => {
      const n = new Map(prev);
      for (const id of ids) {
        n.set(id, { ...(n.get(id) ?? {}), [p.attribute]: { value, provenance, rule: 'vocab:aplicado' } });
      }
      return n;
    });
    setConfirmed((prev) => new Set([...prev, ...ids]));
  }, [result, kpiSessionId]);

  /**
   * Una corrección por línea: lo que una persona cambia sobre ESTA fila, no una regla para todas.
   *
   * Se separa de `applySuggestion` a propósito, porque son cosas distintas y confundirlas fue el
   * error que SPEC-015 existe para evitar: una sugerencia de vocabulario cambia todas las líneas que
   * comparten un valor y queda como tabla; una corrección cambia una celda y queda como **etiqueta**,
   * con su evidencia literal y su motivo, a la espera de aprobación. Lo que se ve en pantalla es lo
   * mismo; lo que aprende el sistema, no.
   */
  const applyCorrection = useCallback((lineId: string, attribute: (typeof ATTRIBUTE_KEYS)[number], value: string | null) => {
    recordCorrectionKpiEvent(kpiSessionId, lineId, 'saved');
    setApplied((prev) => {
      const n = new Map(prev);
      n.set(lineId, {
        ...(n.get(lineId) ?? {}),
        [attribute]: { value, provenance: 'human_corrected', rule: 'SPEC-015:corrección' },
      });
      return n;
    });
  }, [kpiSessionId]);

  if (phase !== 'ready' || !result) {
    return (
      <UploadScreen
        onUpload={handleUpload}
        busy={phase === 'processing'}
        progress={progress}
        error={error}
        fileName={fileName}
      />
    );
  }

  const resolvedCount = displayLines.filter((l) => effectiveQueue(l, confirmed) === 'resuelta').length;
  const pctResolved = displayLines.length ? Math.round((100 * resolvedCount) / displayLines.length) : 0;
  const traceLine = traceLineId ? displayLines.find((l) => l.id === traceLineId) ?? null : null;
  const allCached = result.metrics.llmCalls > 0 && result.metrics.cacheHits === result.metrics.llmCalls;

  return (
    <div className="wf-root">
      <AppTopbar
        right={
          <>
            <button className="wf-btn small" onClick={() => setShowVocab(true)}>Vocabulario</button>
            <button className="wf-btn small" onClick={() => setShowKpis(true)}>Cómo ha ido</button>
            <button className="wf-btn dark small" onClick={reset}>Nuevo MTO</button>
          </>
        }
      />

      <div className="wf-section-head">
        <div>
          <h1 className="wf-title" title={result.fileName}>{result.fileName}</h1>
          {/* "Resueltas" y NO "% de acierto": esta cifra sube igual si el sistema resuelve mal, y
              confundir las dos es el sistema que el enunciado descarta. La autonomía útil —resueltas
              Y correctas— necesita respuestas conocidas, y el panel de KPIs lo dice con su nombre. */}
          <div className="wf-meta-inline">
            <span title="Tasa de resolución, no de acierto: sube igual si el sistema resuelve mal">
              % resueltas <b className="wf-num accent">{pctResolved}%</b>
            </span>
            <span title={allCached ? 'Todas las llamadas salieron de caché: coste real ya pagado en una ejecución anterior' : undefined}>
              Coste MTO <b className="wf-num">{result.metrics.pricesConfigured ? formatEur(result.metrics.costEur) : '—'}</b>
              {allCached && ' *'}
            </span>
            <span>Tiempo <b className="wf-num">{formatSeconds(result.metrics.latencyMs)}</b></span>
          </div>
        </div>
      </div>

      <QueueScreen
        lines={displayLines}
        rowsSourceText={rowsSourceText}
        confirmed={confirmed}
        onValidate={validateLines}
        onOpenTrace={openTrace}
        processedMtoId={processedMtoId}
        backlog={result.diagnostics.policyBacklog}
      />

      {/* Solo métricas: las decisiones de vocabulario se toman en el desplegable de la línea
          (`LineDecisions`), no aquí. Por eso este panel ya no recibe `applySuggestion`. */}
      {showKpis && <KpiPanel result={result} onClose={() => setShowKpis(false)} />}

      {showVocab && (
        <div className="vocab-drawer" role="dialog" aria-modal="true" aria-label="Vocabulario común">
          <div className="vocab-drawer-backdrop" onClick={() => setShowVocab(false)} />
          <div className="vocab-drawer-panel">
            <div className="vocab-drawer-head">
              <button className="wf-btn small" onClick={() => setShowVocab(false)}>Cerrar</button>
            </div>
            <div className="vocab-drawer-body">
              <VocabularyView embedded onApplied={applySuggestion} />
            </div>
          </div>
        </div>
      )}

      {traceLine && (
        <TracePanel
          line={traceLine}
          sourceText={rowsSourceText.get(traceLine.rowRef) ?? null}
          backlog={result.diagnostics.policyBacklog}
          onClose={() => setTraceLineId(null)}
          onApplied={applySuggestion}
          onCorrected={applyCorrection}
        />
      )}
    </div>
  );
}
