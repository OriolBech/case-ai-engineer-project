/**
 * Fachada única de vocabulario.
 *
 * Traduce las dos tablas que hoy viven separadas —derivación de material (`vocabulary-db.ts`) y alias
 * de acabado (`finish-db.ts`)— a la forma común de `vocab-model.ts`, para que exista UNA vista de
 * vocabulario en lugar de una pantalla por atributo. Nombre, calidad y norma se enchufan aquí cuando
 * tengan su capa de datos; hoy su lectura devuelve "aún no editable".
 *
 * No añade lógica de dominio: cada base sigue siendo la fuente de la verdad (SQLite + log). Esta capa
 * solo mapea formas y enruta. Importa las dos bases por namespace porque las dos exportan `addEntry`,
 * `listEntries`, etc. con firmas distintas.
 */

import * as materialDb from './vocabulary-db.ts';
import * as finishDb from './finish-db.ts';
import { suggestFinishEntryId } from './finish-vocab-id.ts';
import { NAME_ALIASES, normalizeName } from './names.ts';
import { QUALITY_GROUPS, normalizeQuality } from './quality.ts';
import { DIN_EQUIVALENCES, normalizeStandard } from './standards.ts';
import type {
  VocabAddInput,
  VocabAddResult,
  VocabAttribute,
  VocabEntry,
  VocabResolution,
  VocabUncovered,
} from './vocab-model.ts';

const today = (): string => new Date().toISOString().slice(0, 10);
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

function nextFreeId(preferred: string, taken: Iterable<string>): string {
  const ids = taken instanceof Set ? taken : new Set(taken);
  if (!ids.has(preferred)) return preferred;
  let n = 2;
  while (ids.has(`${preferred}-${n}`)) n++;
  return `${preferred}-${n}`;
}

/**
 * El id es la traza de una compra: no se reutiliza, ni aunque la entrada esté retirada. El front no
 * manda id — lo deriva del texto — así que al reañadir el mismo alias tras un retiro hay que mintar
 * uno nuevo; si no, `addEntry` responde "ya existe" y parece que el borrado no se aplicó.
 */
function allocateId(
  preferred: string,
  explicit: boolean,
  rows: { id: string; retiredAt: string | null }[],
): string {
  if (explicit) return preferred;
  const hit = rows.find((r) => r.id === preferred);
  if (!hit?.retiredAt) return preferred;
  return nextFreeId(preferred, rows.map((r) => r.id));
}

function slugId(prefix: string, text: string): string {
  const slug =
    text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'x';
  return `${prefix}-${slug}`;
}

// ---------------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------------

function materialToEntry(r: materialDb.VocabRow): VocabEntry {
  return {
    attribute: 'material',
    id: r.id,
    match: r.matchValue,
    matchLabel: r.matchKind === 'qualityGroup' ? `grupo ${r.matchValue}` : `patrón ${r.matchValue}`,
    value: r.material,
    kind: 'derivation',
    // La derivación de material es nuestra política P-3, no el catálogo del cliente: capa editable.
    source: 'added',
    rationale: r.rationale,
    // Sin autenticación no se atribuye a una persona: actor genérico, no el nombre real de la semilla.
    decidedBy: 'compras',
    decidedAt: r.decidedAt,
    evidence: r.source ?? null,
    retiredAt: r.retiredAt,
    retiredWhy: r.retiredWhy,
  };
}

function finishToEntry(r: finishDb.FinishAliasRow): VocabEntry {
  return {
    attribute: 'finish',
    id: r.id,
    match: r.alias,
    matchLabel: `texto “${r.alias}”`,
    value: r.kind === 'alias' ? r.finish : null,
    kind: r.kind === 'not_a_finish' ? 'not_a_finish' : 'alias',
    source: r.source,
    rationale: r.rationale,
    decidedBy: r.source === 'client' ? 'catálogo' : 'compras',
    decidedAt: r.decidedAt,
    evidence: r.evidence ?? null,
    retiredAt: r.retiredAt,
    retiredWhy: r.retiredWhy,
  };
}

/**
 * Nombre, calidad y norma son catálogos/equivalencias CERRADOS del cliente (§3, §5, §8), hoy tablas
 * en código. Se exponen en la vista única en solo lectura —con sus entradas reales, no un placeholder—
 * para que el comprador vea de un vistazo TODO lo que el sistema sabe traducir, no solo lo editable.
 */
function nameEntries(): VocabEntry[] {
  const out: VocabEntry[] = [];
  for (const [canonical, aliases] of NAME_ALIASES) {
    for (const alias of aliases) {
      out.push({
        attribute: 'name',
        id: slugId('name', `${canonical}-${alias.text}`),
        match: alias.text,
        matchLabel: `texto “${alias.text}”`,
        value: canonical,
        kind: 'alias',
        source: alias.source,
        rationale: `Sinónimo de ${canonical} (§3).`,
        decidedBy: 'catálogo',
        decidedAt: '',
        evidence: 'reglas §3',
        retiredAt: null,
        retiredWhy: null,
      });
    }
  }
  return out;
}

function qualityEntries(): VocabEntry[] {
  const out: VocabEntry[] = [];
  for (const [group, values] of QUALITY_GROUPS) {
    const canonical = values[0];
    for (const v of values) {
      out.push({
        attribute: 'quality',
        id: slugId('qual', `${group}-${v}`),
        match: v,
        matchLabel: `${v} · ${group}`,
        value: canonical,
        kind: 'equivalence',
        source: 'client',
        rationale: `Grupo ${group}: equivale a ${canonical} (§5).`,
        decidedBy: 'catálogo',
        decidedAt: '',
        evidence: 'reglas §5',
        retiredAt: null,
        retiredWhy: null,
      });
    }
  }
  return out;
}

function normaEntries(): VocabEntry[] {
  const out: VocabEntry[] = [];
  for (const [din, target] of DIN_EQUIVALENCES) {
    out.push({
      attribute: 'norma',
      id: slugId('norm', din),
      match: din,
      matchLabel: din,
      value: target,
      kind: 'equivalence',
      source: 'client',
      rationale: `El cliente no considera norma a ${din}: se normaliza a ${target} (§8).`,
      decidedBy: 'catálogo',
      decidedAt: '',
      evidence: 'reglas §8',
      retiredAt: null,
      retiredWhy: null,
    });
  }
  return out;
}

export function listAllVocab(): VocabEntry[] {
  const material = materialDb.listEntries({ includeRetired: true }).map(materialToEntry);
  const finish = finishDb.listEntries({ includeRetired: true }).map(finishToEntry);
  return [...material, ...finish, ...nameEntries(), ...qualityEntries(), ...normaEntries()];
}

export function listFinishCatalog(): string[] {
  return finishDb.listCatalog();
}

export function listAllUncovered(): VocabUncovered[] {
  return materialDb.listUncovered().map((u) => ({
    attribute: 'material' as const,
    match: u.matchValue,
    matchLabel: u.matchKind === 'qualityGroup' ? `grupo ${u.matchValue}` : `patrón ${u.matchValue}`,
    why: u.why,
  }));
}

// ---------------------------------------------------------------------------
// Vista previa
// ---------------------------------------------------------------------------

export function resolveVocab(attribute: VocabAttribute, text: string): VocabResolution {
  const t = text.trim();
  if (!t) return { known: false, value: null, detail: 'Escribe un texto.' };

  if (attribute === 'finish') {
    const r = finishDb.resolveFinish(t);
    if (r.kind === 'known') return { known: true, value: r.finish, detail: `Ya resuelve a ${r.finish}.` };
    if (r.kind === 'not_a_finish') return { known: true, value: null, detail: 'Ya declarado como “no es acabado”.' };
    if (r.kind === 'ambiguous') return { known: false, value: null, detail: 'Ambiguo: varias entradas lo cubren.' };
    return { known: false, value: null, detail: 'Todavía desconocido — al guardar aplicará a todos los MTO.' };
  }

  if (attribute === 'material') {
    const d = materialDb.deriveMaterial(t);
    if (materialDb.isDerived(d)) return { known: true, value: d.material, detail: `Ya deriva a ${d.material}.` };
    if (d.reason === 'deliberate') return { known: true, value: null, detail: `Declarada no derivable: ${d.why}` };
    if (d.reason === 'ambiguous') return { known: false, value: null, detail: 'Ambiguo: varias entradas la cubren.' };
    return { known: false, value: null, detail: 'Todavía sin derivación — al guardar aplicará a todos los MTO.' };
  }

  if (attribute === 'name') {
    const hit = normalizeName(t);
    if (hit) return { known: true, value: hit.value, detail: `Ya resuelve a ${hit.value}.` };
    return { known: false, value: null, detail: 'No está en el catálogo de nombres (§3), de solo lectura.' };
  }

  if (attribute === 'quality') {
    const q = normalizeQuality(t);
    if (q.inCatalog) return { known: true, value: q.canonical, detail: `Grupo ${q.group}: equivale a ${q.canonical}.` };
    return { known: false, value: null, detail: 'Fuera del catálogo §5: se conserva tal cual (solo lectura).' };
  }

  if (attribute === 'norma') {
    const s = normalizeStandard(t);
    if (s) return { known: true, value: s.normalized, detail: s.mapped ? `Se normaliza a ${s.normalized}.` : `Se conserva como ${s.normalized}.` };
    return { known: false, value: null, detail: 'No se reconoce como norma.' };
  }

  return { known: false, value: null, detail: 'La vista previa de este atributo llega en una próxima iteración.' };
}

// ---------------------------------------------------------------------------
// Alta / retiro
// ---------------------------------------------------------------------------

export function addVocab(input: VocabAddInput, opts: { force?: boolean } = {}): VocabAddResult {
  const at = today();
  const match = input.match.trim();
  if (!match) return { ok: false, warnings: [], error: 'Falta el texto/valor que dispara la entrada.' };

  try {
    if (input.attribute === 'finish') {
      const kind = input.kind === 'not_a_finish' ? 'not_a_finish' : 'alias';
      const explicitId = input.id?.trim();
      const id = allocateId(
        explicitId || suggestFinishEntryId(match),
        !!explicitId,
        finishDb.listEntries({ includeRetired: true }),
      );
      const rawFinish = kind === 'not_a_finish' ? null : (input.value?.trim() ?? null);
      const { warnings } = finishDb.addEntry(
        {
          id,
          alias: match,
          kind,
          finish: rawFinish,
          source: 'added',
          rationale: input.rationale,
          decidedBy: input.decidedBy,
          evidence: input.evidence?.trim() || 'alta rápida desde la vista de vocabulario',
        },
        at,
        undefined,
        { allowShortAlias: !!input.allowShortAlias, force: opts.force },
      );
      return { ok: true, warnings };
    }

    if (input.attribute === 'material') {
      if (input.value !== 'AC' && input.value !== 'INOX') {
        return { ok: false, warnings: [], error: 'El material debe ser AC o INOX.' };
      }
      const matchKind = input.matchKind ?? 'qualityPattern';
      const explicitId = input.id?.trim();
      const id = allocateId(
        explicitId || slugId('mat', `${match}-${input.value}`),
        !!explicitId,
        materialDb.listEntries({ includeRetired: true }),
      );
      const { warnings } = materialDb.addEntry(
        {
          id,
          matchKind,
          matchValue: match,
          material: input.value,
          rationale: input.rationale,
          decidedBy: input.decidedBy,
          source: input.evidence?.trim() || 'UI comprador',
        },
        at,
        undefined,
        { force: opts.force },
      );
      return { ok: true, warnings };
    }

    return { ok: false, warnings: [], error: 'Este atributo todavía no es editable desde el vocabulario.' };
  } catch (e) {
    return { ok: false, warnings: [], error: msg(e) };
  }
}

export function retireVocab(attribute: VocabAttribute, id: string, why: string, by: string): void {
  const at = today();
  if (attribute === 'finish') return finishDb.retireEntry(id, why, by, at);
  if (attribute === 'material') return materialDb.retireEntry(id, why, by, at);
  throw new Error('Este atributo todavía no es editable desde el vocabulario.');
}
