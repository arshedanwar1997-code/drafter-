'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BookOpen,
  Calculator,
  FilePlus2,
  FileText,
  FolderArchive,
  LayoutDashboard,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import { AdminUser } from '@/lib/types';

interface AppShellProps {
  user?: AdminUser;
  breadcrumb: string;
  primaryAction?: React.ReactNode;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reports/new', label: 'Create New Report', icon: FilePlus2 },
  { href: '/reports', label: 'Saved Reports', icon: FolderArchive },
  { href: '/templates', label: 'PDF Templates', icon: FileText },
  { href: '/legal-content', label: 'Legal Content Manager', icon: BookOpen },
  { href: '/fees', label: 'Fee Management', icon: Calculator },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export default function AppShell({ breadcrumb, primaryAction, children }: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    if (href === '/reports') return pathname === '/reports' || (pathname.startsWith('/reports/') && pathname !== '/reports/new');
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col bg-white border-r border-slate-200">
      <div className="flex items-center gap-3 border-b border-slate-200 px-5 py-4">
        <Image
          src="/images/legal-success-logo.jpg"
          alt="Legal Success India"
          width={36}
          height={36}
          referrerPolicy="no-referrer"
          className="h-9 w-9 rounded-md border border-slate-200 object-contain bg-white p-0.5 shrink-0"
        />
        <div className="min-w-0">
          <div className="text-sm font-bold tracking-tight text-[#142F55] truncate">
            LEGAL SUCCESS INDIA
          </div>
          <div className="text-[11px] font-medium text-slate-500 truncate">
            Trademark Advisory Studio
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'bg-[#142F55] text-white'
                  : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-200 px-4 py-3">
        <div className="text-xs font-semibold text-slate-700 truncate">Private Advisory Console</div>
        <div className="text-[11px] text-slate-500 truncate">Legal Success India</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 fixed inset-y-0 left-0 z-30 no-print">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-50 w-64 max-w-[80vw] h-full">
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute right-3 top-4 rounded-md p-1 text-slate-500 hover:bg-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6 py-3.5 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="text-sm font-medium text-slate-600 truncate">
              <span className="text-slate-400">Legal Success India</span>
              <span className="mx-2 text-slate-300">/</span>
              <span className="text-slate-900 font-semibold">{breadcrumb}</span>
            </div>
          </div>

          {primaryAction && <div className="shrink-0 flex items-center gap-3">{primaryAction}</div>}
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
