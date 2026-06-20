'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { EvidenceTypes, type EvidenceType } from '@teamos/core';
import { postJson } from './api';

export function AddEvidenceForm({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<EvidenceType>('Link');
  const [title, setTitle] = useState('');
  const [uri, setUri] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsUri = type === 'Link';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body: Record<string, unknown> = { type, title };
    if (uri.trim()) body.uri = uri.trim();
    if (notes.trim()) body.notes = notes.trim();

    const res = await postJson(`/api/tasks/${taskId}/evidence`, body);
    if (res.ok) {
      setTitle('');
      setUri('');
      setNotes('');
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error?.message ?? 'Could not add evidence.');
    }
    setPending(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn-ghost w-full" onClick={() => setOpen(true)}>
        + Add evidence
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border p-3" style={{ borderColor: 'rgb(var(--border))' }}>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Type</label>
          <select className="input" value={type} onChange={(e) => setType(e.target.value as EvidenceType)}>
            {EvidenceTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Title</label>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Label" />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">
          URI {needsUri ? <span className="text-red-400">(required for links)</span> : '(optional)'}
        </label>
        <input className="input" value={uri} onChange={(e) => setUri(e.target.value)} placeholder="https://…" />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Notes (optional)</label>
        <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? 'Saving…' : 'Save evidence'}
        </button>
        <button type="button" className="btn-ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </button>
      </div>
      <p className="text-xs muted">Evidence is immutable once submitted.</p>
    </form>
  );
}
