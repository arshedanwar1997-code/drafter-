import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { deleteTemplate, listTemplates, upsertTemplate } from '@/lib/db';

export async function PUT(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const existing = listTemplates().find((t) => t.id === id);
  if (!existing) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  }

  const body = await req.json();
  const updated = upsertTemplate({ ...existing, ...body, id });
  return NextResponse.json({ template: updated });
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const ok = deleteTemplate(id);
  if (!ok) {
    return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
