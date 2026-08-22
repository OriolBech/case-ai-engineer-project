'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ProcessEvent, ProcessSummary } from '../lib/api-types.ts';
import { formatEur, formatSeconds, queueOf } from '../lib/derive.ts';
import { UploadScreen, type UploadProgress } from './UploadScreen.tsx';
import { QueueScreen } from './QueueScreen.tsx';
import { TracePanel } from './TracePanel.tsx';

type Phase = 'upload' | 'processing' | 'ready';

export function App() {
  const [phase, setPhase] = useState<Phase>('upload');
  const [fileName, setFileName] = useState<string | null>(null);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProcessSummary | null>(null);
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [traceLineId, setTraceLineId] = useState<string | null>(null);

  const rowsSourceText = useMemo(() => {
    const m = new Map<string, string>();
    if (result) for (const r of result.rows) m.set(r.itemRef, r.sourceText);
    return m;
  }, [result]);

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
      <header className="wf-topbar">
        <div className="wf-topbar-inner">
          <div className="wf-brand">
            <span className="wf-logo-mark" aria-hidden />
            <span className="wf-brand-name">Tornillería</span>
          </div>
          <div className="wf-brand-sep" />
          <span className="wf-file-name" title={result.fileName}>{result.fileName}</span>

          <div className="wf-stats">
            <div className="wf-stat">
              <span className="wf-stat-label">% resuelto</span>
              <span className="wf-stat-value accent">{pctResolved}%</span>
            </div>
            <div className="wf-stat">
              <span className="wf-stat-label">Coste MTO</span>
              <span
                className="wf-stat-value"
                title={allCached ? 'Todas las llamadas salieron de caché: coste real ya pagado en una ejecución anterior' : undefined}
              >
                {result.metrics.pricesConfigured ? formatEur(result.metrics.costEur) : '—'}
                {allCached && ' *'}
              </span>
            </div>
            <div className="wf-stat">
              <span className="wf-stat-label">Tiempo</span>
              <span className="wf-stat-value">{formatSeconds(result.metrics.latencyMs)}</span>
            </div>
            <button className="wf-btn dark small" onClick={reset}>Nuevo MTO</button>
          </div>
        </div>
      </header>

      <QueueScreen
        lines={result.lines}
        rowsSourceText={rowsSourceText}
        confirmed={confirmed}
        onConfirm={confirmLines}
        onOpenTrace={setTraceLineId}
      />

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
