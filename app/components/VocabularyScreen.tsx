'use client';

/**
 * Página de vocabulario de derivación de material — ampliación de `src/rules/vocabulary-db.ts`
 * al front.
 *
 * Antes esta tabla sólo se veía y se ampliaba por CLI (`pnpm run vocab`). Esta página es la misma
 * tabla, sin lógica nueva: lee y escribe a través de `/api/vocabulary`, que es una fachada de
 * `listEntries` / `addEntry` / `retireEntry`. Una entrada añadida aquí queda en el mismo
 * `material-derivation.log.jsonl` que una añadida por CLI — el histórico no distingue el origen.
 *
 * Es una página propia (`/vocabulario`), no un modal: se consulta y se amplía con independencia de
 * estar procesando un MTO concreto — es la tabla del proyecto, no el resultado de una ejecución.
 */
import { useCallback, useEffect, useState } from 'react';
import { AppTopbar } from './AppTopbar.tsx';

interface VocabRow {
  id: string;
  matchKind: 'qualityGroup' | 'qualityPattern';
  matchValue: string;
  material: 'AC' | 'INOX';
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  source: string;
  retiredAt: string | null;
  retiredWhy: string | null;
}

interface UncoveredRow {
  matchKind: 'qualityGroup' | 'qualityPattern';
  matchValue: string;
  why: string;
}

interface VocabState {
  entries: VocabRow[];
  uncovered: UncoveredRow[];
}

const emptyForm = { id: '', matchKind: 'qualityPattern' as const, matchValue: '', material: 'AC' as const, rationale: '', decidedBy: '' };

interface FormState {
  id: string;
  matchKind: 'qualityGroup' | 'qualityPattern';
  matchValue: string;
  material: 'AC' | 'INOX';
  rationale: string;
  decidedBy: string;
}

export function VocabularyScreen() {
  const [state, setState] = useState<VocabState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch('/api/vocabulary');
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const submit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/vocabulary', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...form, source: 'UI comprador' }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState((s) => (s ? { ...s, entries: body.entries } : s));
      setForm(emptyForm);
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
      const res = await fetch(`/api/vocabulary?id=${encodeURIComponent(id)}&why=${encodeURIComponent(why)}`, { method: 'DELETE' });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setState((s) => (s ? { ...s, entries: body.entries } : s));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  const live = state?.entries.filter((r) => !r.retiredAt) ?? [];
  const retired = state?.entries.filter((r) => r.retiredAt) ?? [];

  return (
    <>
      <AppTopbar />
      <div className="vocab-page">
      <div className="vocab-page-inner">
        <header className="kpi-head">
          <div>
            <h2>Vocabulario de material</h2>
            <p className="kpi-sub">
              Sólo lo que está aquí deriva el material (AC / INOX) de una calidad. Cualquier otra
              calidad no cubierta hace dos cosas: manda esa línea concreta a revisión del comprador,
              y además apunta la calidad en general como una <strong>decisión pendiente del
              proyecto</strong> (lo que en “Cómo ha ido” aparece como “Decisiones que nadie ha tomado
              todavía”). Añadirla aquí una vez resuelve las dos cosas para siempre: la línea de hoy y
              todas las líneas futuras con esa misma calidad, en cualquier MTO.
            </p>
          </div>
        </header>

        {error && <p className="kpi-verdict">{error}</p>}

        <section className="kpi-section">
          <h3>Entradas vivas ({live.length})</h3>
          {!state ? (
            <p className="kpi-help">Cargando…</p>
          ) : live.length === 0 ? (
            <p className="kpi-help">Ninguna entrada todavía.</p>
          ) : (
            <table className="vocab-table">
              <thead>
                <tr>
                  <th>Coincide con</th>
                  <th>Material</th>
                  <th>Motivo</th>
                  <th>Decidido por</th>
                  <th>Fecha</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {live.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <code>{r.matchKind === 'qualityGroup' ? `grupo ${r.matchValue}` : `patrón ${r.matchValue}`}</code>
                    </td>
                    <td><span className="badge">{r.material}</span></td>
                    <td className="vocab-rationale">{r.rationale}</td>
                    <td>{r.decidedBy}</td>
                    <td>{r.decidedAt}</td>
                    <td>
                      <button className="wf-btn small" onClick={() => retire(r.id)}>Retirar</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {state && state.uncovered.length > 0 && (
          <section className="kpi-section">
            <h3>Declaradas no derivables a propósito ({state.uncovered.length})</h3>
            <p className="kpi-note">
              No son un hueco: alguien decidió que derivar aquí sería inventar (p. ej. una dureza HV
              no dice si el metal base es acero o inoxidable).
            </p>
            <ul className="kpi-cant-list">
              {state.uncovered.map((u) => (
                <li key={`${u.matchKind}-${u.matchValue}`}>
                  <strong>{u.matchValue}</strong> — {u.why}
                </li>
              ))}
            </ul>
          </section>
        )}

        {retired.length > 0 && (
          <section className="kpi-section">
            <h3>Retiradas ({retired.length})</h3>
            <ul className="kpi-cant-list">
              {retired.map((r) => (
                <li key={r.id}>
                  <strong>{r.matchValue}</strong> ({r.material}) — retirada el {r.retiredAt}: {r.retiredWhy}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="kpi-section">
          <h3>Añadir una entrada</h3>
          <p className="kpi-note">
            Para un caso visto durante el procesado de un MTO (sección “Decisiones que nadie ha
            tomado todavía” del panel “Cómo ha ido”), usa el botón “Añadir al vocabulario” de ese
            caso — viene precargado con el patrón sugerido. Este formulario es para dar de alta
            cualquier otro caso a mano.
          </p>
          <form className="vocab-form" onSubmit={submit}>
            <label>
              Id
              <input value={form.id} onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))} placeholder="p.ej. 45h-ac" required />
            </label>
            <label>
              Tipo de coincidencia
              <select value={form.matchKind} onChange={(e) => setForm((f) => ({ ...f, matchKind: e.target.value as 'qualityGroup' | 'qualityPattern' }))}>
                <option value="qualityPattern">Patrón exacto</option>
                <option value="qualityGroup">Grupo de calidad</option>
              </select>
            </label>
            <label>
              Valor / patrón
              <input value={form.matchValue} onChange={(e) => setForm((f) => ({ ...f, matchValue: e.target.value }))} placeholder="p.ej. ^45H$" required />
            </label>
            <label>
              Material
              <select value={form.material} onChange={(e) => setForm((f) => ({ ...f, material: e.target.value as 'AC' | 'INOX' }))}>
                <option value="AC">AC (acero)</option>
                <option value="INOX">INOX (inoxidable)</option>
              </select>
            </label>
            <label className="vocab-form-wide">
              Motivo
              <input value={form.rationale} onChange={(e) => setForm((f) => ({ ...f, rationale: e.target.value }))} placeholder="por qué esta calidad es este material" required />
            </label>
            <label>
              Decidido por
              <input value={form.decidedBy} onChange={(e) => setForm((f) => ({ ...f, decidedBy: e.target.value }))} placeholder="tu nombre" required />
            </label>
            <button className="wf-btn primary" type="submit" disabled={saving}>
              {saving ? 'Guardando…' : 'Añadir'}
            </button>
          </form>
        </section>
      </div>
      </div>
    </>
  );
}
