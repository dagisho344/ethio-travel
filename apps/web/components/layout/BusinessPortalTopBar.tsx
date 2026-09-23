'use client';

import Link from 'next/link';
import { ChevronLeft, Compass } from 'lucide-react';
import { NotificationBell } from '../notifications/NotificationBell';
import { AccountDropdown } from './AccountDropdown';

export function BusinessPortalTopBar({
  authenticated,
  hasAdminDashboard,
  hasBusinessWorkspace,
}: {
  authenticated: boolean;
  hasAdminDashboard: boolean;
  hasBusinessWorkspace: boolean;
}) {
  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-md text-slate-950 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <Compass className="h-6 w-6 text-highland" aria-hidden="true" />
          <span className="text-lg font-bold">EthioTravel</span>
        </Link>
        <span className="hidden border-l border-slate-200 pl-3 text-sm font-semibold text-slate-600 sm:inline">
          Business Portal
        </span>
        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {authenticated ? <NotificationBell /> : null}
          {authenticated ? (
            <AccountDropdown
              authenticated={authenticated}
              hasAdminDashboard={hasAdminDashboard}
              hasBusinessWorkspace={hasBusinessWorkspace}
            />
          ) : null}
          <Link
            href="/"
            className="inline-flex items-center gap-1 rounded-md px-2 py-2 text-sm font-semibold text-highland transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Back to EthioTravel</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
