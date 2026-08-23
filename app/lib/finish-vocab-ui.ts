/** Etiquetas del catálogo §9 para la UI de compras. */
export const FINISH_OPTIONS: { value: string; label: string; hint: string }[] = [
  { value: 'CINCADO', label: 'Cincado / zincado electrolítico', hint: 'Zincado, tropicalizado, zinc plated…' },
  { value: 'GALVANIZADO EN CALIENTE', label: 'Galvanizado en caliente', hint: 'Hot-dip, HDZ, mech galv…' },
  { value: 'GEOMET', label: 'Geomet / zinc flake', hint: 'Delta-Protekt, Magni, recubrimientos base agua…' },
  { value: 'DACROMET', label: 'Dacromet', hint: 'Marcas y variantes Dacromet' },
  { value: 'BICROMATADO', label: 'Bicromatado', hint: 'Cromato amarillo, yellow chromate…' },
  { value: 'PAVONADO', label: 'Pavonado / black oxide', hint: 'Oxidación negra, BLACK…' },
  { value: 'FOSFATADO', label: 'Fosfatado', hint: 'Fosfato de zinc o manganeso' },
];

export const DECIDED_BY_KEY = 'sapira-finish-decidedBy';

export function loadDecidedBy(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(DECIDED_BY_KEY) ?? '';
}

export function saveDecidedBy(name: string): void {
  if (typeof window === 'undefined' || !name.trim()) return;
  window.localStorage.setItem(DECIDED_BY_KEY, name.trim());
}

/** Línea con acabado extraído que la tabla aún no reconoce. */
export function lineNeedsFinishVocab(line: {
  attributes: { finish: { raw: string | null; normalized: string | null; rule?: string | null } };
}): boolean {
  const f = line.attributes.finish;
  return !!f.raw?.trim() && f.normalized === null && f.rule === 'finish:unmapped';
}
