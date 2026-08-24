/**
 * Adaptador: OutputLine (pipeline) → IdentifiableLine (dominio).
 * La dependencia apunta hacia el dominio, no al revés: identity.ts no importa pipeline.
 */
import { fingerprintOf, type IdentifiableLine, type IdentityParts } from './identity.ts';
import type { OutputLine } from '../pipeline/types.ts';

export function partsFromOutput(line: OutputLine): IdentityParts {
  const a = line.attributes;
  return {
    name: a.name.normalized,
    material: a.material.normalized,
    quality: a.quality.normalized,
    measure: a.measure.normalized,
    length: a.length.normalized,
    standard: a.standard.normalized,
    finish: a.finish.normalized,
  };
}

export function toIdentifiable(line: OutputLine): IdentifiableLine {
  const parts = partsFromOutput(line);
  return {
    id: line.id,
    fingerprint: fingerprintOf(parts),
    parts,
    quantity: line.quantity,
    status: line.status,
    itemRef: line.rowRef,
    rowRef: line.rowRef,
  };
}

export function toIdentifiables(lines: OutputLine[]): IdentifiableLine[] {
  return lines.map(toIdentifiable);
}
