'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Priorities, type Priority } from '@teamos/core';
import { postJson } from './api';

interface TeamMember {
  id: string;
  displayName: string;
}

export function CreateTaskForm({ team }: { team: TeamMember[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [assigneeUserId, setAssigneeUserId] = useState(team[0]?.id ?? '');
  const [priority, setPriority] = useState<Priority>('Normal');
  const [due, setDue] = useState('');
  const [description, setDescription] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitle('');
    setPriority('Normal');
    setDue('');
    setDescription('');
    setError(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    const body: Record<string, unknown> = { title, assigneeUserId, priority };
    if (due) body.dueAt = new Date(`${due}T17:00:00`).toISOString();
    if (description.trim()) body.description = description.trim();

    const res = await postJson('/api/tasks', body);
    if (res.ok) {
      reset();
      setOpen(false);
      router.refresh();
    } else {
      setError(res.error?.message ?? 'Could not create task.');
    }
    setPending(false);
  }

  if (!open) {
    return (
      <button type="button" className="btn-primary" onClick={() => setOpen(true)} disabled={team.length === 0}>
        + New task
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="card w-full max-w-lg space-y-3 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Assign a new task</h3>
        <button type="button" className="text-sm muted hover:underline" onClick={() => setOpen(false)}>
          Close
        </button>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Title</label>
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Assignee</label>
          <select className="input" value={assigneeUserId} onChange={(e) => setAssigneeUserId(e.target.value)}>
            {team.map((m) => (
              <option key={m.id} value={m.id}>
                {m.displayName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Priority</label>
          <select className="input" value={priority} onChange={(e) => setPriority(e.target.value as Priority)}>
            {Priorities.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Due date (optional)</label>
        <input type="date" className="input" value={due} onChange={(e) => setDue(e.target.value)} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide muted">Notes (optional)</label>
        <textarea className="input min-h-[60px]" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      {error ? <div className="text-sm text-red-500">{error}</div> : null}

      <button type="submit" className="btn-primary w-full" disabled={pending || !title.trim() || !assigneeUserId}>
        {pending ? 'Assigning…' : 'Assign task'}
      </button>
    </form>
  );
}
