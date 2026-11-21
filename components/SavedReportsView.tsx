'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Archive,
  Copy,
  Download,
  Edit3,
  FilePlus2,
  Printer,
  Search,
  Trash2,
} from 'lucide-react';
import { SavedReport } from '@/lib/types';
import { calculateFees, formatINR } from '@/lib/fee-calculator';
import { formatDisplayDate } from '@/lib/text-utils';
import ConfirmDialog from './ConfirmDialog';

interface SavedReportsViewProps {
  initialReports: SavedReport[];
}

export default function SavedReportsView({ initialReports }: SavedReportsViewProps) {
  const router = useRouter();
  const [reports, setReports] = useState<SavedReport[]>(initialReports);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<SavedReport | null>(null);

  const filtered = useMemo(() => {
    return reports.filter((r) => {
      if (statusFilter !== 'All' && r.reportStatus !== statusFilter) return false;
      if (dateFilter && r.documentDate !== dateFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const hay = `${r.brandName} ${r.applicationNumber} ${r.applicantName} ${r.documentId}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, statusFilter, dateFilter]);

  const handleDuplicate = async (rep: SavedReport) => {
    const res = await fetch(`/api/reports/${rep.id}/duplicate`, { method: 'POST' });
    const data = await res.json();
    if (res.ok && data.report) {
      setReports((prev) => [data.report, ...prev]);
    }
  };

  const handleArchive = async (rep: SavedReport) => {
    const res = await fetch(`/api/reports/${rep.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rep, reportStatus: 'Archived', confirmFinalizedOverwrite: true }),
    });
    const data = await res.json();
    if (res.ok && data.report) {
      setReports((prev) => prev.map((x) => (x.id === rep.id ? data.report : x)));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const res = await fetch(`/api/reports/${deleteTarget.id}`, { method: 'DELETE' });
    if (res.ok) {
      setReports((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-5">
      {/* Search & Filters */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[260px]">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search brand, applicant, or application no..."
              aria-label="Search saved reports"
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 focus:border-[#142F55] focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            {['All', 'Draft', 'Generated', 'Finalized', 'Archived'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === st
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            aria-label="Filter by document date"
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-800 tabular-nums"
          />
          {dateFilter && (
            <button
              type="button"
              onClick={() => setDateFilter('')}
              className="text-xs font-medium text-slate-600 hover:underline"
            >
              Clear date
            </button>
          )}
        </div>

        <Link
          href="/reports/new"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442] whitespace-nowrap shrink-0"
        >
          <FilePlus2 className="h-4 w-4" />
          New Report
        </Link>
      </div>

      {/* Reports Data Grid */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm font-medium text-slate-700">No matching trademark reports found.</p>
            <p className="mt-1 text-xs text-slate-500">
              Adjust your search filters or create a new Section 11 advisory report.
            </p>
            <Link
              href="/reports/new"
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#142F55] px-4 py-2 text-xs font-semibold text-white hover:bg-[#0f2442]"
            >
              Create New Report
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Document ID / Date</th>
                  <th className="px-4 py-3">Brand & Applicant</th>
                  <th className="px-4 py-3">App No. & Class</th>
                  <th className="px-4 py-3">Earlier Mark</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Total Payable</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((rep) => {
                  const total = calculateFees(rep.fees).totalPayable;
                  return (
                    <tr key={rep.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 tabular-nums">
                        <div className="font-mono text-xs font-semibold text-slate-900">
                          {rep.documentId}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {formatDisplayDate(rep.documentDate)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{rep.brandName}</div>
                        <div className="text-xs text-slate-500">
                          {rep.applicantName || 'Dear Proprietor'}
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums">
                        <div className="font-mono text-xs font-semibold text-slate-800">
                          {rep.applicationNumber}
                        </div>
                        <div className="text-[11px] text-slate-500">{rep.trademarkClass || '—'}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        <div>{rep.earlierTrademarks[0]?.markName || '—'}</div>
                        <div className="font-mono text-[11px] text-slate-500 tabular-nums">
                          {rep.earlierTrademarks[0]?.applicationNumber || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold text-slate-700">
                        {rep.reportStatus}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                        {formatINR(total)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => router.push(`/reports/${rep.id}`)}
                            aria-label={`Open and edit ${rep.brandName}`}
                            title="Open & Edit"
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#142F55]"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(rep)}
                            aria-label={`Duplicate ${rep.brandName}`}
                            title="Duplicate"
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#142F55]"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <a
                            href={`/api/reports/${rep.id}/download`}
                            aria-label={`Download PDF for ${rep.brandName}`}
                            title="Download PDF"
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#142F55]"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                          <a
                            href={`/api/reports/${rep.id}/download?inline=1`}
                            target="_blank"
                            rel="noreferrer"
                            aria-label={`Print PDF for ${rep.brandName}`}
                            title="Open Printable PDF"
                            className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-[#142F55]"
                          >
                            <Printer className="h-4 w-4" />
                          </a>
                          {rep.reportStatus !== 'Archived' && (
                            <button
                              type="button"
                              onClick={() => handleArchive(rep)}
                              aria-label={`Archive ${rep.brandName}`}
                              title="Archive"
                              className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 hover:text-amber-700"
                            >
                              <Archive className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(rep)}
                            aria-label={`Delete ${rep.brandName}`}
                            title="Delete"
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
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete Trademark Report?"
        description={`Are you sure you want to permanently delete "${deleteTarget?.brandName}" (${deleteTarget?.applicationNumber})?`}
        confirmLabel="Delete Report"
        danger
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
