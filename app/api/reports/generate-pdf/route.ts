import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { createReport, getOrganizationSettings, getReportById, updateReport } from '@/lib/db';
import { generateAdvisoryPdf } from '@/lib/pdf-generator';
import { savePdfToCache } from '@/lib/storage';
import { buildPdfFilename } from '@/lib/text-utils';
import { ReportPayloadSchema } from '@/lib/types';

export async function POST(req: NextRequest) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const parsed = ReportPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid report payload', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const payload = parsed.data;
    const orgSettings = getOrganizationSettings();
    const generated = await generateAdvisoryPdf(payload, orgSettings);

    const relPath = savePdfToCache(payload.documentId, generated.bytes);

    const nextStatus = payload.reportStatus === 'Finalized' ? 'Finalized' : 'Generated';
    const nextPayload = { ...payload, reportStatus: nextStatus as typeof payload.reportStatus };

    let savedReport;
    if (payload.id && getReportById(payload.id)) {
      savedReport = updateReport(payload.id, nextPayload, relPath);
    } else {
      savedReport = createReport(nextPayload, relPath);
    }

    const filename = buildPdfFilename(payload.brandName, payload.applicationNumber, payload.documentId);
    const pdfBase64 = Buffer.from(generated.bytes).toString('base64');

    return NextResponse.json({
      documentId: payload.documentId,
      reportId: savedReport?.id,
      downloadUrl: `/api/reports/${savedReport?.id}/download`,
      filename,
      pageCount: generated.pageCount,
      autoCompressed: generated.autoCompressed,
      generatedAt: new Date().toISOString(),
      pdfBase64,
      report: savedReport,
    });
  } catch (err) {
    console.error('Generate PDF error:', err);
    return NextResponse.json({ error: 'PDF generation failed.' }, { status: 500 });
  }
}
