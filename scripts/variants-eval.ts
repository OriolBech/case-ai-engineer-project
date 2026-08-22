/**
 * `node scripts/variants-eval.ts [--only=v03,v07]` — el pipeline COMPLETO sobre cada variante de
 * formato, evaluado contra el mismo gold.
 *
 * POR QUÉ, cuando ya existe `npm run variants`. Ése prueba la **ingesta**, que es determinista y
 * gratis. Pero las 15 filas lógicas son las mismas en las 10 variantes, así que la salida del
 * pipeline entero **también** debería ser la misma: mismas 30 líneas, mismos siete atributos, misma
 * cantidad. Si cambia con la forma del fichero, el sistema depende del estudio de ingeniería que
 * escribió el Excel, que es exactamente lo que el enunciado dice que no puede pasar.
 *
 * La comparación es contra `gold.jsonl` en todas, no de una variante contra otra: así un fallo se
 * lee como "esta variante rompe el atributo X" y no como "estas dos no coinciden".
 *
 * El coste real es menor de lo que parece: la caché va por (proveedor, modelo, petición), y el
 * `sourceText` cambia con el orden de columnas, así que cada variante paga sus 15 llamadas la primera
 * vez y ninguna después.
 */
import { readFileSync } from 'node:fs';
import { installErrorHandler } from '../src/lib/cli.ts';
import { loadEnv } from '../src/lib/env.ts';
import { createLlm, eurPerUsd } from '../src/lib/llm.ts';
import { processMto } from '../src/pipeline/index.ts';
import { loadGold, evaluate } from '../src/eval/harness.ts';
import type { OutputLine } from '../src/pipeline/types.ts';

installErrorHandler();
loadEnv();

const DIR = 'data/variants';
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',');
const manifest = (JSON.parse(readFileSync(`${DIR}/manifest.json`, 'utf8')) as
  { file: string; ataca: string; expectQuantity: boolean }[])
  .filter((m) => !only || only.some((o) => m.file.startsWith(o)));

const gold = loadGold();
const llm = createLlm();
const rows: string[] = [];
const problems: string[] = [];

/**
 * Realinea las líneas por POSICIÓN de la fila en el fichero, no por su `itemRef`.
 *
 * Hace falta porque `itemRef` sale de la columna ITEM, y hay variantes que no la traen: en
 * `v03-qty-apostrofo` el `itemRef` cae al número de fila del Excel (2..16 en vez de 1..15) y la
 * alineación contra el gold se desplaza entera. Sin esto, la variante reportaba **9 errores
 * silenciosos y un split del 50%** que eran de la comparación, no del pipeline.
 *
 * La posición es la clave de unión correcta AQUÍ y sólo aquí: el manifiesto garantiza que las 10
 * variantes tienen las mismas 15 filas lógicas en el mismo orden. Es la única cosa que comparten.
 *
 * Que haga falta es en sí un hallazgo, y está en `docs/07-target-solution.md`: la identidad de una
 * línea depende de una columna **opcional**. Para el diff entre la revisión 9 y la 12 eso no sirve.
 */
function realignByPosition(lines: OutputLine[], rowOrder: string[]): OutputLine[] {
  const canonical = new Map(rowOrder.map((ref, i) => [ref, String(i + 1)]));
  return lines.map((l) => {
    const to = canonical.get(l.rowRef);
    if (!to || to === l.rowRef) return l;
    return { ...l, rowRef: to, id: l.id.replace(/^[^.]+/, to) };
  });
}

for (const m of manifest) {
  const out = await processMto(llm, `${DIR}/${m.file}`, {
    concurrency: Number(process.env.CONCURRENCY ?? 3),
    routing: 'always_main',
    criticRouting: 'off',
  });
  const shifted = out.rows.map((r) => r.itemRef).some((ref, i) => ref !== String(i + 1));
  const lines = realignByPosition(out.lines, out.rows.map((r) => r.itemRef));
  // Una fila caída en el proveedor hunde todas las métricas sin que ninguna diga por qué. Se dice
  // antes de cualquier cifra, y esa variante no cuenta.
  const failed = out.analyses.filter((a) => a.error);
  const r = evaluate(lines, gold, m.file);
  // `v04-sin-cantidad` no trae columna de cantidad A PROPÓSITO, así que sus 21 celdas ciertas de
  // cantidad salen ausentes y el gold las espera con valor. Contarlas como falladas mide el
  // FICHERO, no el pipeline: la conducta correcta ahí es exactamente la que da (ausente, avisado a
  // nivel de fichero). Se excluye la celda, y se dice en la salida que se ha excluido.
  const graded = Object.entries(r.perAttribute)
    .filter(([k]) => m.expectQuantity || k !== 'quantity');
  const certain = graded.reduce((a, [, v]) => ({ ok: a.ok + v.okC, total: a.total + v.totalC }), { ok: 0, total: 0 });
  const pc = (n: number) => `${n.toFixed(0)}%`;
  // El error silencioso también se recalcula sin la celda excluida: una línea "mala" sólo por la
  // cantidad que el fichero no trae no es un error silencioso, es el fichero.
  const badLines = r.lines.filter((l) => l.aligned && l.systemStatus === 'RESUELTA'
    && l.cells.some((c) => !c.ok && c.certainty === 'C' && (m.expectQuantity || c.attribute !== 'quantity')));
  const mark = failed.length ? '!!'
    : r.splitFidelity.pct === 100 && badLines.length === 0 && certain.ok === certain.total ? 'ok' : 'XX';
  rows.push(
    `  ${mark}  ${m.file.padEnd(26)} líneas ${String(r.systemLines).padStart(2)}/30  split ${pc(r.splitFidelity.pct).padStart(4)}` +
    `  err.sil. ${String(badLines.length).padStart(2)}  celdas ciertas ${certain.ok}/${certain.total}` +
    (m.expectQuantity ? '' : ' [sin cantidad: celda excluida]') +
    (failed.length ? `  (${failed.length} FILAS CAÍDAS: medida inválida)` : '') +
    (shifted ? '  [realineada por posición: sin columna ITEM]' : ''),
  );
  if (failed.length) problems.push(`${m.file}: ${failed.length} filas caídas — ${failed.map((a) => `${a.rowRef}:${a.error!.kind}`).join(', ')}`);
  else if (mark === 'XX') {
    const bad = r.lines.filter((l) => l.aligned && (!l.statusOk
      || l.cells.some((c) => !c.ok && c.certainty === 'C' && (m.expectQuantity || c.attribute !== 'quantity'))));
    for (const l of bad) {
      const cells = l.cells.filter((c) => !c.ok && c.certainty === 'C' && (m.expectQuantity || c.attribute !== 'quantity'))
        .map((c) => `${c.attribute} esperado ${JSON.stringify(c.expected)} obtenido ${JSON.stringify(c.got)}`);
      problems.push(`${m.file} · ${l.goldId ?? '?'} fila ${l.rowRef}: ${cells.join(' · ') || `estado ${l.goldStatus}->${l.systemStatus}`}`);
    }
    for (const f of r.splitFidelity.failures) problems.push(`${m.file} · split: ${f}`);
  }
  console.log(rows.at(-1));
}

console.log(`\n=== ${llm.config('main').model} · ${manifest.length} variantes · contra el mismo gold`);
console.log('  ok = 30 líneas, split 100%, 0 error silencioso, todas las celdas ciertas bien\n');
for (const r of rows) console.log(r);
if (problems.length) {
  console.log('\n  DIFERENCIAS (la forma del fichero no debería cambiar la salida):');
  for (const p of problems) console.log(`    ${p}`);
} else {
  console.log('\n  ninguna variante cambia la salida del pipeline.');
}
const fx = eurPerUsd() || 1;
console.log(`\n  coste $${llm.stats.costUsd.toFixed(4)} (${(llm.stats.costUsd / fx).toFixed(4)} €) · ${llm.stats.calls} llamadas, ${llm.stats.cacheHits} de caché`);
