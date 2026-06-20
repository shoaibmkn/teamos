'use client';

import { useState } from 'react';
import type { RiskSignal, SummaryScope } from '@teamos/core';
import { postJson } from './api';
import { riskClass } from '../format';

interface GeneratedSummary {
  summary: { summaryText: string; model: string; promptVersion: string; createdAt: string };
  risk: RiskSignal[];
}

export function AiSummaryPanel({
  scopeType,
  scopeId,
  periodStart,
  periodEnd,
  aiMode,
  initialText,
  initialRisk,
}: {
  scopeType: SummaryScope;
  scopeId?: string;
  periodStart: string;
  periodEnd: string;
  aiMode: 'gemini' | 'offline';
  initialText?: string;
  initialRisk?: RiskSignal[];
}) {
  const [text, setText] = useState<string | undefined>(initialText);
  const [risk, setRisk] = useState<RiskSignal[]>(initialRisk ?? []);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setPending(true);
    setError(null);
    const body: Record<string, unknown> = { scopeType, periodStart, periodEnd };
    if (scopeId) body.scopeId = scopeId;
    const res = await postJson<GeneratedSummary>('/api/ai/summaries', body);
    if (res.ok && res.data) {
      setText(res.data.summary.summaryText);
      setRisk(res.data.risk);
    } else {
      setError(res.error?.message ?? 'Could not generate summary.');
    }
    setPending(false);
  }

  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">AI advisory summary</h2>
          <p className="text-xs muted">
            {aiMode === 'gemini' ? 'Gemini' : 'Offline analyzer'} · advisory only, never mutates records
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={generate} disabled={pending}>
          {pending ? 'Generating…' : text ? 'Regenerate' : 'Generate'}
        </button>
      </div>

      {risk.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {risk.map((r, i) => (
            <span key={i} className={`badge border ${riskClass(r.severity)}`}>
              {r.severity.toUpperCase()} · {r.message}
            </span>
          ))}
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      {text ? (
        <pre className="whitespace-pre-wrap rounded-lg border p-3 text-sm leading-relaxed" style={{ borderColor: 'rgb(var(--border))', backgroundColor: 'rgb(var(--surface-2))' }}>
          {text}
        </pre>
      ) : !error ? (
        <p className="text-sm muted">No summary yet. Generate an advisory overview for this scope.</p>
      ) : null}
    </div>
  );
}
