/** Cliente mínimo para POST /api/corrections desde la cola del comprador. */
import type {
  HumanCorrection,
  ValueConflict,
} from '../../src/eval/history/corrections.ts';

export interface PostCorrectionInput {
  rowRef: string;
  lineId: string | null;
  attribute: string;
  previousValue: string | null;
  correctedValue: string | null;
  evidence: string;
  rationale: string;
  rowSourceText: string;
  author?: string;
}

export async function postCorrection(input: PostCorrectionInput): Promise<string> {
  const res = await fetch('/api/corrections', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body.id as string;
}

export interface CorrectionQueueData {
  pending: HumanCorrection[];
  approved: HumanCorrection[];
  conflicts: ValueConflict[];
}

export async function getCorrectionQueue(): Promise<CorrectionQueueData> {
  const res = await fetch('/api/corrections');
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as CorrectionQueueData;
}

export async function decideCorrection(input: {
  id: string;
  action: 'approve' | 'reject' | 'promote';
  actor: string;
  regressionConfirmed?: boolean;
  promotedEntryId?: string;
}): Promise<CorrectionQueueData> {
  const res = await fetch('/api/corrections', {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
  return body as CorrectionQueueData;
}
