'use client';

import React, { useState } from 'react';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { LegalClause } from '@/lib/types';
import ConfirmDialog from './ConfirmDialog';

interface LegalContentViewProps {
  initialClauses: LegalClause[];
}

export default function LegalContentView({ initialClauses }: LegalContentViewProps) {
  const [clauses, setClauses] = useState<LegalClause[]>(initialClauses);
  const [editing, setEditing] = useState<LegalClause | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LegalClause | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const isNew = !clauses.some((c) => c.id === editing.id);
    const res = await fetch(isNew ? '/api/legal-content' : `/api/legal-content/${editing.id}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing),
    });
    const data = await res.json();
    if (res.ok && data.clause) {
      setClauses((prev) =>
        isNew ? [data.clause, ...prev] : prev.map((c) => (c.id === data.clause.id ? data.clause : c))
      );
      setEditing(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/legal-content/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) setClauses((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
        <div>
          <h1 className="text-base font-bold text-slate-900">Legal Content Manager</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Maintain reusable statutory explanations and disclaimers available for quick insertion inside reports.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            setEditing({
              id: `clause-${Date.now()}`,
              title: '',
              category: 'Section 11',
              provision: 'Section 11 – Relative Grounds for Refusal',
              content: '',
              updatedAt: new Date().toISOString(),
            })
          }
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add Legal Clause
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSave} className="rounded-xl border border-[#142F55]/30 bg-white p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Clause Title</label>
              <input
                type="text"
                required
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <input
                type="text"
                required
                value={editing.category}
                onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Provision</label>
              <input
                type="text"
                required
                value={editing.provision}
                onChange={(e) => setEditing({ ...editing, provision: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Paragraph Text</label>
            <textarea
              rows={3}
              required
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
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
              Save Clause
            </button>
          </div>
        </form>
      )}

      <div className="space-y-3">
        {clauses.map((c) => (
          <div key={c.id} className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm font-bold text-slate-900">{c.title}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {c.category} <span className="mx-1.5 text-slate-300">·</span> {c.provision}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(c)}
                  aria-label={`Edit clause ${c.title}`}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(c)}
                  aria-label={`Delete clause ${c.title}`}
                  className="rounded-md border border-slate-200 p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <p className="mt-2.5 text-sm text-slate-700 leading-relaxed">{c.content}</p>
          </div>
        ))}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Legal Clause?"
        description={`Remove "${deleteTarget?.title}" from the reusable clause library?`}
        confirmLabel="Delete"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
