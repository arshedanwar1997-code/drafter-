import { FeeDetails, PaymentStatus } from './types';

export interface FeeSummary {
  professionalFee: number;
  governmentFee: number;
  otherCharges: number;
  subtotal: number;
  discount: number;
  gst: number;
  totalPayable: number;
  amountPaid: number;
  balanceDue: number;
  derivedPaymentStatus: PaymentStatus;
}

export function sanitizeAmount(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

export function calculateFees(fees: Partial<FeeDetails>): FeeSummary {
  const professionalFee = sanitizeAmount(fees.professionalFee ?? 0);
  const governmentFee = sanitizeAmount(fees.governmentFee ?? 0);
  const otherCharges = sanitizeAmount(fees.otherCharges ?? 0);
  const discount = sanitizeAmount(fees.discount ?? 0);
  const gst = sanitizeAmount(fees.gst ?? 0);
  const amountPaid = sanitizeAmount(fees.amountPaid ?? 0);

  const subtotal = Math.round((professionalFee + governmentFee + otherCharges) * 100) / 100;
  const rawTotal = subtotal - discount + gst;
  const totalPayable = Math.max(0, Math.round(rawTotal * 100) / 100);
  const balanceDue = Math.max(0, Math.round((totalPayable - amountPaid) * 100) / 100);

  let derivedPaymentStatus: PaymentStatus = 'Unpaid';
  if (totalPayable === 0 || amountPaid >= totalPayable) {
    derivedPaymentStatus = amountPaid > 0 ? 'Fully Paid' : 'Unpaid';
  } else if (amountPaid > 0) {
    derivedPaymentStatus = 'Partially Paid';
  }

  return {
    professionalFee,
    governmentFee,
    otherCharges,
    subtotal,
    discount,
    gst,
    totalPayable,
    amountPaid,
    balanceDue,
    derivedPaymentStatus,
  };
}

/**
 * Formats a number in standard Indian numbering (e.g., 9500 -> ₹9,500/- or ₹1,25,000/-).
 */
export function formatINR(amount: number, withSlashDash = true): string {
  const clean = Math.round(sanitizeAmount(amount));
  const formatted = new Intl.NumberFormat('en-IN').format(clean);
  return withSlashDash ? `₹${formatted}/-` : `₹${formatted}`;
}

const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
];

const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigitsToWords(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return one ? `${TENS[ten]} ${ONES[one]}` : TENS[ten];
}

function threeDigitsToWords(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred && rest) return `${ONES[hundred]} Hundred ${twoDigitsToWords(rest)}`;
  if (hundred) return `${ONES[hundred]} Hundred`;
  return twoDigitsToWords(rest);
}

/**
 * Converts a non-negative integer into Indian English currency words.
 * Example: 9500 -> "Rupees Nine Thousand Five Hundred Only"
 */
export function numberToIndianWords(amount: number): string {
  const n = Math.round(sanitizeAmount(amount));
  if (n === 0) return 'Rupees Zero Only';

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000);
  const lakh = Math.floor((n % 10000000) / 100000);
  const thousand = Math.floor((n % 100000) / 1000);
  const rest = n % 1000;

  if (crore) parts.push(`${twoDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${twoDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigitsToWords(thousand)} Thousand`);
  if (rest) parts.push(threeDigitsToWords(rest));

  return `Rupees ${parts.join(' ').trim()} Only`;
}
