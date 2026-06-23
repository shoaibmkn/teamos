import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const messages = await services.messages.list(ctx, params.taskId);
    return ok({ messages }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}

export async function POST(req: Request, { params }: { params: { taskId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const body = await req.json().catch(() => ({}));
    const message = await services.messages.post(ctx, params.taskId, body);
    return ok({ message }, ctx.requestId, 201);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
