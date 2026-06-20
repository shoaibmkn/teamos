// Deterministic offline summarizer. Default AI provider when no Gemini key is
// configured. Produces advisory text and structured risk purely from numeric
// metrics — it never interprets untrusted note text, so it is injection-proof
// by construction. Guarantees the product runs on free-tier infrastructure.

import type { AiProvider, AiSummaryInput, AiSummaryOutput, RiskSignal } from './provider';

export const OFFLINE_PROMPT_VERSION = 'offline-v1';

function pct(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.round((part / whole) * 100);
}

export class OfflineAiProvider implements AiProvider {
  readonly model = 'teamos-offline';
  readonly promptVersion = OFFLINE_PROMPT_VERSION;

  async summarize(input: AiSummaryInput): Promise<AiSummaryOutput> {
    const m = input.metrics;
    const total = m.total ?? input.tasks.length;
    const completed = m.completed ?? 0;
    const overdue = m.overdue ?? 0;
    const waiting = m.waiting ?? 0;
    const evidenceGaps = m.evidenceGaps ?? 0;
    const blocked = m.blocked ?? waiting;

    const risk: RiskSignal[] = [];
    if (overdue > 0) {
      risk.push({
        kind: 'overdue',
        severity: overdue >= 3 ? 'high' : 'medium',
        message: `${overdue} task(s) past due in ${input.scopeLabel}.`,
      });
    }
    if (waiting > 0) {
      risk.push({
        kind: 'waiting',
        severity: waiting >= 4 ? 'medium' : 'low',
        message: `${waiting} task(s) waiting on internal or external responses.`,
      });
    }
    if (evidenceGaps > 0) {
      risk.push({
        kind: 'evidence_gap',
        severity: 'high',
        message: `${evidenceGaps} completed task(s) missing evidence.`,
      });
    }
    if (total > 0 && pct(completed, total) < 40 && overdue > 0) {
      risk.push({
        kind: 'throughput',
        severity: 'medium',
        message: `Completion at ${pct(completed, total)}% with active overdue work.`,
      });
    }

    const lines: string[] = [];
    lines.push(
      `Operational summary for ${input.scopeLabel} (${input.periodStart} to ${input.periodEnd}).`,
    );
    lines.push(
      `${total} task(s) in scope; ${completed} completed (${pct(completed, total)}%), ` +
        `${blocked} blocked/waiting, ${overdue} overdue.`,
    );
    if (risk.length === 0) {
      lines.push('No material risk signals detected. Work is on track.');
    } else {
      lines.push('Risk signals:');
      for (const r of risk) lines.push(`- [${r.severity.toUpperCase()}] ${r.message}`);
    }
    lines.push('This summary is advisory only. Apply any change through normal task actions.');

    return {
      summaryText: lines.join('\n'),
      risk,
      model: this.model,
      promptVersion: this.promptVersion,
    };
  }
}
