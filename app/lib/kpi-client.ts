export type CorrectionKpiEventType = 'started' | 'saved';

/** Telemetría KPI best-effort: nunca bloquea la corrección ni escribe en su store. */
export function recordCorrectionKpiEvent(
  sessionId: string,
  lineId: string,
  eventType: CorrectionKpiEventType,
): void {
  void fetch('/api/kpis', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, lineId, eventType }),
  }).catch(() => {
    // La decisión del comprador manda; una caída de telemetría no puede impedir guardarla.
  });
}
