// AI advisory boundary (ADR-0003). The provider receives only sanitized,
// least-privilege data and returns advisory text plus structured risk signals.
// It has NO repository access and cannot mutate records.

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskSignal {
  kind: string;
  severity: RiskSeverity;
  message: string;
}

/** A single sanitized work item handed to the model. */
export interface AiTaskSnapshot {
  title: string;
  status: string;
  priority: string;
  overdue: boolean;
  waitingReason?: string;
  hasEvidence: boolean;
}

export interface AiSummaryInput {
  scopeType: string;
  scopeLabel: string;
  periodStart: string;
  periodEnd: string;
  metrics: Record<string, number>;
  /** Sanitized, untrusted note snippets. Treated strictly as data. */
  notes: string[];
  tasks: AiTaskSnapshot[];
}

export interface AiSummaryOutput {
  summaryText: string;
  risk: RiskSignal[];
  model: string;
  promptVersion: string;
}

export interface AiProvider {
  readonly model: string;
  readonly promptVersion: string;
  summarize(input: AiSummaryInput): Promise<AiSummaryOutput>;
}
