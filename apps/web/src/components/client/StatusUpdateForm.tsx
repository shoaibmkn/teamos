'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { TaskStatuses, WaitingReasons, type TaskStatus, type WaitingReason } from '@teamos/core';
import { patchJson } from './api';

const WAITING: TaskStatus[] = ['Waiting Internal', 'Waiting External'];

export function StatusUpdateForm({
  taskId,
  currentStatus,
  currentWaitingReason,
  hasEvidence,
}: {
  taskId: string;
  currentStatus: TaskStatus;
  currentWaitingReason?: WaitingReason;
  hasEvidence: boolean;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<TaskStatus>(currentStatus);
  const [waitingReason, setWaitingReason] = useState<WaitingReason | ''>(currentWaitingReason ?? '');
  const [completionComment, setCompletionComment] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isWaiting = WAITING.includes(status);
  const isCompleting = status === 'Completed';
  const needsCompletionInput = isCompleting && !hasEvidence;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body: Record<string, unknown> = { status };
    if (isWaiting) body.waitingReason = waitingReason || undefined;
    if (completionComment.trim()) body.completionComment = completionComment.trim();

    const res = await patchJson(`/api/tasks/${taskId}/status`, body);
    if (res.ok) {
      setCompletionComment('');
      router.refresh();
    } else {
      setError(res.error?.message ?? 'Update failed.');
    }
    setPending(false);
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Status</label>
        <select className="input" value={status} onChange={(e) => setStatus(e.target.value as TaskStatus)}>
          {TaskStatuses.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {isWaiting ? (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Waiting reason</label>
          <select
            className="input"
            value={waitingReason}
            onChange={(e) => setWaitingReason(e.target.value as WaitingReason)}
          >
            <option value="">Select a reason…</option>
            {WaitingReasons.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {isCompleting ? (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">
            Completion comment {needsCompletionInput ? <span className="text-red-400">(required — no evidence yet)</span> : '(optional)'}
          </label>
          <textarea
            className="input min-h-[72px]"
            placeholder="What was completed?"
            value={completionComment}
            onChange={(e) => setCompletionComment(e.target.value)}
          />
          <p className="mt-1 text-xs muted">
            {hasEvidence
              ? 'Evidence is attached — completion is allowed.'
              : 'Completion requires evidence or a completion comment.'}
          </p>
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      <button type="submit" className="btn-primary w-full" disabled={pending}>
        {pending ? 'Saving…' : 'Update status'}
      </button>
    </form>
  );
}
