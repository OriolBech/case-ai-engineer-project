'use client';

import { useMemo, useState } from 'react';
import { ATTRIBUTE_KEYS, type OutputLine, type ReasonCode } from '../../src/pipeline/types.ts';
import {
  downloadCsv, groupByFamily, groupByRow, isMarked, linesToCsv, queueOf, type RowGroup,
} from '../lib/derive.ts';
import { StatusBadge } from './StatusBadge.tsx';

type Tab = 'todas' | 'resuelta' | 'ingenieria' | 'comprador';
type GroupMode = 'fila' | 'familia';

const PAGE_SIZE = 20;

function attrCell(line: OutputLine, key: (typeof ATTRIBUTE_KEYS)[number]) {
  const a = line.attributes[key];
  return (
    <span className="attr-cell">
      <span className={`attr-value${a.normalized === null ? ' empty' : ''}`}>{a.normalized ?? '—'}</span>
      {a.normalized !== null && isMarked(a.provenance) && (
        <span className="attr-mark" title={`${a.provenance}: ${a.rule ?? ''}`}>●</span>
      )}
    </span>
  );
}

export function QueueScreen({
  lines,
  rowsSourceText,
  confirmed,
  onConfirm,
  onOpenTrace,
}: {
  lines: OutputLine[];
  rowsSourceText: Map<string, string>;
  confirmed: Set<string>;
  onConfirm: (ids: string[]) => void;
  onOpenTrace: (lineId: string) => void;
}) {
  const [tab, setTab] = useState<Tab>('todas');
  const [groupMode, setGroupMode] = useState<GroupMode>('fila');
  const [search, setSearch] = useState('');
  const [reasonFilter, setReasonFilter] = useState<ReasonCode | 'todos'>('todos');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);

  const counts = useMemo(() => {
    const c = { todas: lines.length, resuelta: 0, ingenieria: 0, comprador: 0 };
    for (const l of lines) c[queueOf(l)]++;
    return c;
  }, [lines]);

  const byTab = useMemo(() => {
    if (tab === 'todas') return lines;
    return lines.filter((l) => queueOf(l) === tab);
  }, [lines, tab]);

  const reasonOptions = useMemo(() => {
    if (tab !== 'comprador' && tab !== 'ingenieria') return [];
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

  const showCheckboxes = tab === 'comprador';

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectableIds = bySearchAndReason.filter((l) => !confirmed.has(l.id)).map((l) => l.id);
  const allSelected = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));

  const exportCsv = (which: 'resueltas' | 'ingenieria' | 'comprador') => {
    const source =
      which === 'resueltas' ? lines.filter((l) => queueOf(l) === 'resuelta' || confirmed.has(l.id))
      : which === 'ingenieria' ? lines.filter((l) => queueOf(l) === 'ingenieria')
      : lines.filter((l) => queueOf(l) === 'comprador' && !confirmed.has(l.id));
    downloadCsv(`mto_${which}.csv`, linesToCsv(source));
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
          <button className={`tab${tab === 'ingenieria' ? ' active' : ''}`} onClick={() => { setTab('ingenieria'); setPage(0); setSelected(new Set()); }}>
            Vuelve a ingeniería <span className="count">{counts.ingenieria}</span>
          </button>
          <button className={`tab${tab === 'comprador' ? ' active' : ''}`} onClick={() => { setTab('comprador'); setPage(0); setSelected(new Set()); }}>
            Revisión del comprador <span className="count">{counts.comprador}</span>
          </button>
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

      {showCheckboxes && selected.size > 0 && (
        <div className="bulkbar">
          <span className="bulkbar-count"><b>{selected.size}</b> líneas seleccionadas</span>
          <button
            className="wf-btn primary small"
            onClick={() => { onConfirm([...selected]); setSelected(new Set()); }}
          >
            Confirmar por el comprador
          </button>
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
              <div
                key={l.id}
                className={`linerow${selected.has(l.id) ? ' selected' : ''}`}
                onClick={() => onOpenTrace(l.id)}
              >
                <span className="cell-check" onClick={(e) => e.stopPropagation()}>
                  {showCheckboxes && !confirmed.has(l.id) && (
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
                  <StatusBadge line={l} confirmed={confirmed.has(l.id)} />
                  {l.reasons[0] && <span className="reason-text" title={l.reasons.map((r) => r.message).join(' · ')}>{l.reasons[0].message}</span>}
                  {l.reasons.length > 1 && <span className="reason-more">+{l.reasons.length - 1} motivo(s) más</span>}
                </span>
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
        <button className="wf-btn" onClick={() => exportCsv('ingenieria')}>Exportar a ingeniería (CSV)</button>
        <button className="wf-btn" onClick={() => exportCsv('comprador')}>Exportar revisión pendiente (CSV)</button>
        <button className="wf-btn primary" onClick={() => exportCsv('resueltas')}>Exportar RFQ · resueltas (CSV)</button>
      </div>
    </div>
  );
}
