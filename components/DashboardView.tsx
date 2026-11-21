'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Download,
  FileClock,
  FilePlus2,
  FileText,
} from 'lucide-react';
import { DashboardStats } from '@/lib/types';
import { calculateFees, formatINR } from '@/lib/fee-calculator';
import { formatDisplayDate } from '@/lib/text-utils';

interface DashboardViewProps {
  stats: DashboardStats;
}

export default function DashboardView({ stats }: DashboardViewProps) {
  const maxMonthCount = Math.max(1, ...stats.monthlySeries.map((m) => m.count));

  const kpis = [
    { label: 'Total Reports Generated', value: stats.totalReports, icon: FileText },
    { label: 'Reports Generated Today', value: stats.reportsToday, icon: CalendarDays },
    { label: 'Reports This Month', value: stats.reportsThisMonth, icon: CalendarDays },
    { label: 'Draft Reports', value: stats.draftReports, icon: FileClock },
    { label: 'Completed Reports', value: stats.completedReports, icon: CheckCircle2 },
  ];

  return (
    <div className="space-y-6">
      {/* Intro & Quick Create */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-slate-200 bg-white p-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Trademark Examination & Section 11 Advisory Console
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Prepare standardized, one-page A4 private trademark advisory reports with live preview,
            bilingual fields, and fillable PDF export.
          </p>
        </div>
        <Link
          href="/reports/new"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#142F55] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f2442] whitespace-nowrap shrink-0 transition-colors"
        >
          <FilePlus2 className="h-4 w-4" />
          Quick Create Report
        </Link>
      </div>

      {/* 5 Overview KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between"
            >
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-medium">{kpi.label}</span>
                <Icon className="h-4 w-4 text-[#142F55]" />
              </div>
              <div className="mt-3 text-2xl font-bold text-slate-900 tabular-nums">{kpi.value}</div>
            </div>
          );
        })}
      </div>

      {/* Monthly Report Generation Statistics + Latest Edited */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-5 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-slate-900">
            Monthly Report Generation Statistics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Reports logged over the past 6 months</p>

          <div className="mt-6 flex items-end justify-between gap-3 h-40 border-b border-slate-200 pb-2">
            {stats.monthlySeries.map((item) => {
              const heightPct = Math.max(8, Math.round((item.count / maxMonthCount) * 100));
              return (
                <div key={item.month} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">
                    {item.count}
                  </span>
                  <div
                    className="w-full max-w-[36px] rounded-t-md bg-[#142F55] transition-all"
                    style={{ height: `${heightPct}%` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            {stats.monthlySeries.map((item) => (
              <div
                key={item.month}
                className="flex-1 text-center text-[11px] font-medium text-slate-500 tabular-nums"
              >
                {item.month}
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Latest Edited Reports</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Quickly resume editing or download generated advisories
              </p>
            </div>
            <Link
              href="/reports"
              className="inline-flex items-center gap-1 text-xs font-semibold text-[#142F55] hover:underline whitespace-nowrap"
            >
              View All Reports
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {stats.latestEditedReports.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">
              No reports created yet. Create your first trademark advisory report.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {stats.latestEditedReports.map((rep) => {
                const total = calculateFees(rep.fees).totalPayable;
                return (
                  <div
                    key={rep.id}
                    className="py-3 flex flex-wrap items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/reports/${rep.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-[#142F55] hover:underline truncate block"
                      >
                        {rep.brandName}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5 tabular-nums">
                        App #{rep.applicationNumber}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {rep.applicantName || 'Proprietor'}
                        <span className="mx-1.5 text-slate-300">·</span>
                        {formatDisplayDate(rep.documentDate)}
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-right tabular-nums">
                        <div className="text-xs font-semibold text-slate-900">
                          {formatINR(total)}
                        </div>
                        <div className="text-[11px] text-slate-500">{rep.reportStatus}</div>
                      </div>

                      <a
                        href={`/api/reports/${rep.id}/download`}
                        aria-label={`Download PDF for ${rep.brandName}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-[#142F55]"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recently Generated Reports Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Recently Generated Reports</h2>
          <span className="text-xs text-slate-500 tabular-nums">
            Showing {stats.recentReports.length} latest records
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Brand Name</th>
                <th className="px-5 py-3">Application No.</th>
                <th className="px-5 py-3">Earlier Cited Mark</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Charges</th>
                <th className="px-5 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stats.recentReports.map((rep) => (
                <tr key={rep.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-3 font-semibold text-slate-900">{rep.brandName}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-700 tabular-nums">
                    {rep.applicationNumber}
                  </td>
                  <td className="px-5 py-3 text-xs text-slate-600">
                    {rep.earlierTrademarks[0]?.markName || '—'}
                  </td>
                  <td className="px-5 py-3 text-xs font-medium text-slate-700">
                    {rep.reportStatus}
                  </td>
                  <td className="px-5 py-3 text-right font-semibold text-slate-900 tabular-nums">
                    {formatINR(calculateFees(rep.fees).totalPayable)}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Link
                      href={`/reports/${rep.id}`}
                      className="text-xs font-semibold text-[#142F55] hover:underline"
                    >
                      Open Report
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
