'use client';

import { useState } from 'react';
import { patchJson, postJson } from './api';

export interface ChecklistItem {
  id: string;
  title: string;
  done: boolean;
  order: number;
}

export function Checklist({ taskId, initial }: { taskId: string; initial: ChecklistItem[] }) {
  const [items, setItems] = useState<ChecklistItem[]>(initial);
  const [title, setTitle] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setPending(true);
    setError(null);
    const res = await postJson<{ subtask: ChecklistItem }>(`/api/tasks/${taskId}/subtasks`, { title: title.trim() });
    if (res.ok && res.data) {
      setItems((prev) => [...prev, res.data!.subtask]);
      setTitle('');
    } else {
      setError(res.error?.message ?? 'Could not add.');
    }
    setPending(false);
  }

  async function toggle(id: string, next: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: next } : i)));
    const res = await patchJson(`/api/tasks/${taskId}/subtasks/${id}`, { done: next });
    if (!res.ok) setItems((prev) => prev.map((i) => (i.id === id ? { ...i, done: !next } : i)));
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-sm">
        <span className="font-medium">
          Checklist <span className="muted">· {done}/{items.length}</span>
        </span>
        <span className="text-xs muted">{pct}%</span>
      </div>
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgb(var(--surface-2))' }}>
        <div className="h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>

      <ul className="mb-3 space-y-1">
        {items.map((i) => (
          <li key={i.id}>
            <label className="flex cursor-pointer items-center gap-2.5 py-1 text-sm">
              <input
                type="checkbox"
                checked={i.done}
                onChange={(e) => toggle(i.id, e.target.checked)}
                className="h-4 w-4 rounded accent-brand-600"
              />
              <span className={i.done ? 'muted line-through' : ''}>{i.title}</span>
            </label>
          </li>
        ))}
      </ul>

      <form onSubmit={add} className="flex gap-2">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a checklist item…" />
        <button type="submit" className="btn-ghost shrink-0" disabled={pending || !title.trim()}>
          Add
        </button>
      </form>
      {error ? <div className="mt-1 text-xs text-red-500">{error}</div> : null}
    </div>
  );
}
