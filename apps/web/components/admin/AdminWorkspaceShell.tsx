'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  ChevronLeft,
  ClipboardList,
  Flag,
  LayoutDashboard,
  MapPinned,
  Menu,
  MessageSquareWarning,
  ShieldCheck,
  Tags,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type AdminLink = {
  href: string;
  icon: typeof LayoutDashboard;
  label: string;
};

const adminLinks: AdminLink[] = [
  { href: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/admin/users', icon: Users, label: 'Users' },
  { href: '/admin/businesses', icon: Building2, label: 'Businesses' },
  { href: '/admin/verifications', icon: ShieldCheck, label: 'Verifications' },
  { href: '/admin/destinations', icon: MapPinned, label: 'Destinations' },
  { href: '/admin/categories', icon: Tags, label: 'Categories' },
  {
    href: '/admin/moderation',
    icon: MessageSquareWarning,
    label: 'Moderation',
  },
  { href: '/admin/reports', icon: Flag, label: 'Reports' },
  { href: '/admin/audit', icon: ClipboardList, label: 'Audit' },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/admin') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Administrator navigation" className="space-y-1">
      {adminLinks.map((item) => {
        const Icon = item.icon;
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              active
                ? 'bg-emerald-50 text-emerald-900'
                : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminAside({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="mb-5 border-b border-slate-200 pb-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Administration
        </p>
        <p className="mt-1 text-sm text-slate-600">Secure operational tools</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AdminNavigation onNavigate={onNavigate} />
      </div>
      <div className="mt-5 border-t border-slate-200 pt-4">
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to EthioTravel
        </Link>
      </div>
    </div>
  );
}

export function AdminWorkspaceShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setDrawerOpen(false);
      menuButtonRef.current?.focus();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-100">
      <div className="mx-auto flex w-full max-w-[96rem]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-300 bg-white p-4 lg:block">
          <AdminAside />
        </aside>
        <main className="min-w-0 flex-1">
          <div className="border-b border-slate-300 bg-white px-4 py-3 sm:px-6 lg:px-8 lg:hidden">
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Open administrator navigation"
              aria-controls="admin-workspace-drawer"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="inline-flex min-h-10 items-center gap-2 rounded-md border border-slate-300 px-3 text-sm font-semibold text-slate-800 transition hover:border-emerald-700 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              Admin menu
            </button>
          </div>
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      {drawerOpen ? (
        <div className="fixed inset-0 z-[1300] lg:hidden">
          <button
            type="button"
            aria-label="Close administrator navigation"
            className="absolute inset-0 bg-slate-950/40"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id="admin-workspace-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Administrator navigation"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-slate-300 bg-white p-4 shadow-2xl"
          >
            <div className="mb-4 flex items-center justify-between border-b border-slate-200 pb-4">
              <p className="font-bold text-slate-950">Admin Portal</p>
              <button
                type="button"
                aria-label="Close administrator navigation"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <AdminAside onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>
      ) : null}
    </div>
  );
}
