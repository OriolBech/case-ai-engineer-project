'use client';

/**
 * Captura ágil de acabado desde la cola o el backlog, sobre la fachada única `/api/vocabulary`.
 *
 * No bloquea: una entrada que dispararía una guarda (alias corto, ambigüedad, regresión) se guarda
 * igual y sus avisos se pintan en ámbar. Solo lo estructuralmente imposible (id repetido, alias sin
 * acabado) devuelve error. El enlace "más espacio" abre la vista única del vocabulario prefiltrada en acabado.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { suggestFinishEntryId } from '../../src/rules/finish-vocab-id.ts';
import { VOCAB_ACTOR } from '../lib/finish-vocab-ui.ts';
import type { VocabResolution } from '../../src/rules/vocab-model.ts';
import type { SuggestionPatch } from './App.tsx';
import { FinishDecisionFields, type FinishDecision } from './FinishDecisionFields.tsx';

export interface FinishVocabAddPanelProps {
  defaultAlias: string;
  defaultFinish?: string;
  /** Catálogo dinámico (semilla + añadidos). Si falta, se pide al montar. */
  finishCatalog?: string[];
  /** Contexto de dónde sale (línea, backlog…): se guarda como evidencia si no se escribe otra. */
  source?: string;
  /** Empieza colapsado con un botón (p. ej. panel KPI). */
  collapsible?: boolean;
  /** Re-aplica la decisión en caliente a las líneas del MTO abierto y las da por resueltas. */
  onApplied?: (p: SuggestionPatch) => void;
  onDone?: (alias: string) => void;
  onCancel?: () => void;
}

export function FinishVocabAddPanel({
  defaultAlias,
  defaultFinish = 'CINCADO',
  finishCatalog: finishCatalogProp,
  source = 'UI comprador',
  collapsible = false,
  onApplied,
  onDone,
  onCancel,
}: FinishVocabAddPanelProps) {
  const [open, setOpen] = useState(!collapsible);
  const [alias, setAlias] = useState(defaultAlias);
  const [decision, setDecision] = useState<FinishDecision>('catalog');
  const [catalogFinish, setCatalogFinish] = useState(defaultFinish);
  const [newFinishName, setNewFinishName] = useState('');
  const [finishCatalog, setFinishCatalog] = useState<string[]>(finishCatalogProp ?? []);
  const [rationale, setRationale] = useState('');
  const [evidence, setEvidence] = useState('');
  const [allowShort, setAllowShort] = useState(defaultAlias.trim().length < 3);
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { setAlias(defaultAlias); }, [defaultAlias]);

  useEffect(() => {
    if (finishCatalogProp?.length) setFinishCatalog(finishCatalogProp);
  }, [finishCatalogProp]);

  useEffect(() => {
    if (finishCatalogProp?.length || !open) return;
    (async () => {
      try {
        const res = await fetch('/api/vocabulary');
        const body = await res.json();
        if (res.ok && Array.isArray(body.finishCatalog)) setFinishCatalog(body.finishCatalog);
      } catch { /* catálogo local de respaldo */ }
    })();
  }, [finishCatalogProp, open]);

  const suggestedId = useMemo(() => suggestFinishEntryId(alias), [alias]);
  const short = alias.trim().length > 0 && alias.trim().length < 3;
  const newNameMissing = decision === 'new' && !newFinishName.trim();

  useEffect(() => {
    const text = alias.trim();
    if (!text || !open) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/vocabulary', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attribute: 'finish', text }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setPreview((body.resolution as VocabResolution).detail);
      } catch {
        setPreview(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [alias, open]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (newNameMissing) return;
    setState('saving');
    setError(null);
    setWarnings([]);
    const kind = decision === 'not_a_finish' ? 'not_a_finish' : 'alias';
    const value = decision === 'not_a_finish' ? null : decision === 'new' ? newFinishName.trim() : catalogFinish;
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          attribute: 'finish',
          match: alias.trim(),
          kind,
          value,
          rationale: rationale.trim(),
          evidence: evidence.trim() || source,
          decidedBy: VOCAB_ACTOR,
          allowShortAlias: allowShort || alias.trim().length < 3,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (Array.isArray(body.finishCatalog)) setFinishCatalog(body.finishCatalog);
      setWarnings(body.warnings ?? []);
      setState('done');
      onApplied?.({ attribute: 'finish', match: alias.trim(), value });
      onDone?.(alias.trim());
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
      setState('error');
    }
  }, [alias, decision, catalogFinish, newFinishName, rationale, evidence, allowShort, source, onApplied, onDone, newNameMissing]);

  if (state === 'done') {
    return (
      <div className="vocab-quickadd-wrap">
        <p className="kpi-help vocab-quickadd-done">
          Guardado. «{alias.trim()}» se ha aplicado a las líneas de este MTO y se usará igual en los
          MTO futuros.
        </p>
        {warnings.length > 0 && (
          <div className="vocab-warning">
            <strong>Se ha guardado igual, pero ojo:</strong>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  if (collapsible && !open) {
    return (
      <div className="vocab-quickadd-wrap">
        <button type="button" className="wf-btn small" onClick={() => setOpen(true)}>
          Añadir al vocabulario
        </button>
        <a
          className="kpi-help vocab-quickadd-link"
          href={`/vocabulario?attr=finish&alias=${encodeURIComponent(defaultAlias)}`}
        >
          Abrir vocabulario
        </a>
      </div>
    );
  }

  return (
    <form className="finish-vocab-panel" onSubmit={submit}>
      <div className="finish-vocab-panel-head">
        <strong>Añadir al vocabulario de acabado</strong>
        <span className="kpi-help">Id: <code>{suggestedId}</code></span>
      </div>

      <label>
        Texto del MTO (editable)
        <input
          value={alias}
          onChange={(e) => setAlias(e.target.value)}
          placeholder="tal como aparece en la fila"
          required
        />
        {preview && <span className="kpi-help">{preview}</span>}
      </label>

      <FinishDecisionFields
        decision={decision}
        onDecisionChange={setDecision}
        catalogValue={catalogFinish}
        onCatalogValueChange={setCatalogFinish}
        newFinishName={newFinishName}
        onNewFinishNameChange={setNewFinishName}
        finishCatalog={finishCatalog}
        aliasText={alias}
      />

      <label>
        Motivo <span className="vocab-optional">(opcional)</span>
        <input
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="por qué este texto es ese acabado"
        />
      </label>

      <label>
        Evidencia <span className="vocab-optional">(opcional)</span>
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="pliego §, norma, mail del proveedor…"
        />
      </label>

      {short && (
        <label className="vocab-check">
          <input
            type="checkbox"
            checked={allowShort}
            onChange={(e) => setAllowShort(e.target.checked)}
          />
          Confirmo alias corto «{alias.trim()}» (HDZ, ZN…)
        </label>
      )}

      <div className="finish-vocab-panel-actions">
        <button
          className="wf-btn primary small"
          type="submit"
          disabled={state === 'saving' || (short && !allowShort) || newNameMissing}
        >
          {state === 'saving' ? 'Guardando…' : 'Guardar decisión'}
        </button>
        {(collapsible || onCancel) && (
          <button
            type="button"
            className="wf-btn small"
            onClick={() => {
              if (collapsible) setOpen(false);
              onCancel?.();
            }}
          >
            Cancelar
          </button>
        )}
        <a
          className="kpi-help vocab-quickadd-link"
          href={`/vocabulario?attr=finish&alias=${encodeURIComponent(alias.trim() || defaultAlias)}`}
        >
          Más espacio en vocabulario →
        </a>
      </div>

      {error && <span className="vocab-quickadd-error">{error}</span>}
    </form>
  );
}
