/**
 * Runs the trap bank through the deterministic pipeline (baseline → normalize → validate).
 * Zero LLM calls. This is the number that answers "do the tables still hold off the gold set?"
 */

import { analyzeRowBaseline } from '../pipeline/baseline.ts';
import { normalizeElement } from '../pipeline/normalize.ts';
import { validateRow } from '../pipeline/validate.ts';
import { scoreLine, thresholds, route } from '../lib/confidence.ts';
import { DEFAULT_POLICIES } from '../rules/policies.ts';
import { TRAPS, type Trap, type TrapExpect, type TrapGate } from './trap-cases.ts';
import type { MtoRow, OutputLine, ReasonCode } from '../pipeline/types.ts';

export interface TrapFailure {
  id: string;
  gate: TrapGate;
  clause: string;
  expected: string;
  got: string;
}

export interface TrapResult {
  id: string;
  gate: TrapGate;
  family: string;
  ok: boolean;
  failures: TrapFailure[];
  lines: OutputLine[];
}

export interface TrapBankReport {
  results: TrapResult[];
  must: { ok: number; total: number; failed: TrapResult[] };
  holes: { open: TrapResult[]; closed: TrapResult[]; total: number };
}

function makeRow(cells: Trap['cells'], itemRef: string): MtoRow {
  const ordered: [string, string][] = [
    ['DESCRIPCION', cells.DESCRIPCION],
    ['MATERIAL', cells.MATERIAL ?? ''],
    ['MEDIDA', cells.MEDIDA ?? ''],
    ['CANTIDAD', cells.CANTIDAD ?? ''],
  ];
  const parts = ordered.map(([, text]) => text);
  const sourceText = parts.join(' | ');
  const cellOffsets: MtoRow['cellOffsets'] = {};
  let cursor = 0;
  for (const [header, text] of ordered) {
    cellOffsets[header] = { start: cursor, end: cursor + text.length };
    cursor += text.length + 3;
  }
  return {
    itemRef,
    sourceText,
    cellOffsets,
    quantity: cells.CANTIDAD ? Number(cells.CANTIDAD) || null : null,
    quantityColumn: 'CANTIDAD',
    unit: 'uds',
    sheet: 'TRAPS',
    rowNumber: 2,
  };
}

/** Same glue as processMto's deterministic path, with default policies so .env cannot flake CI. */
export function runTrapRow(trap: Trap): OutputLine[] {
  const row = makeRow(trap.cells, trap.id);
  const analysis = analyzeRowBaseline(row);
  const lines = validateRow(analysis, analysis.elements.map(normalizeElement), row, {
    policies: DEFAULT_POLICIES,
  });
  const t = thresholds({} as NodeJS.ProcessEnv);
  for (const line of lines) {
    line.confidence = scoreLine(line.attributes);
    if (route(line, t) === 'review' && line.status === 'RESUELTA') {
      line.status = 'REVISION_MANUAL';
      line.reasons.push({
        code: 'LOW_CONFIDENCE',
        kind: 'LOW_CONFIDENCE',
        message: 'Varios datos son inferidos: conviene revisarlo',
        attribute: null,
      });
    }
  }
  return lines;
}

function qualityGroupOf(line: OutputLine): string | null {
  const rule = line.attributes.quality.rule;
  const m = rule?.match(/^quality:(G\d+)$/);
  return m ? m[1] : null;
}

function reasonsOf(line: OutputLine): ReasonCode[] {
  return line.reasons.map((r) => r.code);
}

function check(trap: Trap, lines: OutputLine[]): TrapFailure[] {
  const exp = trap.expect;
  const principal = lines[0];
  const out: TrapFailure[] = [];
  const fail = (clause: string, expected: string, got: string) => {
    out.push({ id: trap.id, gate: trap.gate, clause, expected, got });
  };

  if (exp.split !== undefined && lines.length !== exp.split) {
    fail('split', String(exp.split), String(lines.length));
  }
  if (!principal) {
    if (exp.name || exp.quality || exp.finish !== undefined || exp.standard || exp.status || exp.qualityGroup) {
      fail('principal', 'at least one line', '0 lines');
    }
  } else {
    checkPrincipal(exp, principal, fail);
  }
  if (exp.reasonsInclude && principal) {
    const got = reasonsOf(principal);
    for (const code of exp.reasonsInclude) {
      if (!got.includes(code)) fail(`reasonsInclude.${code}`, code, got.join(',') || '(none)');
    }
  }
  if (exp.noneResolved) {
    const resolved = lines.filter((l) => l.status === 'RESUELTA');
    if (resolved.length) {
      fail('noneResolved', '0 RESUELTA', resolved.map((l) => `${l.attributes.name.normalized ?? '?'}:${l.status}`).join(','));
    }
  }
  if (exp.noResolvedQuality) {
    const hit = lines.filter(
      (l) => l.status === 'RESUELTA' && same(l.attributes.quality.normalized, exp.noResolvedQuality),
    );
    if (hit.length) {
      fail('noResolvedQuality', `no RESUELTA with quality ${exp.noResolvedQuality}`, hit.map((l) => l.attributes.name.normalized ?? '?').join(','));
    }
  }
  return out;
}

function checkPrincipal(
  exp: TrapExpect,
  line: OutputLine,
  fail: (clause: string, expected: string, got: string) => void,
): void {
  if (exp.name && line.attributes.name.normalized !== exp.name) {
    fail('name', exp.name, line.attributes.name.normalized ?? 'null');
  }
  if (exp.quality && !same(line.attributes.quality.normalized, exp.quality)) {
    fail('quality', exp.quality, line.attributes.quality.normalized ?? 'null');
  }
  if (exp.qualityGroup) {
    const got = qualityGroupOf(line);
    if (got !== exp.qualityGroup) fail('qualityGroup', exp.qualityGroup, got ?? 'null');
  }
  if (exp.finish !== undefined && !same(line.attributes.finish.normalized, exp.finish)) {
    fail('finish', exp.finish ?? 'null', line.attributes.finish.normalized ?? 'null');
  }
  if (exp.standard && !same(line.attributes.standard.normalized, exp.standard)) {
    fail('standard', exp.standard, line.attributes.standard.normalized ?? 'null');
  }
  if (exp.status && line.status !== exp.status) {
    fail('status', exp.status, line.status);
  }
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  const n = (v: string | null | undefined) => {
    if (v == null || v === '') return null;
    return v.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  };
  return n(a) === n(b);
}

export function runTrap(trap: Trap): TrapResult {
  const lines = runTrapRow(trap);
  const failures = check(trap, lines);
  return { id: trap.id, gate: trap.gate, family: trap.family, ok: failures.length === 0, failures, lines };
}

export function runTrapBank(traps: readonly Trap[] = TRAPS): TrapBankReport {
  const results = traps.map(runTrap);
  const must = results.filter((r) => r.gate === 'must');
  const holes = results.filter((r) => r.gate === 'hole');
  return {
    results,
    must: { ok: must.filter((r) => r.ok).length, total: must.length, failed: must.filter((r) => !r.ok) },
    holes: { open: holes.filter((r) => !r.ok), closed: holes.filter((r) => r.ok), total: holes.length },
  };
}

export function formatTrapBank(report: TrapBankReport): string {
  const lines: string[] = [];
  lines.push('=== banco de trampas (baseline, 0 LLM) ===');
  lines.push(`  must    ${report.must.ok}/${report.must.total}  (fallan en pnpm test)`);
  lines.push(`  holes   ${report.holes.closed.length} cerrados / ${report.holes.open.length} abiertos de ${report.holes.total}`);
  if (report.must.failed.length) {
    lines.push('\n  MUST CAÍDAS:');
    for (const r of report.must.failed) {
      for (const f of r.failures) {
        lines.push(`    ${r.id}  ${f.clause}: esperado ${JSON.stringify(f.expected)} · obtenido ${JSON.stringify(f.got)}`);
      }
    }
  }
  if (report.holes.open.length) {
    lines.push('\n  AGUJEROS DEL BASELINE (no fallan CI; el LLM tiene que comprar este delta):');
    for (const r of report.holes.open) {
      for (const f of r.failures) {
        lines.push(`    ${r.id}  ${f.clause}: esperado ${JSON.stringify(f.expected)} · obtenido ${JSON.stringify(f.got)}`);
      }
    }
  }
  if (report.holes.closed.length) {
    lines.push('\n  agujeros que el baseline ya cierra:');
    for (const r of report.holes.closed) lines.push(`    ${r.id}  ${r.family}`);
  }
  return lines.join('\n');
}
