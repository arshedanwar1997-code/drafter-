import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { listLegalClauses, upsertLegalClause } from '@/lib/db';

const clauseSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  category: z.string().min(1),
  provision: z.string().min(1),
  content: z.string().min(1),
});

export async function GET() {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  return NextResponse.json({ clauses: listLegalClauses() });
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const parsed = clauseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid legal clause data.' }, { status: 400 });
  }
  const saved = upsertLegalClause({ ...parsed.data, id: parsed.data.id || `clause-${Date.now()}` });
  return NextResponse.json({ clause: saved }, { status: 201 });
}
