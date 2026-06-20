// Activity logging helper. Every material action appends one immutable entry
// in the same use-case execution as the write it describes (architecture.md).

import type { Activity } from '../domain/entities';
import type { EntityType } from '../domain/enums';
import { newId } from '../domain/ids';
import type { ActivityRepository } from '../repositories/interfaces';
import { nowIso, type Clock, type RequestContext } from './context';

export interface ActivityInput {
  entityType: EntityType;
  entityId: string;
  action: string;
  metadata?: Record<string, unknown>;
}

export async function recordActivity(
  repo: ActivityRepository,
  ctx: RequestContext,
  input: ActivityInput,
  clock: Clock,
): Promise<Activity> {
  const entry: Activity = {
    id: newId('activity'),
    actorUserId: ctx.actor.id,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    occurredAt: nowIso(clock),
    requestId: ctx.requestId,
  };
  if (input.metadata) entry.metadataJson = JSON.stringify(input.metadata);
  return repo.append(entry);
}
