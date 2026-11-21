import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { duplicateReport } from '@/lib/db';

export async function POST(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const duplicated = duplicateReport(id);
  if (!duplicated) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  return NextResponse.json({ report: duplicated }, { status: 201 });
}
