'use client';

import React, { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { FeePreset } from '@/lib/types';
import { calculateFees, formatINR, numberToIndianWords } from '@/lib/fee-calculator';
import ConfirmDialog from './ConfirmDialog';

interface FeesViewProps {
  initialPresets: FeePreset[];
}

export default function FeesView({ initialPresets }: FeesViewProps) {
  const [presets, setPresets] = useState<FeePreset[]>(initialPresets);
  const [editing, setEditing] = useState<FeePreset | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<FeePreset | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const isNew = !presets.some((p) => p.id === editing.id);
    const res = await fetch(isNew ? '/api/fees' : `/api/fees/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (res.ok && data.preset) {
      setPresets((prev) =>
        isNew ? [data.preset, ...prev] : prev.map((p) => (p.id === data.preset.id ? data.preset : p))
      );
      setEditing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/fees/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) setPresets((prev) => prev.filter((p) => p.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-base font-bold text-slate-900">Fee Management & Schedules</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain distinct Professional Service Fee and Statutory Government Fee presets in INR.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              id: `fee-${Date.now()}`,
              name: '',
              description: '',
              professionalFee: 9500,
              governmentFee: 0,
              otherCharges: 0,
              gst: 0,
              updatedAt: new Date().toISOString(),
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Fee Schedule
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-xl border border-[#142F55]/30 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Schedule Name</label>
              <input
                type="text"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
              <input
                type="text"
                value={editing.description}
                onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Professional Service Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                value={editing.professionalFee}
                onChange={(e) =>
                  setEditing({ ...editing, professionalFee: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Government Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                value={editing.governmentFee}
                onChange={(e) =>
                  setEditing({ ...editing, governmentFee: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Other Charges (₹)
              </label>
              <input
                type="number"
                min={0}
                value={editing.otherCharges}
                onChange={(e) =>
                  setEditing({ ...editing, otherCharges: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">GST / Tax (₹)</label>
              <input
                type="number"
                min={0}
                value={editing.gst}
                onChange={(e) => setEditing({ ...editing, gst: Number(e.target.value) || 0 })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white"
            >
              Save Schedule
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Schedule</th>
                <th className="px-5 py-3 text-right">Professional Fee</th>
                <th className="px-5 py-3 text-right">Government Fee</th>
                <th className="px-5 py-3 text-right">GST / Other</th>
                <th className="px-5 py-3 text-right">Total Payable</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {presets.map((p) => {
                const summary = calculateFees(p);
                return (
                  <tr key={p.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-xs text-slate-500">{p.description}</div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-800">
                      {formatINR(p.professionalFee)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-800">
                      {formatINR(p.governmentFee)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums text-slate-600">
                      {formatINR(p.otherCharges + p.gst)}
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <div className="font-bold text-[#142F55]">{formatINR(summary.totalPayable)}</div>
                      <div className="text-[11px] text-slate-500">
                        {numberToIndianWords(summary.totalPayable)}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(p)}
                          aria-label={`Edit fee schedule ${p.name}`}
                          className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(p)}
                          aria-label={`Delete fee schedule ${p.name}`}
                          className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Fee Schedule?"
        description={`Delete "${deleteTarget?.name}" permanently?`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
