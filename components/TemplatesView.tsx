'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Copy, Edit3, Plus, Star, Trash2 } from 'lucide-react';
import { ReportTemplate } from '@/lib/types';
import { formatINR } from '@/lib/fee-calculator';
import ConfirmDialog from './ConfirmDialog';

interface TemplatesViewProps {
  initialTemplates: ReportTemplate[];
}

export default function TemplatesView({ initialTemplates }: TemplatesViewProps) {
  const router = useRouter();
  const [templates, setTemplates] = useState<ReportTemplate[]>(initialTemplates);
  const [editing, setEditing] = useState<ReportTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportTemplate | null>(null);

  const handleSetDefault = async (tpl: ReportTemplate) => {
    const res = await fetch(`/api/templates/${tpl.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...tpl, isDefault: true }),
    });
    if (res.ok) {
      setTemplates((prev) => prev.map((t) => ({ ...t, isDefault: t.id === tpl.id })));
    }
  };

  const handleDuplicate = async (tpl: ReportTemplate) => {
    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...tpl,
        id: undefined,
        name: `${tpl.name} (Copy)`,
        isDefault: false,
      }),
    });
    const data = await res.json();
    if (res.ok && data.template) {
      setTemplates((prev) => [...prev, data.template]);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const isNew = !templates.some((t) => t.id === editing.id);
    const res = await fetch(isNew ? '/api/templates' : `/api/templates/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (res.ok && data.template) {
      setTemplates((prev) =>
        isNew ? [data.template, ...prev] : prev.map((t) => (t.id === data.template.id ? data.template : t))
      );
      setEditing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/templates/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      setTemplates((prev) => prev.filter((t) => t.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-base font-bold text-slate-900">PDF Advisory Templates</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Standardize headings, statutory legal explanations, and default fees across report types.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            const base = templates[0];
            setEditing({
              id: `tpl-${Date.now()}`,
              name: 'New Advisory Template',
              description: 'Custom trademark advisory layout',
              provision: 'Section 11 – Relative Grounds for Refusal',
              headingText: 'TRADEMARK EXAMINATION & SECTION 11 ADVISORY NOTICE',
              salutation: 'Dear Proprietor,',
              openingParagraphs: base ? [...base.openingParagraphs] : [''],
              sections: base ? [...base.sections] : [],
              defaultProfessionalFee: 9500,
              defaultGovernmentFee: 0,
              isDefault: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Create Template
        </button>
      </div>

      {editing && (
        <form
          onSubmit={handleSaveEdit}
          className="rounded-xl border border-[#142F55]/30 bg-white p-5 space-y-4"
        >
          <div className="text-sm font-bold text-[#142F55]">Edit Template Configuration</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Template Name</label>
              <input
                type="text"
                required
                value={editing.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Statutory Provision
              </label>
              <input
                type="text"
                value={editing.provision}
                onChange={(e) => setEditing({ ...editing, provision: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Main Document Heading
              </label>
              <input
                type="text"
                required
                value={editing.headingText}
                onChange={(e) => setEditing({ ...editing, headingText: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold"
              />
            </div>
            <div className="sm:col-span-2">
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
                Default Professional Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                value={editing.defaultProfessionalFee}
                onChange={(e) =>
                  setEditing({ ...editing, defaultProfessionalFee: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Default Government Fee (₹)
              </label>
              <input
                type="number"
                min={0}
                value={editing.defaultGovernmentFee}
                onChange={(e) =>
                  setEditing({ ...editing, defaultGovernmentFee: Number(e.target.value) || 0 })
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442]"
            >
              Save Template
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map((tpl) => (
          <div
            key={tpl.id}
            className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between gap-4"
          >
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-sm font-bold text-slate-900">{tpl.name}</h2>
                {tpl.isDefault && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B6D38] shrink-0">
                    <Star className="h-3.5 w-3.5 fill-current" />
                    Default
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-600">{tpl.description}</p>
              <div className="mt-3 text-xs text-slate-500 space-y-1 tabular-nums">
                <div>
                  Heading: <span className="font-semibold text-slate-800">{tpl.headingText}</span>
                </div>
                <div>
                  Default Fees: Prof. {formatINR(tpl.defaultProfessionalFee)} · Govt.{' '}
                  {formatINR(tpl.defaultGovernmentFee)}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(tpl)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDuplicate(tpl)}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
                {!tpl.isDefault && (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(tpl)}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Set Default
                  </button>
                )}
                {!tpl.isDefault && (
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(tpl)}
                    aria-label={`Delete template ${tpl.name}`}
                    className="rounded-md border border-slate-200 p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => router.push('/reports/new')}
                className="text-xs font-semibold text-[#142F55] hover:underline whitespace-nowrap"
              >
                Use in Editor →
              </button>
            </div>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Template?"
        description={`Delete "${deleteTarget?.name}" permanently?`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
