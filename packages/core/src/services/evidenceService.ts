// Evidence engine. Evidence is immutable after submission: create and read
// only. Adding evidence requires task access; archived tasks are frozen.

import type { Evidence } from '../domain/entities';
import { conflict, forbidden, notFound } from '../domain/errors';
import { newId } from '../domain/ids';
import { EvidenceProviders, EvidenceTypes, type EvidenceProvider, type EvidenceType } from '../domain/enums';
import type {
  ActivityRepository,
  EvidenceRepository,
  TaskRepository,
} from '../repositories/interfaces';
import { recordActivity } from './activity';
import { canAccessTask } from './taskService';
import { nowIso, type Clock, type RequestContext } from './context';
import { assertEnum, assertNonEmptyString, assertUri, optionalEnum, optionalString } from './validation';

export interface AddEvidenceInput {
  type: unknown;
  title: unknown;
  uri?: unknown;
  notes?: unknown;
  provider?: unknown;
  providerObjectId?: unknown;
}

export class EvidenceService {
  constructor(
    private readonly evidence: EvidenceRepository,
    private readonly tasks: TaskRepository,
    private readonly activity: ActivityRepository,
    private readonly clock: Clock,
  ) {}

  async add(ctx: RequestContext, taskId: string, input: AddEvidenceInput): Promise<Evidence> {
    const task = await this.tasks.getById(taskId);
    if (!task) throw notFound('Task not found.');
    if (!canAccessTask(ctx.actor, task)) throw forbidden('You cannot add evidence to this task.');
    if (task.archivedAt) throw conflict('Archived tasks cannot accept new evidence.');

    const type = assertEnum(input.type, EvidenceTypes, 'type') as EvidenceType;
    const title = assertNonEmptyString(input.title, 'title');
    const notes = optionalString(input.notes, 'notes');
    const provider = optionalEnum(input.provider, EvidenceProviders, 'provider') as EvidenceProvider | undefined;
    const providerObjectId = optionalString(input.providerObjectId, 'providerObjectId');

    // Link-type evidence must carry a valid URI; other types may optionally have one.
    let uri = optionalString(input.uri, 'uri');
    if (type === 'Link') {
      uri = assertUri(input.uri, 'uri');
    } else if (uri !== undefined) {
      uri = assertUri(uri, 'uri');
    }

    const record: Evidence = {
      id: newId('evidence'),
      taskId,
      type,
      title,
      createdAt: nowIso(this.clock),
      createdBy: ctx.actor.id,
    };
    if (uri) record.uri = uri;
    if (notes) record.notes = notes;
    if (provider) record.provider = provider;
    if (providerObjectId) record.providerObjectId = providerObjectId;

    const created = await this.evidence.create(record);
    await recordActivity(
      this.activity,
      ctx,
      { entityType: 'Evidence', entityId: created.id, action: 'EvidenceAdded', metadata: { taskId, type } },
      this.clock,
    );
    return created;
  }

  async list(ctx: RequestContext, taskId: string): Promise<Evidence[]> {
    const task = await this.tasks.getById(taskId);
    if (!task) throw notFound('Task not found.');
    if (!canAccessTask(ctx.actor, task)) throw forbidden('Evidence not in your scope.');
    return this.evidence.listByTask(taskId);
  }
}
