/** Cliente mínimo para POST /api/corrections desde la cola del comprador. */

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
