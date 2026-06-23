'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { fmtTime } from '../format';
import { postJson } from './api';

export interface DayLogView {
  checkInAt: string;
  checkOutAt?: string;
  checkInNote?: string;
}

export function CheckInCard({ initial }: { initial: DayLogView | null }) {
  const router = useRouter();
  const [log, setLog] = useState<DayLogView | null>(initial);
  const [note, setNote] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkedIn = Boolean(log?.checkInAt);
  const checkedOut = Boolean(log?.checkOutAt);

  async function act(url: string) {
    setPending(true);
    setError(null);
    const res = await postJson<{ log: DayLogView }>(url, { note: note || undefined });
    if (res.ok && res.data) {
      setLog(res.data.log);
      setNote('');
      router.refresh();
    } else {
      setError(res.error?.message ?? 'Something went wrong.');
    }
    setPending(false);
  }

  if (checkedOut) {
    return (
      <div className="card flex items-center gap-3 p-4" style={{ borderLeft: '4px solid #94a3b8' }}>
        <span className="text-lg" aria-hidden>✓</span>
        <div className="text-sm">
          Day complete — checked in {fmtTime(log?.checkInAt)}, checked out {fmtTime(log?.checkOutAt)}.
        </div>
      </div>
    );
  }

  if (checkedIn) {
    return (
      <div className="card p-4" style={{ borderLeft: '4px solid #10b981' }}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden />
            On the clock since <span className="font-medium">{fmtTime(log?.checkInAt)}</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input max-w-[14rem]"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="End-of-day note (optional)"
            />
            <button type="button" className="btn-ghost shrink-0" onClick={() => act('/api/attendance/checkout')} disabled={pending}>
              {pending ? '…' : 'Check out'}
            </button>
          </div>
        </div>
        {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="card p-4" style={{ borderLeft: '4px solid #f59e0b' }}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Start your day</div>
          <div className="text-xs muted">Check in to mark the start of your working day.</div>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input max-w-[14rem]"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Today's focus (optional)"
          />
          <button type="button" className="btn-primary shrink-0" onClick={() => act('/api/attendance')} disabled={pending}>
            {pending ? '…' : 'Check in'}
          </button>
        </div>
      </div>
      {error ? <div className="mt-2 text-xs text-red-500">{error}</div> : null}
    </div>
  );
}
