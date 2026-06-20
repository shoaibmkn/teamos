import type { TaskFilter, TaskStatus } from '@teamos/core';
import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const url = new URL(req.url);
    const filter: TaskFilter = {};
    const status = url.searchParams.get('status');
    if (status) filter.status = status as TaskStatus;
    const assignee = url.searchParams.get('assigneeUserId');
    if (assignee) filter.assigneeUserId = assignee;
    const manager = url.searchParams.get('managerUserId');
    if (manager) filter.managerUserId = manager;
    const wfi = url.searchParams.get('workflowInstanceId');
    if (wfi) filter.workflowInstanceId = wfi;

    const limitRaw = url.searchParams.get('limit');
    const cursor = url.searchParams.get('cursor') ?? undefined;
    const options: { limit?: number; cursor?: string } = {};
    if (limitRaw) options.limit = Number(limitRaw);
    if (cursor) options.cursor = cursor;

    const page = await services.tasks.list(ctx, filter, options);
    return ok(page, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}

export async function POST(req: Request) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const task = await services.tasks.create(ctx, body);
    return ok({ task }, ctx.requestId, 201);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
