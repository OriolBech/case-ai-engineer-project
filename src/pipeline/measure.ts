/**
 * Nominal diameters and lengths — reglas_tornilleria.md §6 and §7, plus policy P-4.
 *
 * §6: measures are inches (") or metric (M) and THERE ARE NO EQUIVALENCES between the two. Nothing
 * here ever converts one system into the other for output; the millimetre values below exist only
 * to reason about plausibility, and never leave this module as a normalized value.
 */

const MM_PER_INCH = 25.4;

export interface ParsedMeasure {
  raw: string;
  system: 'metric' | 'imperial';
  /** Nominal diameter in mm. For plausibility reasoning only, never emitted as the attribute. */
  nominalMm: number;
  canonical: string;
}

/** `M20` -> metric 20. `7/8"` -> imperial 22.225. `1-1/2"` -> imperial 38.1. */
export function parseMeasure(raw: string): ParsedMeasure | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, ' ');

  const metric = s.match(/^M\s*(\d+(?:[.,]\d+)?)/);
  if (metric) {
    const n = Number(metric[1].replace(',', '.'));
    if (!Number.isFinite(n) || n <= 0) return null;
    return { raw, system: 'metric', nominalMm: n, canonical: `M${trim(n)}` };
  }

  const inches = parseInches(s);
  if (inches !== null) {
    return { raw, system: 'imperial', nominalMm: inches * MM_PER_INCH, canonical: `${formatInches(inches)}"` };
  }

  // Bare numeric designations such as the `4.8x25` of DIN 7981 self-tapping screws: metric family,
  // no M prefix. Treated as metric so length reasoning works; kept verbatim as the canonical value.
  const bare = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (bare) {
    const n = Number(bare[1].replace(',', '.'));
    if (Number.isFinite(n) && n > 0) return { raw, system: 'metric', nominalMm: n, canonical: trim(n) };
  }
  return null;
}

function parseInches(s: string): number | null {
  // 1-1/2" or 1 1/2"
  const mixed = s.match(/^(\d+)\s*[- ]\s*(\d+)\s*\/\s*(\d+)\s*"?/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\s*\/\s*(\d+)\s*"?/);
  if (frac) return Number(frac[1]) / Number(frac[2]);
  const whole = s.match(/^(\d+(?:[.,]\d+)?)\s*"/);
  if (whole) return Number(whole[1].replace(',', '.'));
  return null;
}

const FRACTIONS: [number, string][] = [
  [1 / 8, '1/8'], [1 / 4, '1/4'], [3 / 8, '3/8'], [1 / 2, '1/2'],
  [5 / 8, '5/8'], [3 / 4, '3/4'], [7 / 8, '7/8'],
];

function formatInches(v: number): string {
  const whole = Math.floor(v + 1e-9);
  const rest = v - whole;
  const f = FRACTIONS.find(([x]) => Math.abs(x - rest) < 1e-6);
  if (rest < 1e-6) return String(whole);
  if (!f) return trim(v);
  return whole > 0 ? `${whole}-${f[1]}` : f[1];
}

const trim = (n: number): string => String(Number(n.toFixed(4)));

// ---------------------------------------------------------------------------
// Length (§7) and policy P-4
// ---------------------------------------------------------------------------

/**
 * Plausible ratio of length to nominal diameter for a fastener. Wide on purpose: it only has to
 * separate "130 mm on a 7/8\" stud" (ratio 5.9) from "130 inches on a 7/8\" stud" (ratio 148).
 */
const MIN_RATIO = 0.4;
const MAX_RATIO = 60;

export type LengthUnit = 'mm' | 'inch';

export interface ResolvedLength {
  value: number;
  unit: LengthUnit;
  /** 'stated' — the row wrote the unit. 'designation' — metric ISO designation, unambiguous.
   *  'plausibility' — imperial with no unit, resolved by the range (P-4). */
  basis: 'stated' | 'designation' | 'plausibility';
  implausible: false;
}

export interface ImplausibleLength { implausible: true; candidates: LengthUnit[] }

/**
 * Resolves the unit of a length.
 *
 * Three cases that are NOT the same, and conflating them was an error worth writing down:
 *
 *  - The row states the unit (`40 mm`, `2"`): nothing to decide.
 *  - Metric designation (`M20x90`): `90` is millimetres by the ISO designation itself. Certain,
 *    not a policy.
 *  - Imperial with a bare number (`7/8" X 130`): genuinely open. Resolved by the ratio range above,
 *    applied uniformly rather than row by row. Anything the range cannot separate goes to review
 *    as LENGTH_UNIT_IMPLAUSIBLE instead of being resolved wrongly.
 */
export function resolveLength(rawLength: string, measure: ParsedMeasure | null): ResolvedLength | ImplausibleLength | null {
  const s = rawLength.trim().toUpperCase();

  const withMm = s.match(/^(\d+(?:[.,]\d+)?)\s*MM$/);
  if (withMm) return { value: num(withMm[1]), unit: 'mm', basis: 'stated', implausible: false };

  const withIn = s.match(/^(\d+(?:[.,]\d+)?|\d+\s*[- ]\s*\d+\s*\/\s*\d+|\d+\s*\/\s*\d+)\s*"$/);
  if (withIn) {
    const v = parseInches(s);
    if (v !== null) return { value: v, unit: 'inch', basis: 'stated', implausible: false };
  }

  const bare = s.match(/^(\d+(?:[.,]\d+)?)$/);
  if (!bare) return null;
  const n = num(bare[1]);

  if (measure?.system === 'metric') {
    return { value: n, unit: 'mm', basis: 'designation', implausible: false };
  }
  if (!measure) return null;

  const asMm = n / measure.nominalMm;
  const asInch = (n * MM_PER_INCH) / measure.nominalMm;
  const mmOk = asMm >= MIN_RATIO && asMm <= MAX_RATIO;
  const inchOk = asInch >= MIN_RATIO && asInch <= MAX_RATIO;

  if (mmOk && !inchOk) return { value: n, unit: 'mm', basis: 'plausibility', implausible: false };
  if (inchOk && !mmOk) return { value: n, unit: 'inch', basis: 'plausibility', implausible: false };
  return { implausible: true, candidates: [...(mmOk ? ['mm' as const] : []), ...(inchOk ? ['inch' as const] : [])] };
}

const num = (s: string): number => Number(s.replace(',', '.'));

export const formatLength = (l: ResolvedLength): string =>
  l.unit === 'mm' ? `${trim(l.value)} mm` : `${formatInches(l.value)}"`;
