import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { deleteReport, getReportById, updateReport } from '@/lib/db';
import { ReportPayloadSchema } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const report = getReportById(id);
  if (!report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  return NextResponse.json({ report });
}

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const existing = getReportById(id);
  if (!existing) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  try {
    const body = await req.json();
    const overwriteConfirmed = Boolean(body?.confirmFinalizedOverwrite);
    if (existing.reportStatus === 'Finalized' && !overwriteConfirmed && body?.reportStatus !== 'Archived') {
      // Allow status-only archival without warning; otherwise require explicit confirmation
      if (body?.requireOverwriteConfirmation) {
        return NextResponse.json(
          { error: 'Finalized report requires explicit overwrite confirmation.', requiresConfirmation: true },
          { status: 409 }
        );
      }
    }

    const parsed = ReportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const updated = updateReport(id, parsed.data);
    return NextResponse.json({ report: updated });
  } catch (err) {
    console.error('Update report error:', err);
    return NextResponse.json({ error: 'Failed to update report.' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const deleted = deleteReport(id);
  if (!deleted) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
