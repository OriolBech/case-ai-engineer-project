/** Id estable para una entrada de vocabulario de acabado (`finish-{slug}`). */
export function suggestFinishEntryId(alias: string): string {
  const slug = alias
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `finish-${slug || 'nuevo'}`;
}
