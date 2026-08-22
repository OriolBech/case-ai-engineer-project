/**
 * Stage 1 — ingest. See specs/SPEC-001-ingest.md.
 *
 * Turns an MTO workbook into MtoRow[] without interpreting anything. Two rules drive the whole
 * design:
 *
 * 1. The original text is preserved verbatim with stable offsets, because every span produced
 *    downstream points here and the challenge asks for the trace of specific rows.
 * 2. Header names are metadata, NEVER semantics. This MTO has a column called MATERIAL that holds
 *    the quality or the standard with its grade. The column name is not the attribute.
 */

import ExcelJS from 'exceljs';
import type { MtoRow, Span } from './types.ts';

export interface IngestResult {
  rows: MtoRow[];
  /**
   * Structural problems with the FILE, not with a row.
   *
   * The case that motivated this: one unrecognised quantity header turned into 30 output lines each
   * carrying the same QUANTITY_NOT_STATED reason. That is a single configuration problem wearing the
   * costume of thirty data problems, and it is exactly how a review queue fills with noise. Surfaced
   * once, at file level, with the candidate columns, so a human fixes it once.
   */
  warnings: { code: string; message: string }[];
  /** Rows dropped as empty, and sheets we did not process. Reported, never silent. */
  skipped: { sheet: string; rowNumber: number; reason: string }[];
  sheetsIgnored: string[];
  headers: string[];
}

/**
 * ExcelJS returns row.values as a SPARSE, 1-based array: an empty cell is a hole, not a null. And
 * `Array.prototype.map` PRESERVES holes — it skips them — so mapping over a sparse row silently
 * produced an array whose entries were `undefined` rather than `null`, and a `text === null` guard
 * let `undefined.trim()` through.
 *
 * It only showed up on a file shape the given MTO does not have: one blank column before the
 * headers. Densifying here means no code downstream has to know about holes.
 */
function denseRow(ws: ExcelJS.Worksheet, n: number, width?: number): (ExcelJS.CellValue | undefined)[] {
  const raw = ws.getRow(n).values as ExcelJS.CellValue[];
  const len = width ?? Math.max(0, raw.length - 1);
  return Array.from({ length: len }, (_, i) => raw[i + 1]);
}

/** Cell text, verbatim. No trimming of the value itself, no case folding: that is stage 4's job. */
function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'object') {
    // Rich text and formula results.
    if ('richText' in v && Array.isArray(v.richText)) return v.richText.map((r) => r.text).join('');
    if ('text' in v && typeof v.text === 'string') return v.text;
    if ('result' in v) return cellText(v.result as ExcelJS.CellValue);
  }
  return null;
}

const SEP = ' | ';

/**
 * A header row is the first row with at least MIN_HEADER_CELLS non-empty cells. Everything above
 * it (title banners, blank rows) is dropped. We do not look for specific column names — see rule 2.
 */
const MIN_HEADER_CELLS = 3;

function findHeaderRow(ws: ExcelJS.Worksheet): number | null {
  for (let n = 1; n <= Math.min(ws.rowCount, 25); n++) {
    const filled = denseRow(ws, n).filter((v) => (cellText(v) ?? '').trim() !== '').length;
    if (filled >= MIN_HEADER_CELLS) return n;
  }
  return null;
}

/** Header comparison key: diacritics and punctuation removed. `Q'TY` -> `QTY`, `QUANTITÉ` -> `QUANTITE`. */
function headerKey(h: string): string {
  return h.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/**
 * Quantity header tokens, most specific first. Folded before matching, which is what makes `Q'TY`
 * work — a very common piping-MTO spelling that the first version missed, losing the quantity of
 * every single row in that file.
 *
 * `UDS` is last on purpose: in Spanish MTOs it is more often the UNIT column than the quantity one,
 * so it only wins when nothing better matched.
 */
const QTY_HEADERS = ['CANTIDAD', 'CANT', 'QUANTITY', 'QUANTITE', 'QUANT', 'QTY', 'NOS', 'UDS'];

/**
 * Quantity comes ONLY from a column whose header identifies it as a quantity. No header hint, no
 * quantity.
 *
 * The tempting fallback — "take the last numeric cell" — is actively wrong here, and the synthetic
 * set caught it: on a row whose quantity is blank, it picked up the `8.8` sitting in the column
 * named MATERIAL and turned a property class into an order of 8.8 units. That is the MATERIAL-column
 * trap of §4 reappearing where you would not look for it, and it is also what §1 forbids: filling
 * an absent value with the most likely one. A null quantity is reported by the validator; an
 * invented quantity buys the wrong amount of steel.
 */
function quantityColumn(headers: string[]): number {
  const keys = headers.map(headerKey);
  for (const token of QTY_HEADERS) {
    const i = keys.findIndex((k) => k.startsWith(token));
    if (i >= 0) return i;
  }
  return -1;
}

function pickQuantity(cells: (string | null)[], col: number): number | null {
  if (col < 0) return null;
  const raw = cells[col];
  if (raw === null || raw === undefined) return null;
  // `40,00` and `1.250` both appear in real files; strip thousands dots only when a comma follows.
  const cleaned = /,/.test(raw) ? raw.replace(/\./g, '').replace(',', '.') : raw;
  const n = Number(cleaned.replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) && cleaned.trim() !== '' ? n : null;
}

const UNIT_HEADERS = ['UD', 'UNIDAD', 'UNIT', 'UNITE', 'UM', 'UOM'];

function unitColumn(headers: string[], qtyCol: number): number {
  const keys = headers.map(headerKey);
  for (const token of UNIT_HEADERS) {
    const i = keys.findIndex((k, j) => j !== qtyCol && k.startsWith(token));
    if (i >= 0) return i;
  }
  return -1;
}

export async function ingest(fileOrBuffer: string | Buffer): Promise<IngestResult> {
  const wb = new ExcelJS.Workbook();
  if (typeof fileOrBuffer === 'string') await wb.xlsx.readFile(fileOrBuffer);
  else await wb.xlsx.load(fileOrBuffer as unknown as ArrayBuffer);

  const rows: MtoRow[] = [];
  const skipped: IngestResult['skipped'] = [];
  const sheetsIgnored: string[] = [];
  const warnings: IngestResult['warnings'] = [];
  let headers: string[] = [];
  let processed = false;

  for (const ws of wb.worksheets) {
    const headerRow = findHeaderRow(ws);
    if (headerRow === null) { sheetsIgnored.push(`${ws.name} (sin cabeceras reconocibles)`); continue; }
    if (processed) { sheetsIgnored.push(`${ws.name} (sólo se procesa la primera hoja con cabeceras)`); continue; }
    processed = true;

    const headerCells = denseRow(ws, headerRow);
    headers = headerCells.map((v) => (cellText(v) ?? '').trim());

    const qtyCol = quantityColumn(headers);
    const unitCol = unitColumn(headers, qtyCol);
    if (qtyCol < 0) {
      const numericCandidates = headers
        .map((h, i) => ({ h, i }))
        .filter(({ i }) => {
          // A column is a candidate if most of its cells parse as a number.
          let num = 0, tot = 0;
          for (let n = headerRow + 1; n <= Math.min(ws.rowCount, headerRow + 20); n++) {
            const v = cellText(denseRow(ws, n, headers.length)[i]);
            if (v === null || v.trim() === '') continue;
            tot++;
            if (Number.isFinite(Number(v.replace(',', '.')))) num++;
          }
          return tot > 0 && num / tot > 0.8;
        })
        .map(({ h, i }) => h || `columna ${i + 1}`);
      warnings.push({
        code: 'QUANTITY_COLUMN_NOT_RECOGNISED',
        message: numericCandidates.length
          ? `No reconozco la columna de cantidad. Candidatas numéricas: ${numericCandidates.join(', ')}. ` +
            'Sin ella, todas las líneas saldrán sin cantidad.'
          : 'El fichero no tiene ninguna columna de cantidad reconocible ni candidata numérica.',
      });
    }

    for (let n = headerRow + 1; n <= ws.rowCount; n++) {
      // Width pinned to the header row: a data row with extra trailing cells would otherwise shift
      // the column-to-header mapping.
      const raw = denseRow(ws, n, headers.length);
      const cells: (string | null)[] = Array.from({ length: headers.length }, (_, i) => cellText(raw[i]));

      if (cells.every((c) => (c ?? '').trim() === '')) {
        skipped.push({ sheet: ws.name, rowNumber: n, reason: 'EMPTY_ROW' });
        continue;
      }

      // Build sourceText from EVERY text cell, in order. Dropping columns would lose data: in this
      // MTO the nut's standard and grade live only in the column named MATERIAL.
      const cellOffsets: Record<string, Span> = {};
      const parts: string[] = [];
      let cursor = 0;
      for (let i = 0; i < headers.length; i++) {
        const text = cells[i];
        if (text === null || text === undefined || text.trim() === '') continue;
        const start = cursor;
        parts.push(text);
        cursor += text.length;
        cellOffsets[headers[i] || `col${i + 1}`] = { start, end: cursor };
        cursor += SEP.length;
      }
      const sourceText = parts.join(SEP);

      const itemIdx = headers.findIndex((h) => /^ITEM|^POS|^REF|^L[IÍ]NEA|^N[ºo°]/i.test(h));
      rows.push({
        itemRef: (itemIdx >= 0 ? cells[itemIdx] : null) ?? String(n),
        sourceText,
        cellOffsets,
        quantity: pickQuantity(cells, qtyCol),
        unit: unitCol >= 0 ? cells[unitCol] : null,
        sheet: ws.name,
        rowNumber: n,
      });
    }
  }

  return { rows, skipped, sheetsIgnored, headers, warnings };
}

/** Recovers the exact substring a span points at. Used by the trace panel and by the tests. */
export function textAt(row: MtoRow, span: Span): string {
  return row.sourceText.slice(span.start, span.end);
}
