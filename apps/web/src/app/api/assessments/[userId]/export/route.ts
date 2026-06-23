import { NextResponse } from 'next/server';
import { assessmentToCsv } from '@teamos/core';
import { requireContext } from '@/lib/server/context';
import { fail, reqId } from '@/lib/server/respond';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, { params }: { params: { userId: string } }) {
  try {
    const { ctx, services } = await requireContext(req);
    const months = Number(new URL(req.url).searchParams.get('months') ?? 6);
    const assessment = await services.assessments.forEmployee(ctx, params.userId, months);
    const csv = assessmentToCsv(assessment);
    const filename = `assessment-${assessment.user.displayName.replace(/\s+/g, '_')}-${assessment.periodEnd}.csv`;
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    return fail(err, reqId(req));
  }
}
