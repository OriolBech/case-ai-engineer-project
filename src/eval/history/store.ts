/**
 * Persistencia de ejecuciones. Ver SPEC-010 §Modelo persistido y §Comportamiento.
 *
 * `saveRun` es la única escritura de esta primera implementación que toca `evaluation_runs`,
 * `evaluation_metrics` y `evaluation_lines`, y lo hace en UNA transacción: o se guarda la ejecución
 * completa (cabecera, métricas y líneas) o no se guarda nada. Igual que la siembra del vocabulario
 * en `vocabulary-db.ts`, una escritura a medias es peor que no escribir: un run parcial visible
 * contaminaría `eval:history` y `eval:compare` sin que nada lo distinguiera de uno completo.
 */
import { randomUUID } from 'node:crypto';
import { fromJson, openHistoryDb, toJson } from './db.ts';
import type { EvalReport, LineResult } from '../harness.ts';
import type { PolicyOverride } from '../../rules/policies.ts';

export interface EvaluationRunInput {
  label: string | null;
  dataset: { name: string; fingerprint: string; rows: number; goldLines: number };
  system: {
    gitCommit: string | null;
    dirty: boolean;
    model: string;
    provider: string;
    routing: string;
    criticRouting: string;
    policyFingerprint: string;
    policyOverrides: PolicyOverride[];
    configurationFingerprint: string;
  };
  report: EvalReport;
  /** `eur: null` cuando los precios no están configurados. Nunca 0: un coste desconocido no es gratis. */
  cost: { eur: number | null; pricesConfigured: boolean };
  latencyMs: number;
}

export interface StoredRun {
  id: string;
  createdAt: string;
  label: string | null;
  datasetName: string;
  datasetFingerprint: string;
  gitCommit: string | null;
  gitDirty: boolean;
  model: string;
  provider: string;
  routing: string;
  criticRouting: string;
  policyFingerprint: string;
  policyOverrides: PolicyOverride[];
  configurationFingerprint: string;
  rows: number;
  goldLines: number;
  systemLines: number;
  latencyMs: number;
  costEur: number | null;
  pricesConfigured: boolean;
}

export interface MetricRow {
  scope: string;
  name: string;
  value: number;
  numerator: number | null;
  denominator: number | null;
}

/**
 * Aplana el `EvalReport` del harness (SPEC-009) a filas (scope, name, value, numerador, denominador).
 *
 * Sólo traduce: no recalcula nada que el harness no haya calculado ya, para no duplicar su lógica.
 * Las celdas `policy_dependent` se guardan aparte (`scope='attribute_policy'`) y sólo cuando existen,
 * porque mezclarlas con las ciertas es justo lo que el harness declara indefendible.
 */
function metricsFromReport(r: EvalReport): MetricRow[] {
  const rows: MetricRow[] = [];
  const push = (scope: string, name: string, value: number, numerator: number | null, denominator: number | null) =>
    rows.push({ scope, name, value, numerator, denominator });

  push('global', 'split_fidelity', r.splitFidelity.pct, r.splitFidelity.ok, r.splitFidelity.total);
  push('global', 'silent_error_rate', r.silentErrorRate.pct, r.silentErrorRate.bad, r.silentErrorRate.resolved);
  push('global', 'useful_autonomy', r.usefulAutonomy.pct, r.usefulAutonomy.ok, r.usefulAutonomy.total);
  push('global', 'queue_noise', r.queueNoise.pct, r.queueNoise.noisy, r.queueNoise.review);
  push('global', 'status_agreement', r.statusAgreement.pct, r.statusAgreement.ok, r.statusAgreement.total);
  push('global', 'reason_agreement', r.reasonAgreement.pct, r.reasonAgreement.exact, r.reasonAgreement.total);
  const oosPct = r.outOfScope.goldLines ? (100 * r.outOfScope.detected) / r.outOfScope.goldLines : 100;
  push('global', 'out_of_scope', oosPct, r.outOfScope.detected, r.outOfScope.goldLines);

  for (const [attr, v] of Object.entries(r.perAttribute)) {
    push('attribute', attr, v.pctC, v.okC, v.totalC);
    if (v.totalP > 0) push('attribute_policy', attr, (100 * v.okP) / v.totalP, v.okP, v.totalP);
  }
  return rows;
}

export function saveRun(input: EvaluationRunInput): string {
  const conn = openHistoryDb();
  const id = randomUUID();
  const createdAt = new Date().toISOString();

  conn.exec('BEGIN IMMEDIATE');
  try {
    conn
      .prepare(
        `INSERT INTO evaluation_runs (
          id, created_at, label, dataset_name, dataset_fingerprint, git_commit, git_dirty,
          model, provider, routing, critic_routing, policy_fingerprint, policy_overrides_json,
          configuration_fingerprint, rows, gold_lines, system_lines, latency_ms, cost_eur, prices_configured
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        createdAt,
        input.label,
        input.dataset.name,
        input.dataset.fingerprint,
        input.system.gitCommit,
        input.system.dirty ? 1 : 0,
        input.system.model,
        input.system.provider,
        input.system.routing,
        input.system.criticRouting,
        input.system.policyFingerprint,
        toJson(input.system.policyOverrides),
        input.system.configurationFingerprint,
        input.dataset.rows,
        input.dataset.goldLines,
        input.report.systemLines,
        input.latencyMs,
        input.cost.pricesConfigured ? input.cost.eur : null,
        input.cost.pricesConfigured ? 1 : 0,
      );

    const insertMetric = conn.prepare(
      `INSERT INTO evaluation_metrics (run_id, scope, name, value, numerator, denominator) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (const m of metricsFromReport(input.report)) insertMetric.run(id, m.scope, m.name, m.value, m.numerator, m.denominator);

    const insertLine = conn.prepare(
      `INSERT INTO evaluation_lines (run_id, row_ref, gold_id, system_id, payload_json) VALUES (?, ?, ?, ?, ?)`,
    );
    for (const line of input.report.lines) insertLine.run(id, line.rowRef, line.goldId, line.systemId, toJson(line));

    conn.exec('COMMIT');
  } catch (e) {
    conn.exec('ROLLBACK');
    throw e;
  }
  return id;
}

function toStoredRun(r: Record<string, unknown>): StoredRun {
  return {
    id: r.id as string,
    createdAt: r.created_at as string,
    label: (r.label as string | null) ?? null,
    datasetName: r.dataset_name as string,
    datasetFingerprint: r.dataset_fingerprint as string,
    gitCommit: (r.git_commit as string | null) ?? null,
    gitDirty: !!(r.git_dirty as number),
    model: r.model as string,
    provider: r.provider as string,
    routing: r.routing as string,
    criticRouting: r.critic_routing as string,
    policyFingerprint: r.policy_fingerprint as string,
    policyOverrides: fromJson<PolicyOverride[]>(r.policy_overrides_json as string),
    configurationFingerprint: r.configuration_fingerprint as string,
    rows: r.rows as number,
    goldLines: r.gold_lines as number,
    systemLines: r.system_lines as number,
    latencyMs: r.latency_ms as number,
    costEur: (r.cost_eur as number | null) ?? null,
    pricesConfigured: !!(r.prices_configured as number),
  };
}

export function listRuns(limit = 20): StoredRun[] {
  const conn = openHistoryDb();
  return (conn.prepare(`SELECT * FROM evaluation_runs ORDER BY created_at DESC LIMIT ?`).all(limit) as Record<string, unknown>[]).map(
    toStoredRun,
  );
}

export function getRun(id: string): StoredRun | null {
  const conn = openHistoryDb();
  const r = conn.prepare(`SELECT * FROM evaluation_runs WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
  return r ? toStoredRun(r) : null;
}

export function getRunMetrics(id: string): MetricRow[] {
  const conn = openHistoryDb();
  return (
    conn.prepare(`SELECT scope, name, value, numerator, denominator FROM evaluation_metrics WHERE run_id = ?`).all(id) as Record<
      string,
      unknown
    >[]
  ).map((r) => ({
    scope: r.scope as string,
    name: r.name as string,
    value: r.value as number,
    numerator: (r.numerator as number | null) ?? null,
    denominator: (r.denominator as number | null) ?? null,
  }));
}

export function getRunLines(id: string): LineResult[] {
  const conn = openHistoryDb();
  return (conn.prepare(`SELECT payload_json FROM evaluation_lines WHERE run_id = ?`).all(id) as { payload_json: string }[]).map((r) =>
    fromJson<LineResult>(r.payload_json),
  );
}
