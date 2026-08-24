/**
 * Identidad de línea de salida. SPEC-014.
 *
 * Kernel de dominio: no importa Next, SQLite ni el LLM. La huella sale de los siete
 * atributos canónicos. Cantidad, ITEM y número de fila no entran: son lo que el diff
 * entre revisiones tiene que poder cambiar sin que el material “se convierta en otro”.
 */
import { fold } from '../rules/text.ts';

export interface IdentityParts {
  name: string | null;
  material: string | null;
  quality: string | null;
  measure: string | null;
  length: string | null;
  standard: string | null;
  finish: string | null;
}

export interface IdentifiableLine {
  id: string;
  fingerprint: string;
  parts: IdentityParts;
  quantity: number | null;
  status: 'RESUELTA' | 'REVISION_MANUAL';
  itemRef: string | null;
  rowRef: string;
}

const IDENTITY_KEYS = [
  'name',
  'material',
  'quality',
  'measure',
  'length',
  'standard',
  'finish',
] as const satisfies readonly (keyof IdentityParts)[];

function canon(value: string | null | undefined): string {
  if (value == null) return '';
  const f = fold(value);
  return f;
}

export function fingerprintOf(parts: IdentityParts): string {
  return IDENTITY_KEYS.map((k) => canon(parts[k])).join('\u001f');
}

export function identifiable(input: Omit<IdentifiableLine, 'fingerprint'> & { fingerprint?: string }): IdentifiableLine {
  return {
    ...input,
    fingerprint: input.fingerprint ?? fingerprintOf(input.parts),
  };
}
