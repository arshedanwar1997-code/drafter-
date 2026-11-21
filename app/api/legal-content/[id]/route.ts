import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { deleteLegalClause, listLegalClauses, upsertLegalClause } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const existing = listLegalClauses().find((c) => c.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'Clause not found.' }, { status: 404 });
  }
  const body = await req.json();
  const updated = upsertLegalClause({ ...existing, ...body, id });
  return NextResponse.json({ clause: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const ok = deleteLegalClause(id);
  if (!ok) return NextResponse.json({ error: 'Clause not found.' }, { status: 404 });
  return NextResponse.json({ ok: true });
}
