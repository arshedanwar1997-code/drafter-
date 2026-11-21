import test from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { createDefaultReportPayload } from '../default-data';
import { generateAdvisoryPdf } from '../pdf-generator';

test('generateAdvisoryPdf creates a single-page A4 portrait PDF for default ANZORA payload', async () => {
  const payload = createDefaultReportPayload();
  const res = await generateAdvisoryPdf(payload);

  assert.equal(res.pageCount, 1);
  assert.ok(res.bytes.length > 5000);
  const header = Buffer.from(res.bytes.slice(0, 5)).toString('ascii');
  assert.equal(header, '%PDF-');

  const doc = await PDFDocument.load(res.bytes);
  assert.equal(doc.getPageCount(), 1);
  const { width, height } = doc.getPage(0).getSize();
  assert.ok(Math.abs(width - 595.28) < 0.5);
  assert.ok(Math.abs(height - 841.89) < 0.5);
});

test('generateAdvisoryPdf creates editable AcroForm fields in fillable mode', async () => {
  const payload = createDefaultReportPayload();
  payload.headerLeftText = 'Prepared By: Legal Success India';
  payload.styling.exportMode = 'fillable';
  const res = await generateAdvisoryPdf(payload);

  const doc = await PDFDocument.load(res.bytes);
  const form = doc.getForm();
  const fieldNames = form.getFields().map((f) => f.getName());
  assert.ok(fieldNames.includes('header_left_text'));
  assert.ok(fieldNames.includes('brand_name'));
  assert.ok(fieldNames.includes('application_number'));
  assert.ok(fieldNames.includes('document_date'));
  assert.ok(fieldNames.includes('payment_reference'));
});

test('generateAdvisoryPdf flows onto multiple pages cleanly when content exceeds 1 A4 page', async () => {
  const payload = createDefaultReportPayload();
  for (let i = 0; i < 6; i++) {
    payload.sections.push({
      id: `long-${i}`,
      number: String(i + 4),
      title: `STATUTORY SUBMISSION PART ${i + 4}`,
      paragraphs: [
        'Under the Trade Marks Act, 1999, an applicant may submit commercial invoices, packaging specimens, GST registration certificates, domain registration proof, and third-party affidavits demonstrating prior continuous adoption and honest concurrent usage in the relevant trade channels across India.',
        'Additionally, where the cited mark operates in a wholly unrelated industry or distinct consumer segment, comparative market analysis and visual-phonetic differentiation arguments should be presented cleanly.',
      ],
      underlineHeading: true,
      isFeeSection: false,
    });
  }
  const res = await generateAdvisoryPdf(payload);
  assert.ok(res.pageCount >= 2);
});
