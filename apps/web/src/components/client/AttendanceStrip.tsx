'use client';

import { useEffect, useState } from 'react';
import { fmtTime } from '../format';
import { getJson } from './api';

interface Entry {
  user: { id: string; displayName: string; role: string };
  log: { checkInAt: string; checkOutAt?: string } | null;
  onClock: boolean;
}

export function AttendanceStrip() {
  const [team, setTeam] = useState<Entry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getJson<{ team: Entry[] }>('/api/attendance/team').then((res) => {
      if (res.ok && res.data) setTeam(res.data.team);
      setLoaded(true);
    });
  }, []);

  const onClock = team.filter((e) => e.onClock).length;
  const checkedIn = team.filter((e) => e.log).length;

  return (
    <section className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide muted">Today&apos;s attendance</h2>
        <span className="text-xs muted">{onClock} on the clock · {checkedIn}/{team.length} checked in</span>
      </div>
      {!loaded ? (
        <div className="text-sm muted">Loading…</div>
      ) : team.length === 0 ? (
        <div className="text-sm muted">No team members yet.</div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {team.map((e) => (
            <div
              key={e.user.id}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm"
              style={{ borderColor: 'rgb(var(--border))' }}
              title={
                e.log
                  ? `In ${fmtTime(e.log.checkInAt)}${e.log.checkOutAt ? ` · Out ${fmtTime(e.log.checkOutAt)}` : ''}`
                  : 'Not checked in'
              }
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: e.onClock ? '#10b981' : e.log ? '#94a3b8' : 'rgb(var(--border))' }}
                aria-hidden
              />
              <span className="font-medium">{e.user.displayName}</span>
              <span className="text-xs muted">
                {e.log ? (e.onClock ? `in ${fmtTime(e.log.checkInAt)}` : 'done') : 'not in'}
              </span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
