// JSON-file persistence snapshot. The whole dataset lives in one file on a
// Docker volume. Small-team scale; single Node process, so in-memory state +
// atomic write-through is sufficient and robust.

import 'server-only';
import { promises as fs } from 'node:fs';
import { dirname } from 'node:path';
import type {
  Activity,
  DayLog,
  Evidence,
  Notification,
  Subtask,
  Summary,
  Task,
  TaskMessage,
  User,
  WorkflowInstance,
  WorkflowStage,
  WorkflowTemplate,
} from '@teamos/core';

export interface Snapshot {
  users: User[];
  workflowTemplates: WorkflowTemplate[];
  workflowStages: WorkflowStage[];
  workflowInstances: WorkflowInstance[];
  tasks: Task[];
  evidence: Evidence[];
  activity: Activity[];
  summaries: Summary[];
  subtasks: Subtask[];
  taskMessages: TaskMessage[];
  dayLogs: DayLog[];
  notifications: Notification[];
}

export function emptySnapshot(): Snapshot {
  return {
    users: [],
    workflowTemplates: [],
    workflowStages: [],
    workflowInstances: [],
    tasks: [],
    evidence: [],
    activity: [],
    summaries: [],
    subtasks: [],
    taskMessages: [],
    dayLogs: [],
    notifications: [],
  };
}

export async function loadSnapshot(path: string): Promise<Snapshot> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return { ...emptySnapshot(), ...(JSON.parse(raw) as Partial<Snapshot>) };
  } catch {
    return emptySnapshot();
  }
}

/** Serialize writes so concurrent saves never interleave; atomic via rename. */
export function createSaver(path: string, snapshot: Snapshot): () => Promise<void> {
  let chain: Promise<void> = Promise.resolve();
  return () => {
    chain = chain.then(async () => {
      await fs.mkdir(dirname(path), { recursive: true });
      const tmp = `${path}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(snapshot), 'utf8');
      await fs.rename(tmp, path);
    });
    return chain;
  };
}
