'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { relTime } from '../format';
import { getJson, postJson } from './api';

interface Note {
  id: string;
  type: string;
  title: string;
  taskId?: string;
  read: boolean;
  createdAt: string;
}

export function NotificationBell() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await getJson<{ notifications: Note[]; unread: number }>('/api/notifications');
    if (res.ok && res.data) {
      setNotes(res.data.notifications);
      setUnread(res.data.unread);
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  async function openNote(n: Note) {
    if (!n.read) {
      await postJson('/api/notifications/read', { id: n.id });
      setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((u) => Math.max(0, u - 1));
    }
    setOpen(false);
    if (n.taskId) {
      router.push(`/task/${n.taskId}`);
      router.refresh();
    }
  }

  async function markAll() {
    await postJson('/api/notifications/read', { all: true });
    setNotes((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="btn-ghost relative h-9 w-9 p-0"
        aria-label="Notifications"
      >
        <span aria-hidden>🔔</span>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-[16px] place-items-center rounded-full bg-red-500 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          className="card absolute right-0 z-50 mt-2 w-80 overflow-hidden p-0"
          style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.18)' }}
        >
          <div className="flex items-center justify-between border-b px-3 py-2" style={{ borderColor: 'rgb(var(--border))' }}>
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 ? (
              <button type="button" className="text-xs text-brand-500 hover:underline" onClick={markAll}>
                Mark all read
              </button>
            ) : null}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notes.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm muted">No notifications yet.</div>
            ) : (
              notes.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => openNote(n)}
                  className="flex w-full items-start gap-2 border-b px-3 py-2.5 text-left transition hover:bg-[rgb(var(--surface-2))] last:border-0"
                  style={{ borderColor: 'rgb(var(--border))' }}
                >
                  <span
                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: n.read ? 'transparent' : '#6366f1' }}
                  />
                  <span className="min-w-0">
                    <span className={`block text-sm ${n.read ? 'muted' : 'font-medium'}`}>{n.title}</span>
                    <span className="block text-xs muted">{relTime(n.createdAt)}</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
