'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  ChevronLeft,
  CircleAlert,
  CreditCard,
  Image,
  LayoutDashboard,
  LoaderCircle,
  MapPin,
  Menu,
  MessageCircle,
  Settings,
  ShieldCheck,
  Star,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  getManagedBusiness,
  getManagedBusinesses,
  requestErrorMessage,
} from '../../lib/business-management';
import type {
  ManagedBusiness,
  ManagedBusinessesResponse,
} from '../../lib/business-management';

type WorkspaceLink = {
  href: (businessId: string) => string;
  icon: typeof LayoutDashboard;
  label: string;
};

const workspaceLinks: WorkspaceLink[] = [
  {
    href: (businessId) => `/businesses/manage/${businessId}`,
    icon: LayoutDashboard,
    label: 'Overview',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/profile`,
    icon: Building2,
    label: 'Profile',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/locations`,
    icon: MapPin,
    label: 'Locations',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/services`,
    icon: Wrench,
    label: 'Services',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/availability`,
    icon: CircleAlert,
    label: 'Availability',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/bookings`,
    icon: LayoutDashboard,
    label: 'Bookings',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/customers`,
    icon: Users,
    label: 'Customers',
  },
  {
    href: () => '/messages',
    icon: MessageCircle,
    label: 'Messages',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/reviews`,
    icon: Star,
    label: 'Reviews',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/payments`,
    icon: CreditCard,
    label: 'Payments',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/media`,
    icon: Image,
    label: 'Media',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/verification`,
    icon: ShieldCheck,
    label: 'Verification',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/settings`,
    icon: Settings,
    label: 'Settings',
  },
];

function isActive(pathname: string, href: string): boolean {
  if (href === '/messages')
    return pathname === href || pathname.startsWith('/messages/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

function statusClass(status: string): string {
  if (status === 'SUSPENDED') return 'bg-red-50 text-red-800';
  if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-700';
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-800';
  return 'bg-amber-50 text-amber-900';
}

function verificationDescription(
  state: ManagedBusiness['verificationSummary'],
): string {
  if (state === 'NOT_SUBMITTED') return 'Complete verification';
  if (state === 'PENDING') return 'Verification under review';
  if (state === 'VERIFIED') return 'Verified';
  if (state === 'REJECTED') return 'Action required';
  return 'Verification status unavailable';
}

function WorkspaceNavigation({
  businessId,
  onNavigate,
}: {
  businessId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Business workspace navigation" className="space-y-1">
      {workspaceLinks.map((item) => {
        const href = item.href(businessId);
        const Icon = item.icon;
        const active = isActive(pathname, href);
        return (
          <Link
            key={item.label}
            href={href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className={`flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 ${
              active
                ? 'bg-emerald-50 text-highland'
                : 'text-slate-700 hover:bg-slate-50 hover:text-highland'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
            {item.label === 'Messages' ? (
              <span className="ml-auto text-xs font-normal text-slate-400">
                Global
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}

function BusinessSwitcher({
  businessId,
  businesses,
  onNavigate,
}: {
  businessId: string;
  businesses: ManagedBusinessesResponse | null;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      Current business
      <select
        value={businessId}
        onChange={(event) => {
          const nextBusinessId = event.target.value;
          if (nextBusinessId && nextBusinessId !== businessId) {
            onNavigate?.();
            router.push(`/businesses/manage/${nextBusinessId}`);
          }
        }}
        className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold normal-case tracking-normal text-slate-900 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
      >
        <option value={businessId}>
          {businesses?.data.find((item) => item.id === businessId)?.name ??
            'Loading business…'}
        </option>
        {businesses?.data
          .filter((item) => item.id !== businessId)
          .map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
      </select>
    </label>
  );
}

function ShellAside({
  businessId,
  businesses,
  onNavigate,
}: {
  businessId: string;
  businesses: ManagedBusinessesResponse | null;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <BusinessSwitcher
        businessId={businessId}
        businesses={businesses}
        onNavigate={onNavigate}
      />
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1">
        <WorkspaceNavigation businessId={businessId} onNavigate={onNavigate} />
      </div>
      <div className="mt-5 space-y-1 border-t border-slate-200 pt-4">
        <Link
          href="/businesses/manage"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <Building2 className="h-4 w-4" aria-hidden="true" />
          All Businesses
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to EthioTravel
        </Link>
      </div>
    </div>
  );
}

export function BusinessWorkspaceShell({
  businessId,
  children,
}: {
  businessId: string;
  children: React.ReactNode;
}) {
  const [business, setBusiness] = useState<ManagedBusiness | null>(null);
  const [businesses, setBusinesses] =
    useState<ManagedBusinessesResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    setBusiness(null);
    setError(null);
    void Promise.all([
      getManagedBusiness(businessId),
      getManagedBusinesses().catch(() => null),
    ])
      .then(([currentBusiness, managedBusinesses]) => {
        if (!active) return;
        setBusiness(currentBusiness);
        setBusinesses(managedBusinesses);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(
          requestErrorMessage(
            reason,
            'We could not load this business workspace.',
          ),
        );
      });
    return () => {
      active = false;
    };
  }, [businessId]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setDrawerOpen(false);
      menuButtonRef.current?.focus();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const location = business
    ? [business.category.name, business.destination?.name ?? business.city.name]
        .filter(Boolean)
        .join(' · ')
    : null;

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="mx-auto flex w-full max-w-[96rem]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-slate-200 bg-white p-4 lg:block">
          <ShellAside businessId={businessId} businesses={businesses} />
        </aside>
        <div className="min-w-0 flex-1">
          <div className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                  Business workspace
                </p>
                {business ? (
                  <>
                    <h1 className="mt-1 truncate text-xl font-bold text-slate-950 sm:text-2xl">
                      {business.name}
                    </h1>
                    <p className="mt-1 text-sm text-slate-600">
                      {location} · {business.currentMember.role.toLowerCase()}
                    </p>
                  </>
                ) : error ? (
                  <p role="alert" className="mt-1 text-sm text-red-800">
                    {error}
                  </p>
                ) : (
                  <p className="mt-1 flex items-center gap-2 text-sm text-slate-500">
                    <LoaderCircle
                      className="h-4 w-4 animate-spin"
                      aria-hidden="true"
                    />
                    Loading business workspace…
                  </p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {business ? (
                  <>
                    <span
                      className={`hidden rounded-md px-2.5 py-1 text-xs font-semibold sm:inline ${statusClass(business.status)}`}
                    >
                      {business.status}
                    </span>
                    <Link
                      href={`/businesses/manage/${business.id}/verification`}
                      className="hidden rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 sm:inline"
                    >
                      {verificationDescription(business.verificationSummary)}
                    </Link>
                  </>
                ) : null}
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 lg:hidden"
                  aria-label="Open business navigation"
                  aria-controls="business-workspace-drawer"
                  aria-expanded={drawerOpen}
                  onClick={() => setDrawerOpen(true)}
                >
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
          {business?.status === 'SUSPENDED' ? (
            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950 sm:px-6 lg:px-8">
              <strong>Your business listing is suspended.</strong> It is hidden
              from public discovery and cannot receive new bookings. Historical
              bookings, payments, messages, and business information remain
              available.
            </div>
          ) : null}
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[1300] lg:hidden">
          <button
            type="button"
            aria-label="Close business navigation"
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id="business-workspace-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Business workspace navigation"
            className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <p className="font-bold text-slate-950">Business navigation</p>
              <button
                type="button"
                aria-label="Close business navigation"
                onClick={() => setDrawerOpen(false)}
                className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="min-h-0 flex-1 pt-4">
              <ShellAside
                businessId={businessId}
                businesses={businesses}
                onNavigate={() => setDrawerOpen(false)}
              />
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
