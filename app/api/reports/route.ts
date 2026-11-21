import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { createReport, getDashboardStats, listReports } from '@/lib/db';
import { ReportPayloadSchema } from '@/lib/types';

export async function GET(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { searchParams } = new URL(req.url);
  if (searchParams.get('stats') === '1') {
    return NextResponse.json({ stats: getDashboardStats() });
  }

  const search = searchParams.get('search') || undefined;
  const status = searchParams.get('status') || undefined;
  const date = searchParams.get('date') || undefined;

  const reports = listReports({ search, status, date });
  return NextResponse.json({ reports });
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = ReportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const created = createReport(parsed.data);
    return NextResponse.json({ report: created }, { status: 201 });
  } catch (err) {
    console.error('Create report error:', err);
    return NextResponse.json({ error: 'Failed to save report.' }, { status: 500 });
  }
}
