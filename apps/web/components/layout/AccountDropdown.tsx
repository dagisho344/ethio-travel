'use client';

import { ChevronDown, UserRound } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { LogoutButton } from '../auth/LogoutButton';

type NavigationLink = {
  href: string;
  label: string;
};

type AccountNavigationOptions = {
  hasAdminDashboard: boolean;
  hasBusinessWorkspace: boolean;
};

type AccountTranslationKey =
  | 'profile'
  | 'trips'
  | 'assistant'
  | 'messages'
  | 'adminDashboard'
  | 'businessDashboard'
  | 'listBusiness'
  | 'bookings'
  | 'favorites'
  | 'reviews';

type AccountTranslator = (key: AccountTranslationKey) => string;

export function accountNavigationLinks(
  { hasAdminDashboard, hasBusinessWorkspace }: AccountNavigationOptions,
  t: AccountTranslator,
): NavigationLink[] {
  return [
    { href: '/account', label: t('profile') },
    { href: '/trips', label: t('trips') },
    { href: '/assistant', label: t('assistant') },
    { href: '/messages', label: t('messages') },
    ...(hasAdminDashboard
      ? [{ href: '/admin', label: t('adminDashboard') }]
      : []),
    ...(hasBusinessWorkspace
      ? [{ href: '/businesses/manage', label: t('businessDashboard') }]
      : []),
    { href: '/business/onboarding', label: t('listBusiness') },
    { href: '/bookings', label: t('bookings') },
    { href: '/favorites', label: t('favorites') },
    { href: '/reviews', label: t('reviews') },
  ];
}

function isActive(pathname: string, href: string): boolean {
  return href === '/'
    ? pathname === href
    : pathname.startsWith(`${href}/`) || pathname === href;
}

function linkClass(active: boolean): string {
  return `block w-full rounded-md px-2 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 ${
    active
      ? 'bg-emerald-50 text-highland'
      : 'text-slate-700 hover:bg-slate-50 hover:text-highland'
  }`;
}

type AccountDropdownProps = AccountNavigationOptions & {
  authenticated: boolean;
  onNavigate?: () => void;
};

type MobileAccountNavigationProps = AccountDropdownProps & {
  buttonRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/**
 * Shared signed-in account navigation. Visibility hints are server-derived
 * convenience only; the destination routes retain their own authorization.
 */
export function AccountDropdown({
  authenticated,
  hasAdminDashboard,
  hasBusinessWorkspace,
  onNavigate,
}: AccountDropdownProps) {
  const pathname = usePathname();
  const t = useTranslations('account');
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const links = accountNavigationLinks(
    {
      hasAdminDashboard,
      hasBusinessWorkspace,
    },
    t,
  );

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        open &&
        event.target instanceof Node &&
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target)
      ) {
        setOpen(false);
      }
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !open) return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  if (!authenticated) return null;

  function closeMenu() {
    setOpen(false);
    onNavigate?.();
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? t('closeMenu') : t('openMenu')}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">{t('label')}</span>
        <ChevronDown
          className={`hidden h-4 w-4 transition-transform sm:block ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t('menu')}
          className="absolute right-0 z-[1200] mt-2 flex w-56 max-w-[calc(100vw-1rem)] flex-col items-stretch rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              aria-current={isActive(pathname, link.href) ? 'page' : undefined}
              onClick={closeMenu}
              className={linkClass(isActive(pathname, link.href))}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 border-t border-slate-100" />
          <div className="w-full" onClick={closeMenu}>
            <LogoutButton
              label={t('logout')}
              loadingLabel={t('signingOut')}
              className="block w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The mobile account navigation stays in the hamburger panel so its links
 * remain visible and reachable without a nested floating popup.
 */
export function MobileAccountNavigation({
  authenticated,
  hasAdminDashboard,
  hasBusinessWorkspace,
  onNavigate,
  buttonRef,
  open,
  onOpenChange,
}: MobileAccountNavigationProps) {
  const pathname = usePathname();
  const t = useTranslations('account');
  const menuId = useId();
  const links = accountNavigationLinks(
    {
      hasAdminDashboard,
      hasBusinessWorkspace,
    },
    t,
  );

  if (!authenticated) return null;

  function closeMenu() {
    onOpenChange(false);
    onNavigate?.();
  }

  return (
    <section aria-label={t('mobileMenu')}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <span className="inline-flex items-center gap-2">
          <UserRound className="h-5 w-5" aria-hidden="true" />
          {t('label')}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <nav
          id={menuId}
          aria-label={t('mobileMenu')}
          className="mt-1 space-y-1 border-l border-slate-200 pl-2"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={isActive(pathname, link.href) ? 'page' : undefined}
              onClick={closeMenu}
              className={linkClass(isActive(pathname, link.href))}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-2 border-t border-slate-100" />
          <div className="w-full" onClick={closeMenu}>
            <LogoutButton
              label={t('logout')}
              loadingLabel={t('signingOut')}
              className="block w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>
        </nav>
      ) : null}
    </section>
  );
}
