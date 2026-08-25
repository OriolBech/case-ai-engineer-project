'use client';

/**
 * El esqueleto común de un alta de vocabulario desde la línea.
 *
 * POR QUÉ EXISTE. El acabado tenía un panel de verdad —texto editable, vista previa en vivo de lo que
 * el sistema ya sabe, la decisión con sus opciones explicadas, motivo, evidencia, el id que quedará
 * en la traza— y la calidad y el material tenían un `<select>` y un campo de texto. La consecuencia
 * no era estética: sin motivo ni evidencia, la decisión se guarda sin el porqué, y el porqué es lo
 * único que permite revisarla dentro de seis meses. Y sin vista previa, el comprador no sabe si está
 * a punto de decidir algo que ya estaba decidido.
 *
 * Así que la forma se comparte y lo único que cambia por atributo son los campos de la decisión, que
 * llegan como `children` (el mismo patrón que `FinishDecisionFields`): "¿AC o INOX?" y "¿con qué
 * grupo de §5 es intercambiable?" son preguntas distintas, pero todo lo que las rodea es idéntico.
 *
 * NO BLOQUEA. Igual que el de acabado: lo que dispararía una guarda (alias corto, ambigüedad,
 * regresión sobre el gold) se guarda y devuelve avisos en ámbar. Sólo lo estructuralmente imposible
 * —un id repetido, un grupo que no es de §5— responde error. El criterio es del repo, no mío: una
 * guarda que impide aprender acaba desactivada.
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { VocabResolution } from '../../src/rules/vocab-model.ts';
import { VOCAB_ACTOR } from '../lib/finish-vocab-ui.ts';

export interface VocabAddSubmit {
  /** El texto/valor que dispara la entrada, ya editado por quien decide. */
  match: string;
  rationale: string;
  evidence: string;
  decidedBy: string;
}

export interface VocabAddPanelProps {
  /** Atributo de la fachada `/api/vocabulary`. Gobierna la vista previa y el enlace. */
  attribute: 'material' | 'quality';
  title: string;
  /** Cómo se llama en esta pantalla el texto que dispara la entrada. */
  matchLabel: string;
  matchHint?: string;
  defaultMatch: string;
  /** El id que quedará en la traza de la compra. Se recalcula con el texto. */
  suggestedId: string;
  /** Los campos propios de la decisión de este atributo. */
  children: ReactNode;
  /**
   * El motivo deja de ser opcional. Lo pide una decisión que declara una AUSENCIA: sin el porqué,
   * "de esta calidad no se deduce el material" es indistinguible de que nadie la haya mirado, que es
   * justo la confusión que la decisión existe para deshacer. El backend la rechaza igual.
   */
  requireRationale?: boolean;
  /** Hace el POST. Devuelve los avisos del servidor; lanza si el alta se rechaza. */
  onSubmit: (input: VocabAddSubmit) => Promise<string[]>;
  /** Qué decir cuando ha ido bien. La consecuencia, no "guardado". */
  doneText: string;
  onMatchChange?: (match: string) => void;
}

export function VocabAddPanel({
  attribute,
  title,
  matchLabel,
  matchHint,
  defaultMatch,
  suggestedId,
  children,
  requireRationale,
  onSubmit,
  doneText,
  onMatchChange,
}: VocabAddPanelProps) {
  const [match, setMatch] = useState(defaultMatch);
  const [rationale, setRationale] = useState('');
  const [evidence, setEvidence] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'done' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => { setMatch(defaultMatch); }, [defaultMatch]);

  // Vista previa de lo que el sistema YA sabe de este texto. Es la diferencia entre decidir y
  // redecidir: si la calidad ya tiene grupo por una entrada anterior, aquí se lee antes de guardar.
  useEffect(() => {
    const text = match.trim();
    if (!text) { setPreview(null); return; }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/vocabulary', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attribute, text }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setPreview((body.resolution as VocabResolution).detail);
      } catch {
        setPreview(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [match, attribute]);

  const blocked = requireRationale && !rationale.trim()
    ? 'Escribe el motivo: una ausencia sin porqué no se distingue de un olvido.'
    : null;

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (requireRationale && !rationale.trim()) return;
    setState('saving');
    setError(null);
    setWarnings([]);
    try {
      const w = await onSubmit({
        match: match.trim(),
        rationale: rationale.trim(),
        evidence: evidence.trim(),
        decidedBy: VOCAB_ACTOR,
      });
      setWarnings(w);
      setState('done');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : String(e2));
      setState('error');
    }
  }, [match, rationale, evidence, onSubmit, requireRationale]);

  if (state === 'done') {
    return (
      <div className="vocab-quickadd-wrap">
        <p className="kpi-help vocab-quickadd-done">{doneText}</p>
        {warnings.length > 0 && (
          <div className="vocab-warning">
            <strong>Se ha guardado igual, pero ojo:</strong>
            <ul>{warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </div>
        )}
      </div>
    );
  }

  const href = `/vocabulario?attr=${attribute}&alias=${encodeURIComponent(match.trim() || defaultMatch)}`;

  return (
    <form className="vocab-add-panel" onSubmit={submit}>
      <div className="vocab-add-panel-head">
        <strong>{title}</strong>
        <span className="kpi-help">Id: <code>{suggestedId}</code></span>
      </div>

      <label>
        {matchLabel}
        <input
          value={match}
          onChange={(e) => { setMatch(e.target.value); onMatchChange?.(e.target.value); }}
          placeholder="tal como aparece en la fila"
          required
        />
        {matchHint && <span className="kpi-help">{matchHint}</span>}
        {preview && <span className="kpi-help">{preview}</span>}
      </label>

      {children}

      <label>
        Motivo {requireRationale
          ? <span className="vocab-required">(obligatorio)</span>
          : <span className="vocab-optional">(opcional)</span>}
        <input
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          placeholder="por qué se decide así"
          required={requireRationale}
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

      <div className="vocab-add-panel-actions">
        <button className="wf-btn primary small" type="submit" disabled={state === 'saving' || !!blocked}>
          {state === 'saving' ? 'Guardando…' : 'Guardar decisión'}
        </button>
        <a className="kpi-help vocab-quickadd-link" href={href}>Más espacio en vocabulario →</a>
        {blocked && <span className="kpi-help">{blocked}</span>}
      </div>

      {error && <span className="vocab-quickadd-error">{error}</span>}
    </form>
  );
}

/** POST a la fachada única. Devuelve los avisos; lanza con el mensaje del servidor si rechaza. */
export async function postVocab(body: Record<string, unknown>): Promise<string[]> {
  const res = await fetch('/api/vocabulary', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const parsed = await res.json();
  if (!res.ok) throw new Error(parsed.error ?? `HTTP ${res.status}`);
  return parsed.warnings ?? [];
}
