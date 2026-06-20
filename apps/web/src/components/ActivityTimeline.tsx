import type { Activity } from '@teamos/core';
import { EmptyState } from './ui';
import { relTime } from './format';

const ACTION_LABEL: Record<string, string> = {
  TaskCreated: 'created the task',
  TaskStatusChanged: 'changed status',
  EvidenceAdded: 'added evidence',
  WorkflowTemplateCreated: 'created a template',
  WorkflowInstanceStarted: 'started the workflow',
  SummaryGenerated: 'generated an AI summary',
};

function describe(activity: Activity): string {
  const base = ACTION_LABEL[activity.action] ?? activity.action;
  if (activity.action === 'TaskStatusChanged' && activity.metadataJson) {
    try {
      const meta = JSON.parse(activity.metadataJson) as { from?: string; to?: string };
      if (meta.from && meta.to) return `changed status: ${meta.from} → ${meta.to}`;
    } catch {
      /* ignore */
    }
  }
  return base;
}

export function ActivityTimeline({
  activity,
  nameOf,
}: {
  activity: Activity[];
  nameOf?: (userId: string) => string;
}) {
  if (activity.length === 0) return <EmptyState>No activity yet.</EmptyState>;

  return (
    <ol className="relative space-y-4 pl-4">
      <span className="absolute left-1 top-1 h-[calc(100%-0.5rem)] w-px" style={{ backgroundColor: 'rgb(var(--border))' }} />
      {activity.map((a) => (
        <li key={a.id} className="relative">
          <span className="absolute -left-3 top-1.5 h-2 w-2 rounded-full bg-brand-500" />
          <div className="text-sm">
            <span className="font-medium">{nameOf ? nameOf(a.actorUserId) : a.actorUserId}</span>{' '}
            <span className="muted">{describe(a)}</span>
          </div>
          <div className="text-xs muted">{relTime(a.occurredAt)}</div>
        </li>
      ))}
    </ol>
  );
}
