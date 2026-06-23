import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function PATCH(req: Request, { params }: { params: { taskId: string; subtaskId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = (await req.json().catch(() => ({}))) as { done?: boolean };
    const subtask = await services.subtasks.setDone(ctx, params.taskId, params.subtaskId, body.done);
    return ok({ subtask }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
