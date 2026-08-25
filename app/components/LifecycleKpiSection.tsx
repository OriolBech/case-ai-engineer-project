'use client';

import { useEffect, useState } from 'react';
import type {
  DurationDistribution,
  LifecycleEventType,
  ProcurementLifecycleKpi,
} from '../../src/kpi/metrics.ts';

const EVENT_LABELS: Record<LifecycleEventType, string> = {
  revision_opened: 'Revisión abierta',
  review_closed: 'Revisión terminada',
  rfq_sent: 'RFQ enviada',
  order_placed: 'Pedido emitido',
  supplier_confirmed: 'Proveedor confirma',
  delivered: 'Entrega recibida',
};

interface RecentMto {
  id: string;
  fileName: string;
  createdAt: string;
}

function projectIdFromFileName(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

function duration(value: number): string {
  if (value < 48) return `${value.toLocaleString('es-ES', { maximumFractionDigits: 1 })} h`;
  return `${(value / 24).toLocaleString('es-ES', { maximumFractionDigits: 1 })} días`;
}

function DurationCard({ label, stats }: { label: string; stats: DurationDistribution }) {
  return (
    <div className="kpi-cell">
      <div>
        <span className={`kpi-source ${stats.sampleCount > 0 ? 'measured' : 'unavailable'}`}>
          {stats.sampleCount > 0 ? 'Medido' : 'No disponible'}
        </span>
      </div>
      <span className="kpi-num">{stats.p50Hours === null ? '—' : duration(stats.p50Hours)}</span>
      <span className="kpi-cap">{label} · p50</span>
      <span className="kpi-help">
        {stats.p90Hours === null
          ? 'Falta al menos un flujo con ambos hitos.'
          : `p90 ${duration(stats.p90Hours)} · muestra ${stats.sampleCount}.`}
      </span>
    </div>
  );
}

export function LifecycleKpiSection({
  lifecycle,
  onSaved,
}: {
  lifecycle: ProcurementLifecycleKpi;
  onSaved: () => Promise<void>;
}) {
  const [recentMtos, setRecentMtos] = useState<RecentMto[]>([]);
  const [projectId, setProjectId] = useState('');
  const [revisionId, setRevisionId] = useState('');
  const [flowId, setFlowId] = useState('revision');
  const [eventType, setEventType] = useState<LifecycleEventType>('review_closed');
  const [supplier, setSupplier] = useState('');
  const [note, setNote] = useState('');
  const [at, setAt] = useState('');
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [message, setMessage] = useState('');

  useEffect(() => {
    void fetch('/api/mto-history?limit=20')
      .then(async (response) => {
        const body = await response.json();
        if (response.ok) setRecentMtos(body.items ?? []);
      })
      .catch(() => {
        // El formulario manual sigue disponible aunque el histórico no cargue.
      });
  }, []);

  const chooseRevision = (id: string) => {
    setRevisionId(id);
    const selected = recentMtos.find((item) => item.id === id);
    if (selected) setProjectId(projectIdFromFileName(selected.fileName));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState('saving');
    setMessage('');
    try {
      const response = await fetch('/api/kpis/lifecycle', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId,
          revisionId,
          flowId,
          eventType,
          supplier,
          note,
          at: at ? new Date(at).toISOString() : undefined,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? `HTTP ${response.status}`);
      setState('saved');
      setMessage(body.created ? 'Hito guardado.' : 'Ese hito ya estaba registrado; no se duplicó.');
      await onSaved();
    } catch (cause) {
      setState('error');
      setMessage(cause instanceof Error ? cause.message : String(cause));
    }
  };

  return (
    <section className="kpi-section">
      <h3>Revisión y ciclo de compra</h3>
      <p className="kpi-note">
        <span className="kpi-source measured">Medido</span> Los plazos salen de hitos persistidos por
        proyecto, revisión y flujo. Procesar un MTO abre la revisión; exportar una RFQ cierra la
        revisión y registra el envío. Pedido, confirmación del proveedor y entrega se registran aquí.
      </p>

      <div className="kpi-grid">
        <DurationCard label="tiempo de revisión" stats={lifecycle.reviewTime} />
        <DurationCard label="RFQ a pedido" stats={lifecycle.rfqToOrder} />
        <DurationCard label="pedido a confirmación" stats={lifecycle.orderToSupplierConfirmation} />
        <DurationCard label="pedido a entrega" stats={lifecycle.orderToDelivery} />
        <DurationCard label="RFQ a entrega" stats={lifecycle.rfqToDelivery} />
      </div>

      <div className="kpi-funnel">
        {(Object.entries(EVENT_LABELS) as Array<[LifecycleEventType, string]>).map(([type, label]) => (
          <div key={type}>
            <strong>{lifecycle.eventCounts[type]}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>

      <form className="lifecycle-form" onSubmit={submit}>
        <div className="lifecycle-form-head">
          <strong>Registrar siguiente hito</strong>
          <span className="kpi-help">Append-only e idempotente por flujo: repetirlo no crea otra muestra.</span>
        </div>

        {recentMtos.length > 0 && (
          <label>
            Revisión reciente
            <select value={revisionId} onChange={(event) => chooseRevision(event.target.value)}>
              <option value="">Elegir…</option>
              {recentMtos.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.fileName} · {new Date(item.createdAt).toLocaleDateString('es-ES')}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          Proyecto
          <input value={projectId} onChange={(event) => setProjectId(event.target.value)} required />
        </label>
        <label>
          Revisión
          <input value={revisionId} onChange={(event) => setRevisionId(event.target.value)} required />
        </label>
        <label>
          Flujo / lote
          <input value={flowId} onChange={(event) => setFlowId(event.target.value)} required />
        </label>
        <label>
          Hito
          <select value={eventType} onChange={(event) => setEventType(event.target.value as LifecycleEventType)}>
            {Object.entries(EVENT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label>
          Proveedor
          <input value={supplier} onChange={(event) => setSupplier(event.target.value)} placeholder="opcional" />
        </label>
        <label>
          Fecha
          <input type="datetime-local" value={at} onChange={(event) => setAt(event.target.value)} />
        </label>
        <label className="lifecycle-note">
          Nota
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="pedido, albarán…" />
        </label>
        <button className="wf-btn primary" type="submit" disabled={state === 'saving'}>
          {state === 'saving' ? 'Guardando…' : 'Guardar hito'}
        </button>
        {message && <span className={`lifecycle-message ${state}`}>{message}</span>}
      </form>

      <div className="kpi-split">
        <span className="kpi-cap">Últimos hitos</span>
        {lifecycle.recentEvents.length === 0 ? (
          <p className="kpi-help">Todavía no hay hitos de revisión o compra.</p>
        ) : (
          <div className="lifecycle-events">
            {lifecycle.recentEvents.map((event) => (
              <div key={event.id}>
                <strong>{EVENT_LABELS[event.eventType]}</strong>
                <span>{event.projectId} · {event.revisionId} · {event.flowId}</span>
                <span>{event.supplier ?? 'sin proveedor'} · {new Date(event.occurredAt).toLocaleString('es-ES')}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
