import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFees, formatINR, numberToIndianWords } from '../fee-calculator';
import {
  buildPdfFilename,
  estimatePageFit,
  formatDisplayDate,
  replacePlaceholders,
} from '../text-utils';
import { createDefaultReportPayload } from '../default-data';

test('calculateFees computes subtotal, total payable, balance due, and payment status accurately', () => {
  const res = calculateFees({
    professionalFee: 699,
    governmentFee: 4500,
    otherCharges: 0,
    discount: 0,
    gst: 0,
    amountPaid: 0,
  });
  assert.equal(res.subtotal, 5199);
  assert.equal(res.totalPayable, 5199);
  assert.equal(res.balanceDue, 5199);
  assert.equal(res.derivedPaymentStatus, 'Unpaid');

  const partial = calculateFees({
    professionalFee: 9500,
    governmentFee: 4500,
    otherCharges: 500,
    discount: 500,
    gst: 1800,
    amountPaid: 5000,
  });
  assert.equal(partial.subtotal, 14500);
  assert.equal(partial.totalPayable, 15800);
  assert.equal(partial.balanceDue, 10800);
  assert.equal(partial.derivedPaymentStatus, 'Partially Paid');

  const paid = calculateFees({
    professionalFee: 9500,
    governmentFee: 0,
    amountPaid: 9500,
  });
  assert.equal(paid.balanceDue, 0);
  assert.equal(paid.derivedPaymentStatus, 'Fully Paid');
});

test('formatINR and numberToIndianWords format Indian numbering properly', () => {
  assert.equal(formatINR(9500), '₹9,500/-');
  assert.equal(formatINR(125000, false), '₹1,25,000');
  assert.equal(numberToIndianWords(9500), 'Rupees Nine Thousand Five Hundred Only');
  assert.equal(numberToIndianWords(105000), 'Rupees One Lakh Five Thousand Only');
});

test('replacePlaceholders substitutes brand, application number, and earlier marks', () => {
  const payload = createDefaultReportPayload();
  const input =
    'Application for [BRAND NAME] ([APPLICATION NUMBER]) vs [EARLIER TRADEMARK] ([EARLIER APPLICATION NUMBER]) at [TOTAL CHARGES].';
  const out = replacePlaceholders(input, payload);
  assert.equal(
    out,
    'Application for ANZORA (8127206) vs ANZORA WITH DEVICE (3589553) at ₹9,500/-.'
  );
});

test('formatDisplayDate and buildPdfFilename handle ISO dates and brand names safely', () => {
  assert.equal(formatDisplayDate('2026-11-18'), '18-11-2026');
  assert.equal(
    buildPdfFilename('RHINO TRACTOR ATTACHMENTS', '6412980', 'LSI-1'),
    'RHINO_TRACTOR_ATTACHMENTS_6412980_Advisory_Report.pdf'
  );
});

test('estimatePageFit detects single-page default report and multi-page long report', () => {
  const payload = createDefaultReportPayload();
  const single = estimatePageFit(payload);
  assert.equal(single.estimatedPages, 1);

  const longPayload = createDefaultReportPayload();
  for (let i = 0; i < 8; i++) {
    longPayload.sections.push({
      id: `extra-${i}`,
      number: String(i + 4),
      title: `EXTENDED LEGAL ANALYSIS ${i + 4}`,
      paragraphs: [
        'This is an extended legal paragraph with substantial trademark examination reasoning covering distinctiveness, phonetic comparison, visual inspection, and prior commercial adoption evidence across classes.',
      ],
      underlineHeading: true,
      isFeeSection: false,
    });
  }
  const multi = estimatePageFit(longPayload);
  assert.ok(multi.estimatedPages >= 2);
});
