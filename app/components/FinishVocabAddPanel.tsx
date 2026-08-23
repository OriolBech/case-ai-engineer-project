'use client';

/**
 * Formulario compartido para dar de alta un alias de acabado desde la UI de compras.
 * Permite retocar alias, catálogo, motivo y evidencia antes de guardar.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { suggestFinishEntryId } from '../../src/rules/finish-vocab-id.ts';
import {
  FINISH_OPTIONS, loadDecidedBy, saveDecidedBy,
} from '../lib/finish-vocab-ui.ts';

export interface FinishVocabAddPanelProps {
  defaultAlias: string;
  defaultFinish?: string;
  source?: string;
  /** Empieza colapsado con un botón (p. ej. panel KPI). */
  collapsible?: boolean;
  onDone?: (alias: string) => void;
  onCancel?: () => void;
}

export function FinishVocabAddPanel({
  defaultAlias,
  defaultFinish = 'CINCADO',
  source = 'UI comprador',
  collapsible = false,
  onDone,
  onCancel,
}: FinishVocabAddPanelProps) {
  const [open, setOpen] = useState(!collapsible);
  const [alias, setAlias] = useState(defaultAlias);
  const [kind, setKind] = useState<'alias' | 'not_a_finish'>('alias');
  const [finish, setFinish] = useState(defaultFinish);
  const [rationale, setRationale] = useState('');
  const [evidence, setEvidence] = useState('');
  const [decidedBy, setDecidedBy] = useState(() => loadDecidedBy());
  const [allowShort, setAllowShort] = useState(defaultAlias.trim().length < 3);
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { setAlias(defaultAlias); }, [defaultAlias]);

  const suggestedId = useMemo(() => suggestFinishEntryId(alias), [alias]);
  const short = alias.trim().length > 0 && alias.trim().length < 3;

  useEffect(() => {
    const text = alias.trim();
    if (!text || !open) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/finish-vocabulary', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ alias: text }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        const r = body.resolution;
        if (r.kind === 'known') setPreview(`Ya resuelve a ${r.finish}.`);
        else if (r.kind === 'not_a_finish') setPreview('Ya declarado como no acabado.');
        else if (r.kind === 'ambiguous') setPreview('Ambiguo: hay varias entradas.');
        else setPreview('Todavía desconocido — al guardar aplicará a todos los MTO.');
      } catch {
        setPreview(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [alias, open]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setState('saving');
    setError(null);
    try {
      saveDecidedBy(decidedBy);
      const res = await fetch('/api/finish-vocabulary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          alias: alias.trim(),
          kind,
          finish: kind === 'alias' ? finish : null,
          rationale: rationale.trim(),
          evidence: evidence.trim(),
          decidedBy: decidedBy.trim(),
          source,
          allowShortAlias: allowShort || alias.trim().length < 3,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState('done');
      onDone?.(alias.trim());
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
      setState('error');
    }
  }, [alias, kind, finish, rationale, evidence, decidedBy, allowShort, source, onDone]);

  if (state === 'done') {
    return (
      <p className="kpi-help vocab-quickadd-done">
        Guardado. «{alias.trim()}» se aplicará igual en todos los MTO futuros.
      </p>
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
          href={`/vocabulario/acabado?alias=${encodeURIComponent(defaultAlias)}`}
        >
          Abrir formulario completo
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

      <label>
        Decisión
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'alias' | 'not_a_finish')}
        >
          <option value="alias">Equivale a un acabado del catálogo</option>
          <option value="not_a_finish">No es un acabado</option>
        </select>
      </label>

      {kind === 'alias' && (
        <label>
          Acabado del catálogo
          <select value={finish} onChange={(e) => setFinish(e.target.value)}>
            {FINISH_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <span className="kpi-help">{FINISH_OPTIONS.find((o) => o.value === finish)?.hint}</span>
        </label>
      )}

      {kind === 'not_a_finish' && (
        <p className="kpi-note">
          Recubrimientos fuera de los siete (niquelado, PTFE, pintura…) no se dan de alta aquí: hay
          que escalar al cliente.
        </p>
      )}

      <label>
        Motivo
        <input
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="por qué este texto es ese acabado"
          required
        />
      </label>

      <label>
        Evidencia
        <input
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="pliego §, norma, mail del proveedor…"
          required
        />
      </label>

      <label>
        Tu nombre
        <input
          value={decidedBy}
          onChange={(e) => setDecidedBy(e.target.value)}
          placeholder="quién firma la decisión"
          required
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
          disabled={state === 'saving' || (short && !allowShort)}
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
          href={`/vocabulario/acabado?alias=${encodeURIComponent(alias.trim() || defaultAlias)}`}
        >
          Más espacio en vocabulario →
        </a>
      </div>

      {error && <span className="vocab-quickadd-error">{error}</span>}
    </form>
  );
}
