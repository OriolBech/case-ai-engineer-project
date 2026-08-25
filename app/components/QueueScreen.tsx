'use client';

import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, type OutputLine, type ReasonCode } from '../../src/pipeline/types.ts';
import {
  PROVENANCE_LABEL, downloadCsv, effectiveQueue, groupByFamily, groupByRow, isMarked, linesToCsv,
  queueOf, type RowGroup,
} from '../lib/derive.ts';
import type { PolicyBacklogItem } from '../../src/pipeline/coverage.ts';
import { lineNeedsFinishVocab } from '../lib/finish-vocab-ui.ts';
import { blockingAttributes } from '../lib/line-decisions.ts';
import { StatusBadge } from './StatusBadge.tsx';

type Tab = 'todas' | 'resuelta' | 'revision' | 'fuera-familia';
type GroupMode = 'fila' | 'familia';

const PAGE_SIZE = 20;

/**
 * Lo que dice el punto de una celda marcada, en la lengua de quien compra.
 *
 * Antes decía `extracted_uncatalogued: quality:out_of_catalog`, que es el enum y la regla — y
 * SPEC-008 pide exactamente lo contrario: *"el motivo en texto legible, no un código"*. El caso que
 * lo destapó es el MTO del enunciado: sus filas 1, 5 y 12 salen RESUELTAS con la calidad `GR B7` o
 * `GR 2H` marcada, y §5 nombra esos dos valores **por su nombre** como el ejemplo de lo que hay que
 * extraer tal cual. El sistema acierta; el punto se leía como si hubiera hecho algo raro.
 *
 * Así que el literal fuera de catálogo tiene su propio texto: el valor es exacto —lo pone la fila—,
 * lo que no se sabe es con qué grupo de §5 es intercambiable. Es una equivalencia que falta, no un
 * dato en duda, y la diferencia es la que hay entre "revisa esto" y "puedes enseñarme esto".
 */
function markTitle(provenance: string, rule: string | null): string {
  if (provenance === 'extracted_uncatalogued') {
    return 'Literal de la fila, fuera de la lista de §5. Las reglas mandan conservarlo tal cual '
      + '(es el caso de los grados ASTM: GR B7, GR 2H). El valor es exacto; lo que el sistema no '
      + 'sabe es con qué grupo es intercambiable. Abre la línea para declararlo.';
  }
  const label = PROVENANCE_LABEL[provenance as keyof typeof PROVENANCE_LABEL] ?? provenance;
  return rule ? `${label} · ${rule}` : label;
}

function attrCell(line: OutputLine, key: (typeof ATTRIBUTE_KEYS)[number]) {
  const a = line.attributes[key];
  const pendingFinish = key === 'finish' && lineNeedsFinishVocab(line);
  const display = a.normalized ?? (pendingFinish && a.raw ? a.raw : null);
  return (
    <span className="attr-cell">
      <span className={`attr-value${display === null ? ' empty' : ''}${pendingFinish ? ' pending' : ''}`}>
        {display ?? '—'}
      </span>
      {a.normalized !== null && isMarked(a.provenance) && (
        <span className="attr-mark" title={markTitle(a.provenance, a.rule)}>●</span>
      )}
      {pendingFinish && (
        <span className="attr-mark pending" title="Acabado en la fila, no reconocido por el catálogo">?</span>
      )}
    </span>
  );
}

/**
 * El aviso de que esta línea esconde una decisión, no una revisión.
 *
 * Es lo que hace descubrible el desplegable: la decisión se toma abriendo la línea
 * (`LineDecisions`), y sin este texto habría que saberlo de memoria. Se nombra el atributo, porque
 * "clic para decidir" a secas no dice qué se decide.
 *
 * SÓLO lo que bloquea. Una línea resuelta a la que además se le puede afinar el vocabulario —una
 * calidad fuera de §5 que §5 manda conservar tal cual— no lleva aviso: la cola es la lista de lo que
 * falta, y marcar ahí una línea que ya está lista para pedir es mandar a mirar lo que no lo necesita.
 */
function decisionHint(line: OutputLine, backlog: readonly PolicyBacklogItem[]): string | null {
  const label = { quality: 'la calidad', material: 'el material', finish: 'el acabado' } as const;
  const attrs = new Set<string>(blockingAttributes(line, backlog).map((a) => label[a]));
  if (attrs.size === 0) return null;
  const list = [...attrs];
  const text = list.length === 1 ? list[0] : `${list.slice(0, -1).join(', ')} y ${list[list.length - 1]}`;
  return `Clic para decidir ${text}`;
}

export function QueueScreen({
  lines,
  rowsSourceText,
  confirmed,
  reopened,
  onValidate,
  onReopen,
  onOpenTrace,
  processedMtoId,
  backlog = [],
}: {
  lines: OutputLine[];
  rowsSourceText: Map<string, string>;
  confirmed: Set<string>;
  /** Líneas resueltas que una persona ha devuelto a revisión en esta sesión. */
  reopened: Set<string>;
  onValidate: (ids: string[]) => void;
  /** La vuelta atrás desde "resuelta". Ver `effectiveQueue` en `app/lib/derive.ts`. */
  onReopen: (ids: string[]) => void;
  onOpenTrace: (lineId: string) => void;
  /** Id del MTO en histórico; necesario para registrar exportación RFQ. */
  processedMtoId?: string | null;
  /** Decisiones que el proyecto debe: aquí solo se avisa de cuáles cuelgan de cada línea. */
  backlog?: readonly PolicyBacklogItem[];
}) {
  const [tab, setTab] = useState<Tab>('todas');
  const [groupMode, setGroupMode] = useState<GroupMode>('fila');
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<ReasonCode | 'todos'>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const c = { todas: lines.length, resuelta: 0, revision: 0, 'fuera-familia': 0 };
    for (const l of lines) c[effectiveQueue(l, confirmed, reopened)]++;
    return c;
  }, [lines, confirmed, reopened]);

  const byTab = useMemo(() => {
    if (tab === 'todas') return lines;
    return lines.filter((l) => effectiveQueue(l, confirmed, reopened) === tab);
  }, [lines, tab, confirmed, reopened]);

  const reasonOptions = useMemo(() => {
    if (tab !== 'revision') return [];
    const m = new Map<ReasonCode, { message: string; n: number }>();
    for (const l of byTab) for (const r of l.reasons) {
      const e = m.get(r.code) ?? { message: r.message, n: 0 };
      e.n++;
      m.set(r.code, e);
    }
    return [...m.entries()].sort((a, b) => b[1].n - a[1].n);
  }, [byTab, tab]);

  const bySearchAndReason = useMemo(() => {
    let out = byTab;
    if (reasonFilter !== 'todos') out = out.filter((l) => l.reasons.some((r) => r.code === reasonFilter));
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      out = out.filter((l) =>
        l.rowRef.toUpperCase().includes(q) ||
        l.id.toUpperCase().includes(q) ||
        ATTRIBUTE_KEYS.some((k) => (l.attributes[k].normalized ?? '').toUpperCase().includes(q)),
      );
    }
    return out;
  }, [byTab, reasonFilter, search]);

  const groups: RowGroup[] = useMemo(
    () => (groupMode === 'fila' ? groupByRow(bySearchAndReason, rowsSourceText) : groupByFamily(bySearchAndReason)),
    [bySearchAndReason, groupMode, rowsSourceText],
  );

  const totalPages = Math.max(1, Math.ceil(groups.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages - 1);
  const pageGroups = groups.slice(pageClamped * PAGE_SIZE, pageClamped * PAGE_SIZE + PAGE_SIZE);

  /**
   * Los dos sentidos de la misma acción en bloque, y por qué la de vuelta también existe.
   *
   * Hacia adelante ("en revisión" → validar) es lo que pide SPEC-008: con 4.000 filas, resolver de
   * una en una no es un producto. Hacia atrás ("resueltas" → devolver a revisión) es la salida para
   * cuando el sistema se equivoca en la dirección cara: dar por buena una línea que no lo está. Sin
   * ella, quien lo detecta no tiene más remedio que exportar el CSV y arreglarlo en Excel, que es lo
   * que este producto viene a quitar. Se selecciona igual, en el mismo sitio y con el mismo gesto.
   *
   * "Otra familia" no lleva selector: no es una cola de trabajo (P-9), es una fila de otro comprador.
   */
  const selectMode: 'validar' | 'devolver' | null =
    tab === 'revision' ? 'validar' : tab === 'resuelta' ? 'devolver' : null;
  const showCheckboxes = selectMode !== null;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // En "en revisión" no se ofrece validar lo ya validado; en "resueltas" toda línea de la pestaña se
  // puede devolver, la haya dado por buena el pipeline o una persona.
  const isSelectable = (l: OutputLine) => (selectMode === 'validar' ? !confirmed.has(l.id) : true);
  const selectableIds = showCheckboxes ? bySearchAndReason.filter(isSelectable).map((l) => l.id) : [];
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const exportCsv = (which: 'resueltas' | 'revision' | 'fuera-familia') => {
    const source =
      which === 'resueltas' ? lines.filter((l) => effectiveQueue(l, confirmed, reopened) === 'resuelta')
      : which === 'fuera-familia' ? lines.filter((l) => queueOf(l) === 'fuera-familia')
      : lines.filter((l) => effectiveQueue(l, confirmed, reopened) === 'revision');
    downloadCsv(`mto_${which}.csv`, linesToCsv(source));
    if (which === 'resueltas' && processedMtoId && source.length > 0) {
      void fetch('/api/revisions/rfq-export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ revisionId: processedMtoId, lineIds: source.map((l) => l.id) }),
      }).catch(() => { /* el CSV ya bajó; el registro es best-effort */ });
    }
  };

  return (
    <div className="wf-section">
      <div className="toolbar">
        <div className="tabs">
          <button className={`tab${tab === 'todas' ? ' active' : ''}`} onClick={() => { setTab('todas'); setPage(0); setSelected(new Set()); }}>
            Todas <span className="count">{counts.todas}</span>
          </button>
          <button className={`tab${tab === 'resuelta' ? ' active' : ''}`} onClick={() => { setTab('resuelta'); setPage(0); setSelected(new Set()); }}>
            Resueltas <span className="count">{counts.resuelta}</span>
          </button>
          <button className={`tab${tab === 'revision' ? ' active' : ''}`} onClick={() => { setTab('revision'); setPage(0); setSelected(new Set()); }}>
            En revisión <span className="count">{counts.revision}</span>
          </button>
          {/* P-9: ni resuelta ni "en revisión". Es de quien compra las otras familias. */}
          {counts['fuera-familia'] > 0 && (
            <button className={`tab${tab === 'fuera-familia' ? ' active' : ''}`} onClick={() => { setTab('fuera-familia'); setPage(0); setSelected(new Set()); }}>
              No es tornillería <span className="count">{counts['fuera-familia']}</span>
            </button>
          )}
        </div>
        <div className="spacer" />
        <div className="pillgroup" role="group" aria-label="Agrupar por">
          <button className={`pill${groupMode === 'fila' ? ' on' : ''}`} onClick={() => setGroupMode('fila')}>Fila origen</button>
          <button className={`pill${groupMode === 'familia' ? ' on' : ''}`} onClick={() => setGroupMode('familia')}>Familia</button>
        </div>
        <input
          className="search-input"
          placeholder="Buscar por fila, medida, norma…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
        />
      </div>

      {reasonOptions.length > 0 && (
        <div className="reasonbar" role="group" aria-label="Filtrar por motivo">
          <button className={`pill${reasonFilter === 'todos' ? ' on' : ''}`} onClick={() => setReasonFilter('todos')}>Todos los motivos</button>
          {reasonOptions.map(([code, { message, n }]) => (
            <button
              key={code}
              className={`reasonpill${reasonFilter === code ? ' on' : ''}`}
              onClick={() => setReasonFilter(code)}
              title={message}
            >
              {message}<b>{n}</b>
            </button>
          ))}
        </div>
      )}

      {tab === 'fuera-familia' && (
        <p className="queue-note">
          Estas filas <strong>no son tornillería</strong>: una brida, una junta, un tubo. No les falta
          ningún dato —el MTO está bien— simplemente no son de esta familia, así que no se les inventan
          los siete atributos ni se devuelven a ingeniería. Salen aparte para quien compre su familia, y
          no cuentan en los porcentajes de arriba.
        </p>
      )}

      {showCheckboxes && selected.size > 0 && (
        <div className="bulkbar">
          <span className="bulkbar-count"><b>{selected.size}</b> líneas seleccionadas</span>
          {selectMode === 'validar' ? (
            <button
              className="wf-btn primary small"
              onClick={() => { onValidate([...selected]); setSelected(new Set()); }}
            >
              Validar seleccionadas
            </button>
          ) : (
            <button
              className="wf-btn primary small"
              title="Salen del export RFQ y del % resueltas hasta que se validen de nuevo. No se pierde nada."
              onClick={() => { onReopen([...selected]); setSelected(new Set()); }}
            >
              Devolver a revisión
            </button>
          )}
          <button className="wf-btn small" onClick={() => setSelected(new Set())}>Deseleccionar</button>
        </div>
      )}

      <div className="linetable-wrap">
        <div className="linetable-head">
          <span>{showCheckboxes && (
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => setSelected(allSelected ? new Set() : new Set(selectableIds))}
            />
          )}</span>
          <span>Línea</span>
          <span>Nombre</span>
          <span>Material</span>
          <span>Calidad</span>
          <span>Medida</span>
          <span>Longitud</span>
          <span>Norma</span>
          <span>Acabado</span>
          <span>Cantidad</span>
          <span>Estado / motivo</span>
        </div>

        {pageGroups.length === 0 && <div className="empty-state">No hay líneas que coincidan con el filtro.</div>}

        {pageGroups.map((g) => (
          <div key={g.key}>
            <div className="grouphead">
              <span className="grouphead-tag">{groupMode === 'fila' ? `FILA ${g.rowRef}` : g.rowRef}</span>
              <span className="grouphead-text" title={groupMode === 'fila' ? (g.sourceText ?? '') : undefined}>
                {groupMode === 'fila' ? (g.sourceText ?? '') : ''}
              </span>
              <span className="grouphead-meta">{g.lines.length} línea{g.lines.length === 1 ? '' : 's'}</span>
            </div>
            {g.lines.map((l) => (
              <div key={l.id} className="line-block">
                <div
                  className={`linerow${selected.has(l.id) ? ' selected' : ''}`}
                  onClick={() => onOpenTrace(l.id)}
                >
                  <span className="cell-check" onClick={(e) => e.stopPropagation()}>
                    {showCheckboxes && isSelectable(l) && (
                      <input type="checkbox" checked={selected.has(l.id)} onChange={() => toggleSelect(l.id)} />
                    )}
                  </span>
                  <span className="cell-id mono">{l.id}</span>
                  {attrCell(l, 'name')}
                  {attrCell(l, 'material')}
                  {attrCell(l, 'quality')}
                  {attrCell(l, 'measure')}
                  {attrCell(l, 'length')}
                  {attrCell(l, 'standard')}
                  {attrCell(l, 'finish')}
                  <span className="qty-cell">
                    {l.quantity ?? '—'}
                    {l.quantity !== null && (l.quantityProvenance === 'inferred' || l.quantityProvenance === 'extrapolated') && (
                      <span className="attr-mark" title={`cantidad ${l.quantityProvenance}`}>●</span>
                    )}
                  </span>
                  <span className="cell-reason">
                    <StatusBadge line={l} confirmed={confirmed.has(l.id)} reopened={reopened.has(l.id)} />
                    {/* Una línea devuelta puede no tener ningún motivo del pipeline —la dio por
                        buena y alguien la paró—, así que la insignia se quedaría sola. El motivo
                        real es que lo decidió una persona, y eso se escribe. */}
                    {reopened.has(l.id) && (
                      <span className="reason-text">Devuelta a revisión a mano · fuera del RFQ hasta validarla</span>
                    )}
                    {l.reasons[0] && (
                      <span className="reason-text" title={l.reasons.map((r) => r.message).join(' · ')}>
                        {l.reasons[0].message}
                      </span>
                    )}
                    {l.reasons.length > 1 && (
                      <span className="reason-more">+{l.reasons.length - 1} motivo(s) más</span>
                    )}
                    {decisionHint(l, backlog) && (
                      <span className="reason-hint">{decisionHint(l, backlog)}</span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="pagination">
          <button className="wf-btn small" disabled={pageClamped === 0} onClick={() => setPage(pageClamped - 1)}>← Anterior</button>
          <span className="pagination-info">página {pageClamped + 1} de {totalPages} · {groups.length} grupos</span>
          <button className="wf-btn small" disabled={pageClamped >= totalPages - 1} onClick={() => setPage(pageClamped + 1)}>Siguiente →</button>
        </div>
      )}

      <div className="toolbar">
        <span className="spacer" />
        {counts['fuera-familia'] > 0 && (
          <button className="wf-btn" onClick={() => exportCsv('fuera-familia')}>Exportar otras familias (CSV)</button>
        )}
        <button className="wf-btn" onClick={() => exportCsv('revision')}>Exportar en revisión (CSV)</button>
        <button className="wf-btn primary" onClick={() => exportCsv('resueltas')}>Exportar RFQ · resueltas (CSV)</button>
      </div>
    </div>
  );
}
