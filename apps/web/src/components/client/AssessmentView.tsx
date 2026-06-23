'use client';

import { useEffect, useState } from 'react';
import type { EmployeeAssessment } from '@teamos/core';
import { getJson } from './api';

interface Member {
  id: string;
  displayName: string;
}

function Kpi({ label, value, suffix }: { label: string; value: number | string; suffix?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold">
        {value}
        {suffix ? <span className="text-sm muted"> {suffix}</span> : null}
      </div>
    </div>
  );
}

export function AssessmentView({ team }: { team: Member[] }) {
  const [userId, setUserId] = useState(team[0]?.id ?? '');
  const [months, setMonths] = useState(6);
  const [data, setData] = useState<EmployeeAssessment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    getJson<{ assessment: EmployeeAssessment }>(`/api/assessments/${userId}?months=${months}`).then((res) => {
      if (res.ok && res.data) setData(res.data.assessment);
      else setError(res.error?.message ?? 'Could not load assessment.');
      setLoading(false);
    });
  }, [userId, months]);

  const maxRate = Math.max(1, ...(data?.monthly.map((m) => m.rate) ?? [1]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <select className="input max-w-xs" value={userId} onChange={(e) => setUserId(e.target.value)}>
          {team.map((m) => (
            <option key={m.id} value={m.id}>
              {m.displayName}
            </option>
          ))}
        </select>
        <select className="input max-w-[10rem]" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
          <option value={3}>Last 3 months</option>
          <option value={6}>Last 6 months</option>
          <option value={12}>Last 12 months</option>
        </select>
        <a className="btn-primary ml-auto" href={`/api/assessments/${userId}/export?months=${months}`}>
          Export CSV
        </a>
      </div>

      {error ? <div className="text-sm text-red-500">{error}</div> : null}
      {loading || !data ? (
        <div className="text-sm muted">Loading…</div>
      ) : (
        <>
          <div className="text-sm muted">
            {data.user.displayName} · {data.periodStart} to {data.periodEnd}
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Completion" value={data.completionRate} suffix="%" />
            <Kpi label="On-time finish" value={data.onTimeRate} suffix="%" />
            <Kpi label="Evidence rate" value={data.evidenceRate} suffix="%" />
            <Kpi label="Tasks completed" value={data.completed} />
            <Kpi label="Avg cycle" value={data.avgCycleDays} suffix="days" />
            <Kpi label="Currently overdue" value={data.overdue} />
          </div>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide muted">On-time delivery · monthly</h2>
            <div className="flex h-36 items-end gap-2">
              {data.monthly.map((m) => (
                <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
                  <span className="text-[11px] muted">{m.rate}%</span>
                  <div
                    className="w-full rounded-t bg-brand-500"
                    style={{ height: `${(m.rate / maxRate) * 100}%`, minHeight: '4px' }}
                    title={`${m.month}: ${m.onTime}/${m.completed} on time`}
                  />
                  <span className="text-[10px] muted">{m.month.slice(5)}</span>
                </div>
              ))}
            </div>
          </section>

          {Object.keys(data.waitingReasons).length > 0 ? (
            <section className="card p-4">
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide muted">Waiting reasons</h2>
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.waitingReasons).map(([reason, count]) => (
                  <span key={reason} className="badge bg-amber-500/15 text-amber-600 dark:text-amber-300">
                    {reason}: {count}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
