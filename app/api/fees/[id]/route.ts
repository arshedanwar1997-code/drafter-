import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { deleteFeePreset, listFeePresets, upsertFeePreset } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const existing = listFeePresets().find((f) => f.id === id);
  if (!existing) return NextResponse.json({ error: 'Fee preset not found.' }, { status: 404 });
  const body = await req.json();
  const updated = upsertFeePreset({ ...existing, ...body, id });
  return NextResponse.json({ preset: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const ok = deleteFeePreset(id);
  if (!ok) return NextResponse.json({ error: 'Fee preset not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
