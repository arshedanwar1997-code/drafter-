import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { listTemplates, upsertTemplate } from '@/lib/db';
import { LegalSectionSchema } from '@/lib/types';

const templateSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Template name is required'),
  description: z.string().default(''),
  provision: z.string().default('Section 11 – Relative Grounds for Refusal'),
  headingText: z.string().min(1, 'Heading text is required'),
  salutation: z.string().default('Dear Proprietor,'),
  openingParagraphs: z.array(z.string()).default([]),
  sections: z.array(LegalSectionSchema).default([]),
  defaultProfessionalFee: z.number().min(0).default(9500),
  defaultGovernmentFee: z.number().min(0).default(0),
  isDefault: z.boolean().default(false),
});

export async function GET() {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  return NextResponse.json({ templates: listTemplates() });
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = templateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid template' }, { status: 400 });
    }
    const id = parsed.data.id || `tpl-${Date.now()}`;
    const saved = upsertTemplate({ ...parsed.data, id });
    return NextResponse.json({ template: saved }, { status: 201 });
  } catch (err) {
    console.error('Template POST error:', err);
    return NextResponse.json({ error: 'Failed to save template.' }, { status: 500 });
  }
}
