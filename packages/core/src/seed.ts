// Deterministic demo seed for local development and the runnable web demo.
// Populates one Workspace org: an admin, a manager, two employees, a workflow
// template + instance, a spread of tasks across every status, and evidence.
// Writes go straight through repositories (setup, not user actions).

import type { Evidence, Task, User, WorkflowInstance, WorkflowStage, WorkflowTemplate } from './domain/entities';
import type { Priority, TaskStatus, WaitingReason } from './domain/enums';
import { newId } from './domain/ids';
import type { Repositories } from './repositories/interfaces';

const SYSTEM = 'system';

function iso(offsetMs = 0): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

function makeUser(
  email: string,
  displayName: string,
  role: User['role'],
  managerUserId?: string,
  department?: string,
): User {
  const now = iso();
  const u: User = {
    id: newId('user'),
    email,
    displayName,
    role,
    status: 'Active',
    createdAt: now,
    createdBy: SYSTEM,
    updatedAt: now,
    updatedBy: SYSTEM,
  };
  if (managerUserId) u.managerUserId = managerUserId;
  if (department) u.department = department;
  return u;
}

export interface SeededOrg {
  admin: User;
  manager: User;
  employees: User[];
  template: WorkflowTemplate;
  instance: WorkflowInstance;
  tasks: Task[];
}

export async function seedDemoOrg(repos: Repositories): Promise<SeededOrg> {
  const admin = makeUser('admin@example.com', 'Avery Admin', 'Admin', undefined, 'Operations');
  const manager = makeUser('manager@example.com', 'Morgan Manager', 'Manager', undefined, 'Operations');
  const priya = makeUser('priya@example.com', 'Priya Patel', 'Employee', manager.id, 'Field QC');
  const sam = makeUser('sam@example.com', 'Sam Okoro', 'Employee', manager.id, 'Field QC');

  for (const u of [admin, manager, priya, sam]) await repos.users.create(u);

  // Workflow template + stages.
  const template: WorkflowTemplate = {
    id: newId('workflowTemplate'),
    name: 'Carbon Verification Response',
    description: 'Standard response process for a carbon verification finding.',
    ownerUserId: manager.id,
    status: 'Active',
    version: 1,
    slaHours: 72,
    createdAt: iso(),
    createdBy: manager.id,
    updatedAt: iso(),
    updatedBy: manager.id,
  };
  await repos.workflowTemplates.create(template);

  const stageNames = ['Intake', 'Evidence Gathering', 'Country Response', 'Final Review'];
  const stages: WorkflowStage[] = [];
  for (let i = 0; i < stageNames.length; i += 1) {
    const stage: WorkflowStage = {
      id: newId('workflowStage'),
      workflowTemplateId: template.id,
      name: stageNames[i]!,
      order: i + 1,
      defaultAssigneeRole: i === stageNames.length - 1 ? 'Manager' : 'Employee',
      slaHours: 24,
      status: 'Active',
    };
    stages.push(stage);
    await repos.workflowStages.create(stage);
  }

  const instance: WorkflowInstance = {
    id: newId('workflowInstance'),
    workflowTemplateId: template.id,
    name: 'June 2026 verification finding #18',
    status: 'Active',
    ownerUserId: manager.id,
    currentStageId: stages[1]!.id,
    startedAt: iso(-2 * DAY),
    dueAt: iso(2 * DAY),
    createdAt: iso(-2 * DAY),
    createdBy: manager.id,
    updatedAt: iso(-1 * DAY),
    updatedBy: manager.id,
  };
  await repos.workflowInstances.create(instance);

  // Tasks spanning every meaningful status.
  type Spec = {
    title: string;
    assignee: User;
    status: TaskStatus;
    priority: Priority;
    dueOffset?: number;
    waitingReason?: WaitingReason;
    completionComment?: string;
    inWorkflow?: boolean;
    stageIndex?: number;
    addEvidence?: boolean;
  };

  const specs: Spec[] = [
    { title: 'Review verification finding #18 intake', assignee: priya, status: 'In Progress', priority: 'High', dueOffset: 1 * DAY, inWorkflow: true, stageIndex: 0 },
    { title: 'Gather meter logs for site GH-204', assignee: priya, status: 'Waiting External', priority: 'High', dueOffset: -1 * DAY, waitingReason: 'Country Response', inWorkflow: true, stageIndex: 2 },
    { title: 'Upload corrected distribution sheet', assignee: sam, status: 'Assigned', priority: 'Normal', dueOffset: 2 * DAY, inWorkflow: true, stageIndex: 1 },
    { title: 'Draft response narrative section 4', assignee: sam, status: 'Review', priority: 'Normal', dueOffset: 1 * DAY, inWorkflow: true, stageIndex: 3 },
    { title: 'Close out finding #11 documentation', assignee: priya, status: 'Completed', priority: 'Normal', dueOffset: -2 * DAY, completionComment: 'Submitted final pack to auditor.', addEvidence: true },
    { title: 'Confirm site visit schedule with vendor', assignee: sam, status: 'Waiting Internal', priority: 'Low', waitingReason: 'Manager Approval' },
    { title: 'Triage new inbox item from auditor email', assignee: priya, status: 'Inbox', priority: 'Normal' },
  ];

  const tasks: Task[] = [];
  for (const spec of specs) {
    const now = iso();
    const task: Task = {
      id: newId('task'),
      title: spec.title,
      assigneeUserId: spec.assignee.id,
      managerUserId: manager.id,
      status: spec.status,
      priority: spec.priority,
      createdAt: iso(-3 * DAY),
      createdBy: manager.id,
      updatedAt: now,
      updatedBy: spec.assignee.id,
    };
    if (spec.dueOffset !== undefined) task.dueAt = iso(spec.dueOffset);
    if (spec.waitingReason) task.waitingReason = spec.waitingReason;
    if (spec.completionComment) task.completionComment = spec.completionComment;
    if (spec.status === 'Completed') task.completedAt = iso(-6 * HOUR);
    if (spec.inWorkflow) {
      task.workflowInstanceId = instance.id;
      if (spec.stageIndex !== undefined) task.stageId = stages[spec.stageIndex]!.id;
    }
    await repos.tasks.create(task);
    tasks.push(task);

    await repos.activity.append({
      id: newId('activity'),
      actorUserId: manager.id,
      entityType: 'Task',
      entityId: task.id,
      action: 'TaskCreated',
      occurredAt: task.createdAt,
      requestId: 'seed',
      metadataJson: JSON.stringify({ seeded: true }),
    });

    if (spec.addEvidence) {
      const evidence: Evidence = {
        id: newId('evidence'),
        taskId: task.id,
        type: 'Link',
        title: 'Auditor submission confirmation',
        uri: 'https://example.com/audit/finding-11',
        notes: 'Confirmation email archived in Drive.',
        provider: 'Drive',
        createdAt: iso(-6 * HOUR),
        createdBy: spec.assignee.id,
      };
      await repos.evidence.create(evidence);
      await repos.activity.append({
        id: newId('activity'),
        actorUserId: spec.assignee.id,
        entityType: 'Evidence',
        entityId: evidence.id,
        action: 'EvidenceAdded',
        occurredAt: evidence.createdAt,
        requestId: 'seed',
      });
    }
  }

  return { admin, manager, employees: [priya, sam], template, instance, tasks };
}
