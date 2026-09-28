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
import { useTranslations } from 'next-intl';
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
  label: BusinessPortalNavigationKey;
};

type BusinessPortalNavigationKey =
  | 'overview'
  | 'profile'
  | 'locations'
  | 'services'
  | 'availability'
  | 'bookings'
  | 'customers'
  | 'messages'
  | 'reviews'
  | 'payments'
  | 'media'
  | 'verification'
  | 'settings';

const workspaceLinks: WorkspaceLink[] = [
  {
    href: (businessId) => `/businesses/manage/${businessId}`,
    icon: LayoutDashboard,
    label: 'overview',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/profile`,
    icon: Building2,
    label: 'profile',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/locations`,
    icon: MapPin,
    label: 'locations',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/services`,
    icon: Wrench,
    label: 'services',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/availability`,
    icon: CircleAlert,
    label: 'availability',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/bookings`,
    icon: LayoutDashboard,
    label: 'bookings',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/customers`,
    icon: Users,
    label: 'customers',
  },
  {
    href: () => '/messages',
    icon: MessageCircle,
    label: 'messages',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/reviews`,
    icon: Star,
    label: 'reviews',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/payments`,
    icon: CreditCard,
    label: 'payments',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/media`,
    icon: Image,
    label: 'media',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/verification`,
    icon: ShieldCheck,
    label: 'verification',
  },
  {
    href: (businessId) => `/businesses/manage/${businessId}/settings`,
    icon: Settings,
    label: 'settings',
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
  t: ReturnType<typeof useTranslations<'businessPortal'>>,
): string {
  if (state === 'NOT_SUBMITTED') return t('verificationComplete');
  if (state === 'PENDING') return t('verificationPending');
  if (state === 'VERIFIED') return t('verificationVerified');
  if (state === 'REJECTED') return t('verificationActionRequired');
  return t('verificationUnavailable');
}

function WorkspaceNavigation({
  businessId,
  onNavigate,
}: {
  businessId: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const t = useTranslations('businessPortal');
  return (
    <nav aria-label={t('navigation')} className="space-y-1">
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
            {t(item.label)}
            {item.label === 'messages' ? (
              <span className="ml-auto text-xs font-normal text-slate-400">
                {t('global')}
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
  const t = useTranslations('businessPortal');
  return (
    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
      {t('currentBusiness')}
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
            t('loadingBusiness')}
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
  const t = useTranslations('businessPortal');
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
          {t('allBusinesses')}
        </Link>
        <Link
          href="/"
          onClick={onNavigate}
          className="flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t('backToEthioTravel')}
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
  const t = useTranslations('businessPortal');
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
        setError(requestErrorMessage(reason, t('loadWorkspaceError')));
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
                  {t('workspace')}
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
                    {t('loadingWorkspace')}
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
                      {verificationDescription(business.verificationSummary, t)}
                    </Link>
                  </>
                ) : null}
                <button
                  ref={menuButtonRef}
                  type="button"
                  className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-md border border-slate-200 text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 lg:hidden"
                  aria-label={t('openNavigation')}
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
              {t('suspendedNotice')}
            </div>
          ) : null}
          <div className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</div>
        </div>
      </div>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[1300] lg:hidden">
          <button
            type="button"
            aria-label={t('closeNavigation')}
            className="absolute inset-0 bg-slate-950/35"
            onClick={() => setDrawerOpen(false)}
          />
          <aside
            id="business-workspace-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={t('navigation')}
            className="absolute inset-y-0 left-0 flex w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-4">
              <p className="font-bold text-slate-950">{t('navigationTitle')}</p>
              <button
                type="button"
                aria-label={t('closeNavigation')}
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
