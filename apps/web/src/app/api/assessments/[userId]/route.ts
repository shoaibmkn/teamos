import { requireContext } from '@/lib/server/context';
import { fail, ok, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const months = Number(new URL(req.url).searchParams.get('months') ?? 6);
    const assessment = await services.assessments.forEmployee(ctx, params.userId, months);
    return ok({ assessment }, ctx.requestId);
  } catch (err) {
    return fail(err, reqId(req));
  }
}
