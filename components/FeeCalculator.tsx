'use client';

import React from 'react';
import { FeeDetails, FeePreset } from '@/lib/types';
import { calculateFees, formatINR, numberToIndianWords } from '@/lib/fee-calculator';

interface FeeCalculatorProps {
  fees: FeeDetails;
  presets: FeePreset[];
  onChange: (next: FeeDetails) => void;
}

export default function FeeCalculator({ fees, presets, onChange }: FeeCalculatorProps) {
  const summary = calculateFees(fees);

  const updateNum = (field: keyof FeeDetails, raw: string) => {
    const val = raw === '' ? 0 : Math.max(0, Number(raw));
    const next = { ...fees, [field]: Number.isFinite(val) ? val : 0 };
    const nextSummary = calculateFees(next);
    next.paymentStatus = nextSummary.derivedPaymentStatus;
    onChange(next);
  };

  const applyPreset = (presetId: string) => {
    const p = presets.find((x) => x.id === presetId);
    if (!p) return;
    const next: FeeDetails = {
      ...fees,
      professionalFee: p.professionalFee,
      governmentFee: p.governmentFee,
      otherCharges: p.otherCharges,
      gst: p.gst,
    };
    next.paymentStatus = calculateFees(next).derivedPaymentStatus;
    onChange(next);
  };

  return (
    <div className="space-y-4">
      {presets.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Apply Saved Fee Preset
          </label>
          <select
            defaultValue=""
            onChange={(e) => {
              if (e.target.value) applyPreset(e.target.value);
            }}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          >
            <option value="">Choose a standard fee schedule...</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — Prof. {formatINR(p.professionalFee, false)} + Govt.{' '}
                {formatINR(p.governmentFee, false)}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Professional Service Fee (₹)
          </label>
          <input
            type="number"
            min={0}
            value={fees.professionalFee}
            onChange={(e) => updateNum('professionalFee', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Government Fee (₹) — Separate Statutory Fee
          </label>
          <input
            type="number"
            min={0}
            value={fees.governmentFee}
            onChange={(e) => updateNum('governmentFee', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">
            Other Applicable Charges (₹)
          </label>
          <input
            type="number"
            min={0}
            value={fees.otherCharges}
            onChange={(e) => updateNum('otherCharges', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Discount (₹)</label>
          <input
            type="number"
            min={0}
            value={fees.discount}
            onChange={(e) => updateNum('discount', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Tax / GST (₹)</label>
          <input
            type="number"
            min={0}
            value={fees.gst}
            onChange={(e) => updateNum('gst', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Amount Paid (₹)</label>
          <input
            type="number"
            min={0}
            value={fees.amountPaid}
            onChange={(e) => updateNum('amountPaid', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums focus:border-[#142F55] focus:outline-none"
          />
        </div>
      </div>

      {/* Live INR Summary */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1.5">
        <div className="flex items-center justify-between text-xs text-slate-600 tabular-nums">
          <span>Subtotal (Professional + Govt + Other)</span>
          <span className="font-medium text-slate-900">{formatINR(summary.subtotal)}</span>
        </div>
        <div className="flex items-center justify-between text-sm font-bold text-[#142F55] pt-1 border-t border-slate-200 tabular-nums">
          <span>Total Payable</span>
          <span data-testid="fee-total-payable">{formatINR(summary.totalPayable)}</span>
        </div>
        <div className="text-[11px] text-slate-600">{numberToIndianWords(summary.totalPayable)}</div>
        <div className="flex items-center justify-between text-xs text-slate-600 pt-1 tabular-nums">
          <span>Balance Due</span>
          <span className="font-semibold text-slate-900">{formatINR(summary.balanceDue)}</span>
        </div>
      </div>

      {/* Payment Information */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Mode</label>
          <input
            type="text"
            value={fees.paymentMode}
            onChange={(e) => onChange({ ...fees, paymentMode: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Status</label>
          <select
            value={fees.paymentStatus}
            onChange={(e) =>
              onChange({ ...fees, paymentStatus: e.target.value as FeeDetails['paymentStatus'] })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          >
            <option value="Unpaid">Unpaid</option>
            <option value="Partially Paid">Partially Paid</option>
            <option value="Fully Paid">Fully Paid</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Reference</label>
          <input
            type="text"
            value={fees.paymentReference}
            onChange={(e) => onChange({ ...fees, paymentReference: e.target.value })}
            placeholder="e.g. INV-2026-041"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Transaction ID</label>
          <input
            type="text"
            value={fees.transactionId}
            onChange={(e) => onChange({ ...fees, transactionId: e.target.value })}
            placeholder="UPI / NEFT Ref"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 mb-1">Payment Date</label>
          <input
            type="date"
            value={fees.paymentDate}
            onChange={(e) => onChange({ ...fees, paymentDate: e.target.value })}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
          />
        </div>
      </div>
    </div>
  );
}
