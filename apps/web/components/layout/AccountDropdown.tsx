'use client';

import { ChevronDown, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import { LogoutButton } from '../auth/LogoutButton';

type NavigationLink = {
  href: string;
  label: string;
};

type AccountNavigationOptions = {
  hasAdminDashboard: boolean;
  hasBusinessWorkspace: boolean;
};

const accountLinks: NavigationLink[] = [
  { href: '/account', label: 'My Profile' },
  { href: '/trips', label: 'My Trips' },
  { href: '/assistant', label: 'AI Assistant' },
  { href: '/messages', label: 'Messages' },
];

const additionalAccountLinks: NavigationLink[] = [
  { href: '/business/onboarding', label: 'List Your Business' },
  { href: '/bookings', label: 'My Bookings' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/reviews', label: 'My Reviews' },
];

export function accountNavigationLinks({
  hasAdminDashboard,
  hasBusinessWorkspace,
}: AccountNavigationOptions): NavigationLink[] {
  return [
    ...accountLinks,
    ...(hasAdminDashboard
      ? [{ href: '/admin', label: 'Admin Dashboard' }]
      : []),
    ...(hasBusinessWorkspace
      ? [{ href: '/businesses/manage', label: 'Business Dashboard' }]
      : []),
    ...additionalAccountLinks,
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
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const links = accountNavigationLinks({
    hasAdminDashboard,
    hasBusinessWorkspace,
  });

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
        aria-label={open ? 'Close account menu' : 'Open account menu'}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <UserRound className="h-5 w-5" aria-hidden="true" />
        <span className="hidden sm:inline">Account</span>
        <ChevronDown
          className={`hidden h-4 w-4 transition-transform sm:block ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label="Account menu"
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
            <LogoutButton className="block w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
