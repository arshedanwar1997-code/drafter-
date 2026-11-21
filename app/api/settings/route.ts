import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { getOrganizationSettings, saveOrganizationSettings } from '@/lib/db';

export async function GET() {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  return NextResponse.json({ settings: getOrganizationSettings() });
}

export async function PUT(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const current = getOrganizationSettings();
  const saved = saveOrganizationSettings({ ...current, ...body });
  return NextResponse.json({ settings: saved });
}
