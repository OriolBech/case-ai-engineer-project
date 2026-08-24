'use client';

/**
 * Vocabulario común, en UNA sola vista.
 *
 * Sustituye a las dos pantallas separadas (`VocabularyScreen` = material, `FinishVocabularyScreen` =
 * acabado). El atributo es un filtro, no una ruta: el comprador ve y amplía todo el vocabulario sin
 * saltar de página. Habla solo con `/api/vocabulary`, la fachada única.
 *
 * El alta NO bloquea (decisión de producto para la demo): una entrada que dispararía una guarda se
 * guarda igual y sus avisos se pintan en ámbar. Solo lo estructuralmente imposible (id repetido,
 * alias sin acabado) devuelve error y no se guarda.
 *
 * Se monta como página (`/vocabulario`, con topbar) o como panel embebido (`embedded`, para el
 * drawer sobre la cola).
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  VOCAB_ATTRIBUTES,
  type VocabAttribute,
  type VocabEntry,
  type VocabResolution,
  type VocabUncovered,
} from '../../src/rules/vocab-model.ts';
import { VOCAB_ACTOR } from '../lib/finish-vocab-ui.ts';
import { AppTopbar } from './AppTopbar.tsx';
import type { SuggestionPatch } from './App.tsx';
import { FinishDecisionFields, type FinishDecision } from './FinishDecisionFields.tsx';

interface ValueConflictRow {
  rowRef: string;
  attribute: string;
  evidence: string;
  values: Array<{ value: string | null; at: string; correctionId: string }>;
  status: 'UNRESOLVED';
}

type AttrFilter = VocabAttribute | 'todos';

interface VocabData {
  entries: VocabEntry[];
  uncovered: VocabUncovered[];
  finishCatalog: string[];
}

interface Props {
  initialAttribute?: AttrFilter;
  /** Precarga el texto del alta (viene de un hueco o de una línea en revisión). */
  initialAlias?: string;
  /** true en el drawer: sin topbar, layout compacto. */
  embedded?: boolean;
  /** Re-aplica el alta en caliente a las líneas del MTO abierto (drawer sobre la cola). */
  onApplied?: (p: SuggestionPatch) => void;
}

const ATTR_LABEL: Record<VocabAttribute, string> = Object.fromEntries(
  VOCAB_ATTRIBUTES.map((a) => [a.key, a.label]),
) as Record<VocabAttribute, string>;

const isEditable = (attr: VocabAttribute): boolean =>
  VOCAB_ATTRIBUTES.find((a) => a.key === attr)?.editable ?? false;

interface FormState {
  attribute: VocabAttribute;
  match: string;
  finishDecision: FinishDecision;
  finish: string;
  newFinishName: string;
  material: 'AC' | 'INOX';
  matchKind: 'qualityPattern' | 'qualityGroup';
  rationale: string;
  evidence: string;
}

function emptyForm(attribute: VocabAttribute, match = ''): FormState {
  return {
    attribute,
    match,
    finishDecision: 'catalog',
    finish: 'CINCADO',
    newFinishName: '',
    material: 'AC',
    matchKind: 'qualityPattern',
    rationale: '',
    evidence: '',
  };
}

export function VocabularyView({ initialAttribute = 'todos', initialAlias = '', embedded = false, onApplied }: Props) {
  const [data, setData] = useState<VocabData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AttrFilter>(initialAttribute);
  const [search, setSearch] = useState('');
  const [includeRetired, setIncludeRetired] = useState(false);

  const formAttr: VocabAttribute = initialAttribute === 'todos' ? 'finish' : initialAttribute;
  const [form, setForm] = useState<FormState>(() => emptyForm(formAttr, initialAlias));
  const [saving, setSaving] = useState(false);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [preview, setPreview] = useState<VocabResolution | null>(null);
  const [conflicts, setConflicts] = useState<ValueConflictRow[]>([]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const [vocabRes, corrRes] = await Promise.all([fetch('/api/vocabulary'), fetch('/api/corrections')]);
      const body = await vocabRes.json();
      if (!vocabRes.ok) throw new Error(body.error ?? `HTTP ${vocabRes.status}`);
      setData({
        entries: body.entries,
        uncovered: body.uncovered,
        finishCatalog: body.finishCatalog ?? [],
      });
      if (corrRes.ok) {
        const corrBody = await corrRes.json();
        setConflicts(Array.isArray(corrBody.conflicts) ? corrBody.conflicts : []);
      } else {
        setConflicts([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Vista previa en vivo: a qué resuelve HOY el texto para el atributo elegido (también en solo lectura).
  useEffect(() => {
    const text = form.match.trim();
    if (!text) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/vocabulary', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ attribute: form.attribute, text }),
        });
        const body = await res.json();
        if (res.ok) setPreview(body.resolution as VocabResolution);
      } catch {
        setPreview(null);
      }
    }, 300);
    return () => window.clearTimeout(t);
  }, [form.match, form.attribute]);

  const counts = useMemo(() => {
    const c: Record<AttrFilter, number> = { todos: 0, name: 0, material: 0, quality: 0, norma: 0, finish: 0 };
    for (const e of data?.entries ?? []) {
      if (e.retiredAt) continue;
      c.todos++;
      c[e.attribute]++;
    }
    return c;
  }, [data]);

  const visibleEntries = useMemo(() => {
    let out = data?.entries ?? [];
    if (!includeRetired) out = out.filter((e) => !e.retiredAt);
    if (filter !== 'todos') out = out.filter((e) => e.attribute === filter);
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      out = out.filter(
        (e) =>
          e.match.toUpperCase().includes(q) ||
          (e.value ?? '').toUpperCase().includes(q) ||
          (e.evidence ?? '').toUpperCase().includes(q),
      );
    }
    return out;
  }, [data, filter, search, includeRetired]);

  const visibleUncovered = useMemo(() => {
    if (filter !== 'todos' && filter !== 'material') return [];
    return data?.uncovered ?? [];
  }, [data, filter]);

  const submit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (form.attribute === 'finish' && form.finishDecision === 'new' && !form.newFinishName.trim()) {
        setError('Escribe el nombre canónico del acabado nuevo.');
        return;
      }
      setSaving(true);
      setError(null);
      setWarnings([]);
      setOkMsg(null);
      try {
        const value =
          form.attribute === 'finish'
            ? form.finishDecision === 'not_a_finish'
              ? null
              : form.finishDecision === 'new'
                ? form.newFinishName.trim()
                : form.finish
            : form.attribute === 'material'
              ? form.material
              : null;
        const kind =
          form.attribute === 'finish'
            ? form.finishDecision === 'not_a_finish'
              ? 'not_a_finish'
              : 'alias'
            : undefined;
        const res = await fetch('/api/vocabulary', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            attribute: form.attribute,
            match: form.match.trim(),
            value,
            kind,
            matchKind: form.attribute === 'material' ? form.matchKind : undefined,
            rationale: form.rationale.trim(),
            evidence: form.evidence.trim() || undefined,
            decidedBy: VOCAB_ACTOR,
            allowShortAlias: true,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setData({
          entries: body.entries,
          uncovered: body.uncovered,
          finishCatalog: body.finishCatalog ?? data?.finishCatalog ?? [],
        });
        setWarnings(body.warnings ?? []);
        if (form.attribute === 'finish') {
          onApplied?.({ attribute: 'finish', match: form.match.trim(), value });
        } else if (form.attribute === 'material' && value !== null) {
          onApplied?.({ attribute: 'material', match: form.match.trim(), value });
        }
        setOkMsg(
          onApplied
            ? `«${form.match.trim()}» guardado y aplicado a este MTO.`
            : `«${form.match.trim()}» guardado. Aplicará igual en todos los MTO futuros.`,
        );
        setForm((f) => emptyForm(f.attribute));
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : String(e2));
      } finally {
        setSaving(false);
      }
    },
    [form, onApplied, data?.finishCatalog],
  );

  const finishCatalog = data?.finishCatalog ?? [];

  const retire = useCallback(
    async (entry: VocabEntry) => {
      const why = window.prompt(`¿Por qué se retira «${entry.match}»?`, '');
      if (why === null) return;
      try {
        const params = new URLSearchParams({ attribute: entry.attribute, id: entry.id, why });
        const res = await fetch(`/api/vocabulary?${params.toString()}`, { method: 'DELETE' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        setData({ entries: body.entries, uncovered: body.uncovered, finishCatalog: body.finishCatalog ?? finishCatalog });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [finishCatalog],
  );

  const body = (
    <div className={embedded ? 'vocab-view embedded' : 'vocab-view'}>
      <header className="kpi-head">
        <div>
          <h2>Vocabulario común</h2>
          <p className="kpi-sub">
            Un único sitio para todo lo que el sistema sabe traducir: nombres, material, calidad, norma
            y acabado. Lo marcado <strong>catálogo</strong> es del cliente y no se toca; lo marcado{' '}
            <strong>añadido</strong> lo amplía compras aquí, y aplica igual en todos los MTO siguientes.
          </p>
        </div>
      </header>

      {error && <p className="kpi-verdict">{error}</p>}

      {conflicts.length > 0 && (
        <section className="kpi-section">
          <h3>Decisiones pendientes ({conflicts.length})</h3>
          <p className="kpi-note">
            Dos valores distintos sobre la misma celda no son un fallo del extractor: es la casa la que
            aún no ha escrito la regla. Resolver aquí es elegir un valor y rechazar el otro — no hay
            promedio ni voto automático.
          </p>
          <ul className="kpi-cant-list">
            {conflicts.map((c) => (
              <li key={`${c.rowRef}-${c.attribute}-${c.evidence}`}>
                <strong>Fila {c.rowRef}</strong> · {c.attribute} · «{c.evidence}»
                <ul>
                  {c.values.map((v) => (
                    <li key={v.correctionId}>
                      <code>{v.value ?? '—'}</code>
                      <span className="kpi-help"> · {v.at.slice(0, 10)}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* --- alta ágil ------------------------------------------------------ */}
      <section className="kpi-section vocab-add">
        <h3>Añadir al vocabulario</h3>
        <form className="vocab-form" onSubmit={submit}>
          <label className="vocab-form-wide">
            Atributo
            <select
              value={form.attribute}
              onChange={(ev) => setForm((f) => emptyForm(ev.target.value as VocabAttribute, f.match))}
            >
              {VOCAB_ATTRIBUTES.map((a) => (
                <option key={a.key} value={a.key} disabled={!a.editable}>
                  {a.label}
                  {a.editable ? '' : ' (solo lectura)'}
                </option>
              ))}
            </select>
          </label>

          <label className="vocab-form-wide">
            {form.attribute === 'material' ? 'Calidad (valor o patrón)' : 'Texto del MTO'}
            <input
              value={form.match}
              onChange={(ev) => setForm((f) => ({ ...f, match: ev.target.value }))}
              placeholder={form.attribute === 'material' ? 'p. ej. ^45H$ o A4-90' : 'tal como aparece en la fila'}
              required
            />
            {preview && (
              <span className={`vocab-preview${preview.known ? ' known' : ' unknown'}`}>{preview.detail}</span>
            )}
          </label>

          {form.attribute === 'finish' && (
            <FinishDecisionFields
              className="vocab-form-wide"
              decision={form.finishDecision}
              onDecisionChange={(d) => setForm((f) => ({ ...f, finishDecision: d }))}
              catalogValue={form.finish}
              onCatalogValueChange={(v) => setForm((f) => ({ ...f, finish: v }))}
              newFinishName={form.newFinishName}
              onNewFinishNameChange={(v) => setForm((f) => ({ ...f, newFinishName: v }))}
              finishCatalog={finishCatalog}
              aliasText={form.match}
            />
          )}

          {form.attribute === 'material' && (
            <>
              <label>
                Tipo de coincidencia
                <select
                  value={form.matchKind}
                  onChange={(ev) => setForm((f) => ({ ...f, matchKind: ev.target.value as FormState['matchKind'] }))}
                >
                  <option value="qualityPattern">Patrón exacto</option>
                  <option value="qualityGroup">Grupo de calidad</option>
                </select>
              </label>
              <label>
                Material
                <select value={form.material} onChange={(ev) => setForm((f) => ({ ...f, material: ev.target.value as 'AC' | 'INOX' }))}>
                  <option value="AC">AC (acero)</option>
                  <option value="INOX">INOX (inoxidable)</option>
                </select>
              </label>
            </>
          )}

          <label className="vocab-form-wide">
            Motivo <span className="vocab-optional">(opcional)</span>
            <input
              value={form.rationale}
              onChange={(ev) => setForm((f) => ({ ...f, rationale: ev.target.value }))}
              placeholder="por qué este texto es ese valor"
            />
          </label>

          <label className="vocab-form-wide">
            Evidencia <span className="vocab-optional">(opcional)</span>
            <input
              value={form.evidence}
              onChange={(ev) => setForm((f) => ({ ...f, evidence: ev.target.value }))}
              placeholder="pliego §, norma, proveedor…"
            />
          </label>

          <button
            className="wf-btn primary"
            type="submit"
            disabled={
              saving ||
              !isEditable(form.attribute) ||
              (form.attribute === 'finish' && form.finishDecision === 'new' && !form.newFinishName.trim())
            }
          >
            {saving ? 'Guardando…' : 'Añadir'}
          </button>
        </form>

        {!isEditable(form.attribute) && (
          <p className="kpi-note">
            {ATTR_LABEL[form.attribute]} es de momento solo lectura: su capa editable llega en una
            próxima iteración.
          </p>
        )}
        {okMsg && <p className="vocab-ok">{okMsg}</p>}
        {warnings.length > 0 && (
          <div className="vocab-warning">
            <strong>Se ha guardado igual, pero ojo:</strong>
            <ul>
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* --- filtro + búsqueda --------------------------------------------- */}
      <div className="vocab-toolbar">
        <div className="pillgroup" role="group" aria-label="Filtrar por atributo">
          <button className={`pill${filter === 'todos' ? ' on' : ''}`} onClick={() => setFilter('todos')}>
            Todos <span className="count">{counts.todos}</span>
          </button>
          {VOCAB_ATTRIBUTES.map((a) => (
            <button key={a.key} className={`pill${filter === a.key ? ' on' : ''}`} onClick={() => setFilter(a.key)}>
              {a.label} <span className="count">{counts[a.key]}</span>
            </button>
          ))}
        </div>
        <div className="vocab-toolbar-end">
          <label className="vocab-check">
            <input type="checkbox" checked={includeRetired} onChange={(e) => setIncludeRetired(e.target.checked)} />
            Ver retiradas
          </label>
          <input
            className="search-input"
            placeholder="Buscar por texto, valor o quién…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* --- tabla única --------------------------------------------------- */}
      <section className="kpi-section">
        {!data ? (
          <p className="kpi-help">Cargando…</p>
        ) : visibleEntries.length === 0 ? (
          <p className="kpi-help">Ninguna entrada para este filtro.</p>
        ) : (
          <table className="vocab-table">
            <thead>
              <tr>
                <th>Atributo</th>
                <th>Coincide con</th>
                <th>Resuelve a</th>
                <th>Origen</th>
                <th>Evidencia</th>
                <th>Fecha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visibleEntries.map((e) => (
                <tr key={`${e.attribute}-${e.id}`} className={e.retiredAt ? 'retired' : ''}>
                  <td>
                    <span className="vocab-attr-tag">{ATTR_LABEL[e.attribute]}</span>
                  </td>
                  <td>
                    <code>{e.matchLabel}</code>
                  </td>
                  <td>{e.value ? <span className="badge">{e.value}</span> : <span className="kpi-help">no-acabado</span>}</td>
                  <td>
                    <span className={`vocab-origin ${e.source}`}>{e.source === 'client' ? 'catálogo' : 'añadido'}</span>
                  </td>
                  <td className="vocab-evidence">{e.evidence || <span className="kpi-help">—</span>}</td>
                  <td>{e.retiredAt ? <s>{e.decidedAt}</s> : e.decidedAt}</td>
                  <td>
                    {e.retiredAt ? (
                      <span className="kpi-help" title={e.retiredWhy ?? ''}>
                        retirada
                      </span>
                    ) : e.source === 'added' && isEditable(e.attribute) ? (
                      <button className="wf-btn small" onClick={() => retire(e)}>
                        Retirar
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {visibleUncovered.length > 0 && (
        <section className="kpi-section">
          <h3>Declaradas no derivables a propósito ({visibleUncovered.length})</h3>
          <p className="kpi-note">
            No son un hueco: alguien decidió que derivar aquí sería inventar (p. ej. una dureza HV no
            dice si el metal base es acero o inoxidable).
          </p>
          <ul className="kpi-cant-list">
            {visibleUncovered.map((u) => (
              <li key={`${u.attribute}-${u.match}`}>
                <strong>{u.match}</strong> — {u.why}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );

  if (embedded) return body;
  return (
    <>
      <AppTopbar />
      <div className="vocab-page">
        <div className="vocab-page-inner">{body}</div>
      </div>
    </>
  );
}
