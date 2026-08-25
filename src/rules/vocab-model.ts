/**
 * Modelo unificado de vocabulario · tipos puros, sin dependencias de Node.
 *
 * Es la forma común a la que la fachada (`src/rules/vocab.ts`) traduce las dos tablas que hoy viven
 * separadas —derivación de material (`vocabulary-db.ts`) y alias de acabado (`finish-db.ts`)— más las
 * que vengan (nombre, calidad, norma). El front consume ESTOS tipos, nunca los de cada base, para que
 * exista una sola vista de vocabulario en lugar de una pantalla por atributo.
 *
 * Este fichero no importa `node:sqlite` a propósito: lo comparten cliente y servidor, igual que
 * `src/pipeline/types.ts`.
 */

export type VocabAttribute = 'name' | 'material' | 'quality' | 'norma' | 'finish';

export type VocabKind = 'alias' | 'derivation' | 'equivalence' | 'not_a_finish';

/** Una entrada de vocabulario, sea del atributo que sea, en la forma que pinta la vista única. */
export interface VocabEntry {
  attribute: VocabAttribute;
  id: string;
  /** Lo que dispara la entrada: el alias tal cual, o el grupo/patrón de calidad. */
  match: string;
  /** El `match` en legible para la tabla: `texto “HDG”`, `grupo G5`, `patrón ^45H$`. */
  matchLabel: string;
  /** A qué resuelve: un valor de catálogo (ItemName, AC|INOX, ISO 4032, CINCADO…). null = no-acabado. */
  value: string | null;
  kind: VocabKind;
  /** `client` = catálogo cerrado del cliente (solo lectura). `added` = nuestra capa editable. */
  source: 'client' | 'added';
  rationale: string;
  decidedBy: string;
  decidedAt: string;
  evidence: string | null;
  retiredAt: string | null;
  retiredWhy: string | null;
}

/** Un valor declarado a propósito como no derivable (p. ej. una dureza HV en material). No es un hueco. */
export interface VocabUncovered {
  attribute: VocabAttribute;
  match: string;
  matchLabel: string;
  why: string;
}

/** Vista previa de a qué resuelve HOY un texto para un atributo, antes de dar de alta nada. */
export interface VocabResolution {
  known: boolean;
  value: string | null;
  detail: string;
}

/** Lo que la vista manda para dar de alta una entrada, común a todos los atributos. */
export interface VocabAddInput {
  attribute: VocabAttribute;
  /** Alias / texto del MTO, o grupo/patrón de calidad (material). */
  match: string;
  /** Valor de catálogo al que resuelve. null para `not_a_finish`. */
  value: string | null;
  kind?: VocabKind;
  /** Solo material: cómo casa la calidad. */
  matchKind?: 'qualityGroup' | 'qualityPattern';
  rationale: string;
  decidedBy: string;
  evidence?: string;
  id?: string;
  allowShortAlias?: boolean;
}

/**
 * Resultado de un alta. `ok` no implica "sin avisos": para la demo el alta NO se bloquea, así que una
 * entrada que dispararía una guarda (ambigüedad, alias corto, regresión) se guarda igual y sus avisos
 * viajan en `warnings` para pintarlos. `ok:false` es solo para lo estructuralmente imposible (id
 * repetido, alias sin acabado, material que no es AC/INOX).
 */
export interface VocabAddResult {
  ok: boolean;
  warnings: string[];
  error?: string;
  entryId?: string;
}

/** El orden y las etiquetas de los atributos en la vista única. `editable:false` = solo lectura hoy. */
export const VOCAB_ATTRIBUTES: { key: VocabAttribute; label: string; editable: boolean }[] = [
  { key: 'name', label: 'Nombre', editable: false },
  { key: 'material', label: 'Material', editable: true },
  { key: 'quality', label: 'Calidad', editable: true },
  { key: 'norma', label: 'Norma', editable: false },
  { key: 'finish', label: 'Acabado', editable: true },
];
