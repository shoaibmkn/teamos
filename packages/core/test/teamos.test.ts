import { beforeEach, describe, expect, it } from 'vitest';
import {
  createInMemoryRepositories,
  createServices,
  newId,
  OfflineAiProvider,
  type Repositories,
  type RequestContext,
  type Services,
  type User,
} from '../src/index';

const FIXED_NOW = new Date('2026-06-20T12:00:00.000Z');
const clock = () => FIXED_NOW;

function makeUser(role: User['role'], email: string, managerUserId?: string): User {
  const now = FIXED_NOW.toISOString();
  const u: User = {
    id: newId('user'),
    email,
    displayName: email.split('@')[0]!,
    role,
    status: 'Active',
    createdAt: now,
    createdBy: 'system',
    updatedAt: now,
    updatedBy: 'system',
  };
  if (managerUserId) u.managerUserId = managerUserId;
  return u;
}

function ctx(actor: User): RequestContext {
  return { actor, requestId: 'req_test' };
}

interface Harness {
  repos: Repositories;
  services: Services;
  admin: User;
  manager: User;
  priya: User;
  sam: User;
}

async function setup(): Promise<Harness> {
  const repos = createInMemoryRepositories();
  const services = createServices({
    repos,
    ai: new OfflineAiProvider(),
    config: { allowedDomains: ['example.com'] },
    clock,
  });
  const admin = makeUser('Admin', 'admin@example.com');
  const manager = makeUser('Manager', 'manager@example.com');
  const priya = makeUser('Employee', 'priya@example.com', manager.id);
  const sam = makeUser('Employee', 'sam@example.com', manager.id);
  for (const u of [admin, manager, priya, sam]) await repos.users.create(u);
  return { repos, services, admin, manager, priya, sam };
}

describe('authentication & identity', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it('resolves an active Workspace user by email', async () => {
    const u = await h.services.users.resolveActiveByEmail('priya@example.com');
    expect(u.id).toBe(h.priya.id);
  });

  it('rejects an email outside the allowed domain', async () => {
    await expect(h.services.users.resolveActiveByEmail('intruder@evil.com')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
  });

  it('denies an archived user access', async () => {
    await h.repos.users.update(h.sam.id, { status: 'Archived' });
    await expect(h.services.users.resolveActiveByEmail('sam@example.com')).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns role permissions from /me', () => {
    const me = h.services.users.me(ctx(h.priya));
    expect(me.permissions).toContain('task:update:self');
    expect(me.permissions).not.toContain('task:read:team');
  });
});

describe('RBAC', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it('blocks an employee from the manager dashboard', async () => {
    await expect(h.services.dashboards.manager(ctx(h.priya))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks an employee from creating tasks', async () => {
    await expect(
      h.services.tasks.create(ctx(h.priya), { title: 'x', assigneeUserId: h.sam.id }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks an employee from the executive dashboard', async () => {
    await expect(h.services.dashboards.executive(ctx(h.priya))).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(h.services.dashboards.executive(ctx(h.manager))).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('prevents an employee from updating another employee task', async () => {
    const task = await h.services.tasks.create(ctx(h.manager), {
      title: 'Sam task',
      assigneeUserId: h.sam.id,
    });
    await expect(
      h.services.tasks.updateStatus(ctx(h.priya), task.id, { status: 'In Progress' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('lets a manager read team tasks but scopes out other teams', async () => {
    const otherManager = makeUser('Manager', 'other@example.com');
    await h.repos.users.create(otherManager);
    const ext = makeUser('Employee', 'ext@example.com', otherManager.id);
    await h.repos.users.create(ext);
    await h.services.tasks.create(ctx(h.manager), { title: 'mine', assigneeUserId: h.priya.id });
    await h.services.tasks.create(ctx(otherManager), { title: 'theirs', assigneeUserId: ext.id });

    const page = await h.services.tasks.list(ctx(h.manager));
    expect(page.items.every((t) => t.managerUserId === h.manager.id)).toBe(true);
    expect(page.items.some((t) => t.title === 'theirs')).toBe(false);
  });
});

describe('task completion & waiting rules', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  async function priyaTask() {
    return h.services.tasks.create(ctx(h.manager), { title: 'do work', assigneeUserId: h.priya.id });
  }

  it('rejects completion without evidence or comment', async () => {
    const task = await priyaTask();
    await expect(
      h.services.tasks.updateStatus(ctx(h.priya), task.id, { status: 'Completed' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('allows completion with a completion comment', async () => {
    const task = await priyaTask();
    const res = await h.services.tasks.updateStatus(ctx(h.priya), task.id, {
      status: 'Completed',
      completionComment: 'Finished and emailed the client.',
    });
    expect(res.task.status).toBe('Completed');
    expect(res.task.completedAt).toBeTruthy();
  });

  it('allows completion when evidence exists', async () => {
    const task = await priyaTask();
    await h.services.evidence.add(ctx(h.priya), task.id, {
      type: 'Link',
      title: 'proof',
      uri: 'https://example.com/proof',
    });
    const res = await h.services.tasks.updateStatus(ctx(h.priya), task.id, { status: 'Completed' });
    expect(res.task.status).toBe('Completed');
  });

  it('requires a waiting reason for waiting statuses', async () => {
    const task = await priyaTask();
    await expect(
      h.services.tasks.updateStatus(ctx(h.priya), task.id, { status: 'Waiting External' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });

    const ok = await h.services.tasks.updateStatus(ctx(h.priya), task.id, {
      status: 'Waiting External',
      waitingReason: 'Country Response',
    });
    expect(ok.task.waitingReason).toBe('Country Response');
  });

  it('appends an immutable activity entry on each status change', async () => {
    const task = await priyaTask();
    await h.services.tasks.updateStatus(ctx(h.priya), task.id, { status: 'In Progress' });
    const activity = await h.services.tasks.getActivity(ctx(h.priya), task.id);
    const actions = activity.map((a) => a.action);
    expect(actions).toContain('TaskCreated');
    expect(actions).toContain('TaskStatusChanged');
  });
});

describe('evidence immutability & no hard delete', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it('stores evidence as immutable (no update path on the repository)', async () => {
    // The interface exposes no update/delete; assert the methods are absent.
    const repo = h.repos.evidence as unknown as Record<string, unknown>;
    expect(repo.update).toBeUndefined();
    expect(repo.delete).toBeUndefined();
  });

  it('freezes an archived task against modification', async () => {
    const task = await h.services.tasks.create(ctx(h.manager), { title: 'x', assigneeUserId: h.priya.id });
    await h.repos.tasks.update(task.id, { archivedAt: FIXED_NOW.toISOString() });
    await expect(
      h.services.tasks.updateStatus(ctx(h.priya), task.id, { status: 'In Progress' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('requires a valid http(s) URI for link evidence', async () => {
    const task = await h.services.tasks.create(ctx(h.manager), { title: 'x', assigneeUserId: h.priya.id });
    await expect(
      h.services.evidence.add(ctx(h.priya), task.id, { type: 'Link', title: 'bad', uri: 'not-a-url' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });
});

describe('AI advisory boundary (ADR-0003)', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it('lets an employee summarize only themselves', async () => {
    const res = await h.services.ai.generateSummary(ctx(h.priya), {
      scopeType: 'Employee',
      scopeId: h.priya.id,
      periodStart: '2026-06-01',
      periodEnd: '2026-06-20',
    });
    expect(res.summary.summaryText).toContain('advisory');
    await expect(
      h.services.ai.generateSummary(ctx(h.priya), {
        scopeType: 'Employee',
        scopeId: h.sam.id,
        periodStart: '2026-06-01',
        periodEnd: '2026-06-20',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('blocks a manager from executive summaries', async () => {
    await expect(
      h.services.ai.generateSummary(ctx(h.manager), {
        scopeType: 'Executive',
        periodStart: '2026-06-01',
        periodEnd: '2026-06-20',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('does not mutate source records when generating a summary', async () => {
    const task = await h.services.tasks.create(ctx(h.manager), {
      title: 'measure me',
      assigneeUserId: h.priya.id,
    });
    const before = await h.repos.tasks.getById(task.id);

    await h.services.ai.generateSummary(ctx(h.admin), {
      scopeType: 'Executive',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-20',
    });

    const after = await h.repos.tasks.getById(task.id);
    expect(after).toEqual(before);
    const summaries = await h.repos.summaries.list({ scopeType: 'Executive' });
    expect(summaries.length).toBe(1);
  });

  it('produces deterministic risk for overdue work', async () => {
    const provider = new OfflineAiProvider();
    const out = await provider.summarize({
      scopeType: 'Manager',
      scopeLabel: 'Team',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-20',
      metrics: { total: 5, completed: 1, overdue: 3, waiting: 1, evidenceGaps: 0, blocked: 1 },
      notes: [],
      tasks: [],
    });
    const overdue = out.risk.find((r) => r.kind === 'overdue');
    expect(overdue?.severity).toBe('high');
  });
});

describe('workflows & dashboards', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  it('starts an instance from a template and assembles detail', async () => {
    const { template } = await h.services.workflows.createTemplate(ctx(h.manager), {
      name: 'Onboarding',
      stages: [{ name: 'Intake' }, { name: 'Review' }],
    });
    const instance = await h.services.workflows.startInstance(ctx(h.manager), {
      workflowTemplateId: template.id,
      name: 'June onboarding',
    });
    await h.services.tasks.create(ctx(h.manager), {
      title: 'first task',
      assigneeUserId: h.priya.id,
      workflowInstanceId: instance.id,
    });

    const detail = await h.services.workflows.getInstance(ctx(h.manager), instance.id);
    expect(detail.stages.length).toBe(2);
    expect(detail.tasks.length).toBe(1);
    expect(detail.instance.currentStageId).toBe(detail.stages[0]!.id);
  });

  it('computes employee dashboard buckets', async () => {
    const t1 = await h.services.tasks.create(ctx(h.manager), { title: 'a', assigneeUserId: h.priya.id });
    await h.services.tasks.updateStatus(ctx(h.priya), t1.id, {
      status: 'Waiting External',
      waitingReason: 'Vendor Response',
    });
    const dash = await h.services.dashboards.employee(ctx(h.priya));
    expect(dash.waiting.length).toBe(1);
    expect(dash.metrics.total).toBe(1);
  });
});

describe('task 360: subtasks & chat', () => {
  let h: Harness;
  beforeEach(async () => {
    h = await setup();
  });

  async function priyaTask() {
    return h.services.tasks.create(ctx(h.manager), { title: 'with subtasks', assigneeUserId: h.priya.id });
  }

  it('adds and toggles checklist items', async () => {
    const task = await priyaTask();
    const a = await h.services.subtasks.add(ctx(h.priya), task.id, { title: 'step one' });
    await h.services.subtasks.add(ctx(h.priya), task.id, { title: 'step two' });
    expect(a.order).toBe(1);
    expect(a.done).toBe(false);

    await h.services.subtasks.setDone(ctx(h.priya), task.id, a.id, true);
    const list = await h.services.subtasks.list(ctx(h.priya), task.id);
    expect(list.length).toBe(2);
    expect(list.filter((s) => s.done).length).toBe(1);
  });

  it('blocks an employee from another employee task checklist', async () => {
    const task = await priyaTask();
    await expect(
      h.services.subtasks.add(ctx(h.sam), task.id, { title: 'sneaky' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('posts and lists task chat messages', async () => {
    const task = await priyaTask();
    await h.services.messages.post(ctx(h.manager), task.id, { text: 'Any update?' });
    await h.services.messages.post(ctx(h.priya), task.id, { text: 'Almost done.' });
    const msgs = await h.services.messages.list(ctx(h.priya), task.id);
    expect(msgs.map((m) => m.text)).toEqual(['Any update?', 'Almost done.']);
    expect(msgs[0]!.authorUserId).toBe(h.manager.id);
  });

  it('blocks chat access outside task scope', async () => {
    const task = await priyaTask();
    await expect(
      h.services.messages.post(ctx(h.sam), task.id, { text: 'hi' }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
