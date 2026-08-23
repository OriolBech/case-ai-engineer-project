/**
 * Rules audit — `pnpm run rules:audit`.
 *
 * Two jobs:
 *
 * 1. **Auditability.** Lists every alias we ADDED beyond the client's tables. The client's
 *    document is the source of truth; our additions are decisions and have to be defensible one
 *    by one in the session.
 *
 * 2. **The deterministic baseline.** Reports what the tables alone resolve, with no model
 *    involved, over the given MTO and the directed synthetic set. This is the number that answers
 *    the evaluation criterion "do you know when you don't need an agent": the LLM only has to
 *    justify the delta over this.
 */

import { readFileSync } from 'node:fs';
import { NAME_ALIASES } from './names.ts';
import { aliasProvenance as finishAliasProvenance } from './finish-db.ts';
import { MATERIAL_ALIASES } from './material.ts';
import { findNames } from './names.ts';
import { findFinishes } from './finish.ts';
import { findStandards } from './standards.ts';
import { normalizeQuality } from './quality.ts';
import { MTO_ROWS } from './__tests__/fixtures.ts';
import type { Alias } from './text.ts';

// --- 1. Alias provenance -----------------------------------------------------

function auditAliases(label: string, table: ReadonlyMap<string, readonly Alias[]>): void {
  const client: string[] = [];
  const added: string[] = [];
  for (const [value, aliases] of table) {
    for (const al of aliases) (al.source === 'client' ? client : added).push(`${al.text} -> ${value}`);
  }
  console.log(`\n${label}: ${client.length} del cliente, ${added.length} añadidos por nosotros`);
  for (const a of added) console.log(`  + ${a}`);
}

console.log('='.repeat(78));
console.log('PROCEDENCIA DE ALIAS  (todo lo marcado + es una decisión nuestra, no del cliente)');
console.log('='.repeat(78));
auditAliases('Nombres', NAME_ALIASES);
{
  const { client, added } = finishAliasProvenance();
  console.log(`\nAcabados: ${client.length} del cliente, ${added.length} añadidos por nosotros`);
  for (const a of added) console.log(`  + ${a}`);
}
auditAliases('Materiales', MATERIAL_ALIASES);

// --- 2. Deterministic baseline ----------------------------------------------

/** Minimal RFC4180-ish reader. The synthetic descriptions contain commas and quotes. */
function readCsv(path: string): string[][] {
  const text = readFileSync(path, 'utf8');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c !== ''));
}

interface Row { id: string; desc: string; materialCol: string }

function baseline(label: string, rows: Row[]): void {
  let names = 0, standards = 0, finishes = 0, qualities = 0;
  const noName: string[] = [];
  const noStandard: string[] = [];

  for (const r of rows) {
    const text = `${r.desc} ${r.materialCol}`;
    const n = findNames(text);
    const s = findStandards(text);
    const f = findFinishes(text);
    // Quality: the tables only normalize a value already flagged as a quality (§5). Here we can
    // only check the MATERIAL column, which is where this MTO happens to put it.
    const q = r.materialCol
      .split('/')
      .map((v) => normalizeQuality(v.trim()))
      .filter((x) => x.group !== null || /GR|HV|^[0-9]/.test(x.raw));

    if (n.length) names++; else noName.push(r.id);
    if (s.length) standards++; else noStandard.push(r.id);
    if (f.length) finishes++;
    if (q.length) qualities++;
  }

  const pct = (x: number) => `${((100 * x) / rows.length).toFixed(0)}%`.padStart(4);
  console.log(`\n${label} — ${rows.length} filas, SOLO tablas deterministas, 0 llamadas a modelo`);
  console.log(`  filas con al menos un NOMBRE detectado   ${String(names).padStart(3)}  ${pct(names)}`);
  console.log(`  filas con al menos una NORMA detectada   ${String(standards).padStart(3)}  ${pct(standards)}`);
  console.log(`  filas con ACABADO detectado              ${String(finishes).padStart(3)}  ${pct(finishes)}`);
  console.log(`  filas con CALIDAD reconocible en col.    ${String(qualities).padStart(3)}  ${pct(qualities)}`);
  if (noName.length) console.log(`  sin nombre: ${noName.join(', ')}`);
  if (noStandard.length) console.log(`  sin norma:  ${noStandard.join(', ')}`);
}

console.log('\n' + '='.repeat(78));
console.log('BASELINE DETERMINISTA  (el delta sobre esto es lo que tiene que justificar el LLM)');
console.log('='.repeat(78));

baseline(
  'MTO dado',
  MTO_ROWS.map((r) => ({ id: `#${r.item}`, desc: r.desc, materialCol: r.materialCol })),
);

const csv = readCsv('data/synthetic/expectativas.csv');
const [head, ...body] = csv;
const iId = head.indexOf('id');
const iDesc = head.indexOf('descripcion');
const iMat = head.indexOf('col_material');
baseline(
  'Set sintético dirigido',
  body.map((r) => ({ id: r[iId], desc: r[iDesc], materialCol: r[iMat] })),
);

console.log(
  '\nLo que este baseline NO hace: separar sets en líneas, asignar cada atributo al elemento\n' +
  'correcto, ni decidir si un valor está marcado como calidad. Eso es lo que compran los agentes.\n',
);
