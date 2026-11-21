import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireApiAuth } from '@/lib/auth';
import { listFeePresets, upsertFeePreset } from '@/lib/db';

const feePresetSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().default(''),
  professionalFee: z.number().min(0),
  governmentFee: z.number().min(0).default(0),
  otherCharges: z.number().min(0).default(0),
  gst: z.number().min(0).default(0),
});

export async function GET() {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  return NextResponse.json({ presets: listFeePresets() });
}

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const body = await req.json();
  const parsed = feePresetSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid fee preset data.' }, { status: 400 });
  }
  const saved = upsertFeePreset({ ...parsed.data, id: parsed.data.id || `fee-${Date.now()}` });
  return NextResponse.json({ preset: saved }, { status: 201 });
}
