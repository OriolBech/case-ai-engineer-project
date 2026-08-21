/**
 * Text helpers shared by every table lookup.
 *
 * Deterministic, dependency-free. See specs/SPEC-004-normalizer.md.
 */

/** Uppercase, strip diacritics, collapse whitespace. `zingué` -> `ZINGUE`. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Where an alias came from. The client's tables are the source of truth; anything we added
 * (gender/number inflections, other languages) is a decision and has to be auditable —
 * `npm run rules:audit` lists every 'added' entry. See docs/03-policies.md.
 */
export type AliasSource = 'client' | 'added';

export interface Alias {
  text: string;
  source: AliasSource;
}

export const c = (...t: string[]): Alias[] => t.map((text) => ({ text, source: 'client' as const }));
export const a = (...t: string[]): Alias[] => t.map((text) => ({ text, source: 'added' as const }));

export interface AliasHit<T> {
  value: T;
  alias: string;
  aliasSource: AliasSource;
  span: { start: number; end: number };
}

/**
 * Finds aliases inside free text, longest-first.
 *
 * Longest-first is not a nicety: `STUD BOLT` contains `BOLT`, so shortest-first would classify
 * every stud bolt in the MTO as a TORNILLO. Row 1 of the given MTO is exactly this case.
 *
 * Matching is word-bounded, which matters for the two-letter finish aliases (`ZN`, `ZP`, `BL`) —
 * unbounded they would fire inside unrelated words.
 */
export function findAliases<T>(text: string, table: ReadonlyMap<T, readonly Alias[]>): AliasHit<T>[] {
  const folded = fold(text);
  const entries: { value: T; alias: Alias }[] = [];
  for (const [value, aliases] of table) for (const alias of aliases) entries.push({ value, alias });
  entries.sort((x, y) => y.alias.text.length - x.alias.text.length);

  const hits: AliasHit<T>[] = [];
  const claimed: boolean[] = new Array(folded.length).fill(false);

  for (const { value, alias } of entries) {
    const needle = fold(alias.text);
    const re = new RegExp(`(?<![A-Z0-9])${escapeRe(needle)}(?![A-Z0-9])`, 'g');
    for (let m = re.exec(folded); m; m = re.exec(folded)) {
      const start = m.index;
      const end = start + needle.length;
      // A longer alias already covering this text wins; don't double-count the overlap.
      let free = true;
      for (let i = start; i < end; i++) if (claimed[i]) { free = false; break; }
      if (!free) continue;
      for (let i = start; i < end; i++) claimed[i] = true;
      hits.push({ value, alias: alias.text, aliasSource: alias.source, span: { start, end } });
    }
  }
  return hits.sort((x, y) => x.span.start - y.span.start);
}

/** Exact-ish lookup for a value the extractor already isolated. */
export function lookupAlias<T>(raw: string, table: ReadonlyMap<T, readonly Alias[]>): AliasHit<T> | null {
  const needle = fold(raw);
  let best: AliasHit<T> | null = null;
  for (const [value, aliases] of table) {
    for (const alias of aliases) {
      if (fold(alias.text) !== needle) continue;
      const hit = {
        value,
        alias: alias.text,
        aliasSource: alias.source,
        span: { start: 0, end: raw.length },
      };
      if (!best || alias.source === 'client') best = hit;
    }
  }
  return best;
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
