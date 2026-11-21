import fs from 'node:fs';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { requireApiAuth } from '@/lib/auth';
import { getOrganizationSettings, getReportById, updateReport } from '@/lib/db';
import { generateAdvisoryPdf } from '@/lib/pdf-generator';
import { buildPdfFilename } from '@/lib/text-utils';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { errorResponse } = await requireApiAuth();
  if (errorResponse) return errorResponse;

  const { id } = await context.params;
  const report = getReportById(id);
  if (!report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get('mode') === 'fillable' ? 'fillable' : report.styling?.exportMode || 'standard';
  const inline = searchParams.get('inline') === '1';
  const filename = buildPdfFilename(report.brandName, report.applicationNumber, report.documentId);

  let pdfBytes: Uint8Array;
  const storedPath = report.pdfPath ? path.join(process.cwd(), report.pdfPath) : null;

  if (storedPath && fs.existsSync(storedPath) && searchParams.get('mode') === null) {
    pdfBytes = fs.readFileSync(storedPath);
  } else {
    const orgSettings = getOrganizationSettings();
    const result = await generateAdvisoryPdf(
      { ...report, styling: { ...report.styling, exportMode: mode } },
      orgSettings
    );
    pdfBytes = result.bytes;

    const dir = path.join(process.cwd(), 'storage', 'generated-pdfs');
    fs.mkdirSync(dir, { recursive: true });
    const relPath = path.join('storage', 'generated-pdfs', `${report.documentId}.pdf`);
    fs.writeFileSync(path.join(process.cwd(), relPath), pdfBytes);
    updateReport(report.id, report, relPath);
  }

  return new NextResponse(Buffer.from(pdfBytes), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
