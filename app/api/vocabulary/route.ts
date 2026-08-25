/**
 * Fachada HTTP única del vocabulario, para todos los atributos.
 *
 * Sustituye a las dos rutas separadas (`/api/vocabulary` solo material y `/api/finish-vocabulary`
 * solo acabado): una sola vista del front habla solo con ésta. Delega en `src/rules/vocab.ts`, que a
 * su vez enruta a la base de cada atributo (SQLite + log append-only). Una entrada añadida aquí es
 * indistinguible de una añadida por CLI.
 *
 * No bloqueante por defecto: un alta que dispararía una guarda (ambigüedad, alias corto, regresión)
 * se guarda igual y devuelve `warnings` para que la vista los pinte. Solo lo estructuralmente
 * imposible (id repetido, alias sin acabado, material no AC/INOX) responde con error.
 *
 * Necesita el runtime de Node porque `node:sqlite` no corre en Edge.
 */
import { addVocab, listAllUncovered, listAllVocab, listFinishCatalog, resolveVocab, retireVocab } from '../../../src/rules/vocab.ts';
import type { VocabAddInput, VocabAttribute } from '../../../src/rules/vocab-model.ts';
import { recordVocabularyKpiEvent } from '../../../src/kpi/events.ts';

export const runtime = 'nodejs';

const ATTRS: VocabAttribute[] = ['name', 'material', 'quality', 'norma', 'finish'];
const isAttr = (v: unknown): v is VocabAttribute => typeof v === 'string' && (ATTRS as string[]).includes(v);
const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export async function GET(): Promise<Response> {
  try {
    return Response.json({
      entries: listAllVocab(),
      uncovered: listAllUncovered(),
      finishCatalog: listFinishCatalog(),
    });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 500 });
  }
}

interface AddBody extends Partial<VocabAddInput> {
  /** false para exigir el comportamiento bloqueante clásico. Por defecto true (demo). */
  force?: boolean;
}

export async function POST(req: Request): Promise<Response> {
  let body: AddBody;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  if (!isAttr(body.attribute)) {
    return Response.json({ error: 'Falta o es inválido el campo attribute.' }, { status: 400 });
  }
  if (!body.match || !body.decidedBy) {
    return Response.json(
      { error: 'Faltan campos: match y decidedBy son obligatorios.' },
      { status: 400 },
    );
  }

  const input: VocabAddInput = {
    attribute: body.attribute,
    match: body.match,
    value: body.value ?? null,
    kind: body.kind,
    matchKind: body.matchKind,
    rationale: body.rationale?.trim() ?? '',
    decidedBy: body.decidedBy,
    evidence: body.evidence,
    id: body.id,
    allowShortAlias: body.allowShortAlias,
  };

  // Por defecto no se bloquea (force=true); solo si el llamador pide force:false se aplica la guarda.
  const result = addVocab(input, { force: body.force !== false });
  if (!result.ok) {
    return Response.json({ error: result.error ?? 'No se pudo guardar la entrada.' }, { status: 422 });
  }
  const warnings = [...result.warnings];
  if (result.entryId) {
    try {
      recordVocabularyKpiEvent({ entryId: result.entryId, attribute: input.attribute });
    } catch (error) {
      warnings.push(
        `La entrada se guardó, pero no se pudo registrar su KPI: ${msg(error)}`,
      );
    }
  }
  return Response.json({
    ok: true,
    warnings,
    entryId: result.entryId,
    entries: listAllVocab(),
    uncovered: listAllUncovered(),
    finishCatalog: listFinishCatalog(),
  });
}

export async function PUT(req: Request): Promise<Response> {
  let body: { attribute?: unknown; text?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (!isAttr(body.attribute) || typeof body.text !== 'string') {
    return Response.json({ error: 'Faltan attribute o text.' }, { status: 400 });
  }
  return Response.json({ resolution: resolveVocab(body.attribute, body.text) });
}

export async function DELETE(req: Request): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const attribute = searchParams.get('attribute');
  const id = searchParams.get('id');
  const why = searchParams.get('why') ?? 'Retirada desde el front sin motivo explícito.';
  const by = searchParams.get('by') ?? 'comprador (front)';

  if (!isAttr(attribute)) return Response.json({ error: 'Falta ?attribute=' }, { status: 400 });
  if (!id) return Response.json({ error: 'Falta ?id=' }, { status: 400 });

  try {
    retireVocab(attribute, id, why, by);
    return Response.json({
      ok: true,
      entries: listAllVocab(),
      uncovered: listAllUncovered(),
      finishCatalog: listFinishCatalog(),
    });
  } catch (e) {
    return Response.json({ error: msg(e) }, { status: 409 });
  }
}
