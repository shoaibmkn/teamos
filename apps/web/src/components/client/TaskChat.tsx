'use client';

import { useState } from 'react';
import { relTime } from '../format';
import { postJson } from './api';

export interface ChatMessage {
  id: string;
  authorUserId: string;
  text: string;
  createdAt: string;
}

export function TaskChat({
  taskId,
  initial,
  names,
  selfId,
}: {
  taskId: string;
  initial: ChatMessage[];
  names: Record<string, string>;
  selfId: string;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setPending(true);
    const res = await postJson<{ message: ChatMessage }>(`/api/tasks/${taskId}/messages`, { text: text.trim() });
    if (res.ok && res.data) {
      setMessages((prev) => [...prev, res.data!.message]);
      setText('');
    }
    setPending(false);
  }

  const nameOf = (id: string) => names[id] ?? 'Someone';

  return (
    <div>
      <div className="mb-3 flex max-h-72 flex-col gap-2.5 overflow-y-auto">
        {messages.length === 0 ? (
          <p className="text-sm muted">No messages yet. Start the conversation on this task.</p>
        ) : (
          messages.map((m) => {
            const mine = m.authorUserId === selfId;
            return (
              <div key={m.id} className={`max-w-[85%] ${mine ? 'self-end' : 'self-start'}`}>
                {!mine ? <div className="mb-0.5 text-xs muted">{nameOf(m.authorUserId)}</div> : null}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm ${mine ? 'bg-brand-600 text-white' : ''}`}
                  style={mine ? undefined : { backgroundColor: 'rgb(var(--surface-2))' }}
                >
                  {m.text}
                </div>
                <div className={`mt-0.5 text-[11px] muted ${mine ? 'text-right' : ''}`}>{relTime(m.createdAt)}</div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={send} className="flex gap-2">
        <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder="Message on this task…" />
        <button type="submit" className="btn-primary shrink-0" disabled={pending || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
