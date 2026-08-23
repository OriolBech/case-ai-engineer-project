'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ProcessEvent, ProcessSummary } from '../lib/api-types.ts';
import { formatEur, formatSeconds, queueOf } from '../lib/derive.ts';
import { UploadScreen, type UploadProgress } from './UploadScreen.tsx';
import { QueueScreen } from './QueueScreen.tsx';
import { TracePanel } from './TracePanel.tsx';
import { KpiPanel } from './KpiPanel.tsx';
import { AppTopbar } from './AppTopbar.tsx';

type Phase = 'upload' | 'processing' | 'ready';

export function App() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessSummary | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [traceLineId, setTraceLineId] = useState<string | null>(null);
  const [showKpis, setShowKpis] = useState(false);

  const rowsSourceText = useMemo(() => {
    const m = new Map<string, string>();
    if (result) for (const r of result.rows) m.set(r.itemRef, r.sourceText);
    return m;
  }, [result]);

  // Reabre un MTO desde `/mto-history`: ?mto=<id> en la URL trae el mismo `ProcessSummary` que ya
  // se enseñó en su momento, guardado por `app/api/process/route.ts` en cada procesamiento. Cero UI
  // nueva — hidrata el mismo `result` que produce un procesamiento en caliente.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('mto');
    if (!id) return;
    setPhase('processing');
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
          else if (ev.type === 'done') { setResult(ev.result); setPhase('ready'); }
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
    setTraceLineId(null);
    window.history.replaceState(null, '', '/');
  }, []);

  const confirmLines = useCallback((ids: string[]) => {
    setConfirmed((prev) => new Set([...prev, ...ids]));
  }, []);

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

  const resolvedCount = result.lines.filter((l) => queueOf(l) === 'resuelta' || confirmed.has(l.id)).length;
  const pctResolved = result.lines.length ? Math.round((100 * resolvedCount) / result.lines.length) : 0;
  const traceLine = traceLineId ? result.lines.find((l) => l.id === traceLineId) ?? null : null;
  const allCached = result.metrics.llmCalls > 0 && result.metrics.cacheHits === result.metrics.llmCalls;

  return (
    <div className="wf-root">
      <AppTopbar
        right={
          <>
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
        lines={result.lines}
        rowsSourceText={rowsSourceText}
        confirmed={confirmed}
        onConfirm={confirmLines}
        onOpenTrace={setTraceLineId}
      />

      {showKpis && <KpiPanel result={result} onClose={() => setShowKpis(false)} />}

      {traceLine && (
        <TracePanel
          line={traceLine}
          sourceText={rowsSourceText.get(traceLine.rowRef) ?? null}
          onClose={() => setTraceLineId(null)}
        />
      )}
    </div>
  );
}
