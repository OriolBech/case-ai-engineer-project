'use client';

/**
 * Vocabulario de acabado — interfaz para compras.
 *
 * El comprador no tiene que inventar ids ni usar la CLI: el texto del MTO, la decisión (catálogo §9
 * o “no es acabado”), el motivo y la evidencia bastan. Desde “Cómo ha ido” el botón “Añadir al
 * vocabulario” precarga el alias del hueco.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FINISH_OPTIONS, loadDecidedBy, saveDecidedBy,
} from '../lib/finish-vocab-ui.ts';
import { AppTopbar } from './AppTopbar.tsx';

interface FinishRow {
  id: string;
  alias: string;
  kind: 'alias' | 'not_a_finish';
  finish: string | null;
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  source: string;
  evidence: string;
  retiredAt: string | null;
  retiredWhy: string | null;
}

interface FinishState {
  entries: FinishRow[];
}

interface FormState {
  alias: string;
  kind: 'alias' | 'not_a_finish';
  finish: string;
  rationale: string;
  decidedBy: string;
  evidence: string;
  allowShortAlias: boolean;
}

const emptyForm = (): FormState => ({
  alias: '',
  kind: 'alias',
  finish: 'CINCADO',
  rationale: '',
  decidedBy: loadDecidedBy(),
  evidence: '',
  allowShortAlias: false,
});

interface Props {
  initialAlias?: string;
}

function slugId(alias: string): string {
  const slug = alias.trim().toLowerCase()
    .normalize('NFD').replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `finish-${slug || 'nuevo'}`;
}

export function FinishVocabularyScreen({ initialAlias }: Props) {
  const [state, setState] = useState<FinishState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => ({
    ...emptyForm(),
    alias: initialAlias?.trim() ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const suggestedId = useMemo(() => slugId(form.alias), [form.alias]);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/finish-vocabulary');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    const alias = form.alias.trim();
    if (!alias) {
      setPreview(null);
      return;
    }
    const t = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/finish-vocabulary', {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ alias }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        const r = body.resolution;
        if (r.kind === 'known') setPreview(`Ya resuelve a ${r.finish} (${r.entryId}).`);
        else if (r.kind === 'not_a_finish') setPreview('Ya está declarado como no acabado.');
        else if (r.kind === 'ambiguous') setPreview('Ambiguo: hay varias entradas que lo cubren.');
        else setPreview('Todavía desconocido: al guardar se aplicará a todos los MTO.');
      } catch {
        setPreview(null);
      }
    }, 350);
    return () => window.clearTimeout(t);
  }, [form.alias]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      saveDecidedBy(form.decidedBy);
      const res = await fetch('/api/finish-vocabulary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          alias: form.alias.trim(),
          kind: form.kind,
          finish: form.kind === 'alias' ? form.finish : null,
          rationale: form.rationale.trim(),
          decidedBy: form.decidedBy.trim(),
          evidence: form.evidence.trim(),
          source: 'UI comprador',
          allowShortAlias: form.allowShortAlias || form.alias.trim().length < 3,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState(body);
      setForm({ ...emptyForm(), decidedBy: form.decidedBy.trim() });
      setSuccess(`Guardado. "${form.alias.trim()}" quedará resuelto igual en todos los MTO futuros.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [form]);

  const retire = useCallback(async (id: string) => {
    const why = window.prompt(`¿Por qué se retira '${id}'?`, '');
    if (why === null) return;
    try {
      const res = await fetch(
        `/api/finish-vocabulary?id=${encodeURIComponent(id)}&why=${encodeURIComponent(why)}`,
        { method: 'DELETE' },
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const live = state?.entries.filter((r) => !r.retiredAt) ?? [];
  const retired = state?.entries.filter((r) => r.retiredAt) ?? [];
  const shortAlias = form.alias.trim().length > 0 && form.alias.trim().length < 3;

  return (
    <>
      <AppTopbar />
      <div className="vocab-page">
        <div className="vocab-page-inner">
          <header className="kpi-head">
            <div>
              <h2>Vocabulario de acabado</h2>
              <p className="kpi-sub">
                Los siete acabados del catálogo son fijos; aquí decides qué <strong>texto del MTO</strong>{' '}
                equivale a cada uno, o si un texto <strong>no es un acabado</strong> (p. ej. «según pliego»,
                «pintado RAL…»). Lo decides <strong>una vez</strong> y el sistema lo aplica en todos los
                MTO que vengan. Si ves un hueco en «Cómo ha ido», usa el botón «Añadir al vocabulario»
                de ese caso — te trae el texto ya escrito.
              </p>
            </div>
          </header>

          {error && <p className="kpi-verdict">{error}</p>}
          {success && <p className="kpi-verdict ok">{success}</p>}

          <section className="kpi-section vocab-add-card">
            <h3>Cerrar un hueco</h3>
            <p className="kpi-note">
              Escribe el texto tal como aparece en el MTO. No hace falta un identificador técnico: se
              genera solo (<code>{suggestedId}</code>).
            </p>
            <form className="vocab-form" onSubmit={submit}>
              <label className="vocab-form-wide">
                Texto del MTO
                <input
                  value={form.alias}
                  onChange={(e) => setForm((f) => ({ ...f, alias: e.target.value }))}
                  placeholder="p. ej. tropicalizado, Delta-Protekt KL 100, PLAIN"
                  required
                  autoFocus={!!initialAlias}
                />
                {preview && <span className="kpi-help">{preview}</span>}
              </label>
              <label className="vocab-form-wide">
                Decisión
                <select
                  value={form.kind}
                  onChange={(e) => setForm((f) => ({
                    ...f,
                    kind: e.target.value as 'alias' | 'not_a_finish',
                  }))}
                >
                  <option value="alias">Equivale a un acabado del catálogo</option>
                  <option value="not_a_finish">No es un acabado (texto administrativo, pintura…)</option>
                </select>
              </label>
              {form.kind === 'alias' && (
                <label className="vocab-form-wide">
                  Acabado del catálogo
                  <select
                    value={form.finish}
                    onChange={(e) => setForm((f) => ({ ...f, finish: e.target.value }))}
                  >
                    {FINISH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <span className="kpi-help">
                    {FINISH_OPTIONS.find((o) => o.value === form.finish)?.hint}
                  </span>
                </label>
              )}
              {form.kind === 'not_a_finish' && (
                <p className="kpi-note vocab-form-wide">
                  Si el texto es un recubrimiento que no está en los siete (niquelado, PTFE, pintura…),
                  no lo des de alta aquí: escala al cliente — cambiaría el catálogo §9.
                </p>
              )}
              <label className="vocab-form-wide">
                Motivo
                <input
                  value={form.rationale}
                  onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))}
                  placeholder="por qué este texto es ese acabado (o por qué no lo es)"
                  required
                />
              </label>
              <label className="vocab-form-wide">
                Evidencia
                <input
                  value={form.evidence}
                  onChange={(e) => setForm((f) => ({ ...f, evidence: e.target.value }))}
                  placeholder="pliego §4.2, mail del proveedor, norma ASTM…"
                  required
                />
              </label>
              <label>
                Tu nombre
                <input
                  value={form.decidedBy}
                  onChange={(e) => setForm((f) => ({ ...f, decidedBy: e.target.value }))}
                  placeholder="quién toma la decisión"
                  required
                />
              </label>
              {shortAlias && (
                <label className="vocab-form-wide vocab-check">
                  <input
                    type="checkbox"
                    checked={form.allowShortAlias}
                    onChange={(e) => setForm((f) => ({ ...f, allowShortAlias: e.target.checked }))}
                  />
                  Confirmo que el alias corto «{form.alias.trim()}» es deliberado (ZN, HDZ…)
                </label>
              )}
              <button className="wf-btn primary" type="submit" disabled={saving || (shortAlias && !form.allowShortAlias)}>
                {saving ? 'Guardando…' : 'Guardar decisión'}
              </button>
            </form>
          </section>

          <section className="kpi-section">
            <h3>Decisiones ya tomadas ({live.length})</h3>
            {!state ? (
              <p className="kpi-help">Cargando…</p>
            ) : live.length === 0 ? (
              <p className="kpi-help">Ninguna entrada todavía.</p>
            ) : (
              <table className="vocab-table">
                <thead>
                  <tr>
                    <th>Texto del MTO</th>
                    <th>Salida</th>
                    <th>Motivo</th>
                    <th>Evidencia</th>
                    <th>Decidido por</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {live.map((r) => (
                    <tr key={r.id}>
                      <td><code>{r.alias}</code></td>
                      <td>{r.kind === 'alias' ? r.finish : 'no es acabado'}</td>
                      <td className="vocab-rationale">{r.rationale}</td>
                      <td>{r.evidence}</td>
                      <td>{r.decidedBy}</td>
                      <td>
                        <button className="wf-btn small" onClick={() => retire(r.id)}>Retirar</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {retired.length > 0 && (
            <section className="kpi-section">
              <h3>Retiradas ({retired.length})</h3>
              <ul className="kpi-cant-list">
                {retired.map((r) => (
                  <li key={r.id}>
                    <strong>{r.alias}</strong> — retirada el {r.retiredAt}: {r.retiredWhy}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="kpi-help">
            ¿Vienes de un MTO concreto? Tras procesarlo, abre <a href="/">Inicio</a> → «Cómo ha ido»
            → «Decisiones que nadie ha tomado todavía» y usa «Añadir al vocabulario» en el acabado.
          </p>
        </div>
      </div>
    </>
  );
}
