// Sanitization for untrusted, user-entered content before it reaches the AI
// provider. Comments, evidence notes, file names, and email references are
// untrusted data, never instructions (security-model.md).

// Control characters (C0 range + DEL). Built via RegExp constructor so no
// literal control bytes live in source.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g');

/** Strip control characters, collapse whitespace, and cap length. */
export function sanitizeText(value: string | undefined, maxLen = 280): string {
  if (!value) return '';
  let s = value.replace(CONTROL_CHARS, ' ').replace(/\s+/g, ' ').trim();
  if (s.length > maxLen) s = `${s.slice(0, maxLen)}…`;
  return s;
}

/** Build the risk-derivation metrics object from sanitized snapshots. */
export function deriveRiskMetrics(
  tasks: { overdue: boolean; status: string; hasEvidence: boolean }[],
): { overdue: number; waiting: number; evidenceGaps: number } {
  let overdue = 0;
  let waiting = 0;
  let evidenceGaps = 0;
  for (const t of tasks) {
    if (t.overdue) overdue += 1;
    if (t.status === 'Waiting Internal' || t.status === 'Waiting External') waiting += 1;
    if (t.status === 'Completed' && !t.hasEvidence) evidenceGaps += 1;
  }
  return { overdue, waiting, evidenceGaps };
}
