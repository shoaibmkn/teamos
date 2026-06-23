// ID strategy: stable string prefixes per entity (database-design.md).
// IDs are opaque, sortable-ish (time component first), and collision-resistant
// enough for MVP scale without external dependencies.

export const ID_PREFIXES = {
  user: 'usr',
  workflowTemplate: 'wft',
  workflowInstance: 'wfi',
  workflowStage: 'stg',
  task: 'tsk',
  activity: 'act',
  evidence: 'evd',
  summary: 'sum',
  subtask: 'sub',
  taskMessage: 'msg',
  dayLog: 'day',
  notification: 'ntf',
} as const;

/** Entity kind keys, e.g. 'user', 'task'. */
export type IdKind = keyof typeof ID_PREFIXES;
/** Prefix values, e.g. 'usr', 'tsk'. */
export type IdPrefix = (typeof ID_PREFIXES)[IdKind];

let monotonic = 0;

export function newId(kind: IdKind): string {
  const prefix = ID_PREFIXES[kind];
  monotonic = (monotonic + 1) % 0xffffff;
  const time = Date.now().toString(36);
  const seq = monotonic.toString(36).padStart(4, '0');
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${time}${seq}${rand}`;
}

export function hasPrefix(id: unknown, prefix: IdPrefix): id is string {
  return typeof id === 'string' && id.startsWith(`${prefix}_`) && id.length > prefix.length + 1;
}
