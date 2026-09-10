'use client';

import Link from 'next/link';
import { ChevronDown, Menu, UserRound, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LogoutButton } from '../auth/LogoutButton';
import { NotificationBell } from '../notifications/NotificationBell';

type NavigationLink = {
  href: string;
  label: string;
};

type HeaderNavigationProps = {
  authenticated: boolean;
  publicLinks: NavigationLink[];
  authenticatedLinks: NavigationLink[];
};

const businessOnboardingHref = '/login?returnTo=%2Fbusiness%2Fonboarding';

const accountLinks: NavigationLink[] = [
  { href: '/business/onboarding', label: 'List Your Business' },
  { href: '/bookings', label: 'My Bookings' },
  { href: '/favorites', label: 'Favorites' },
  { href: '/reviews', label: 'My Reviews' },
  { href: '/account', label: 'Account' },
];

function isActive(pathname: string, href: string): boolean {
  return href === '/'
    ? pathname === href
    : pathname.startsWith(`${href}/`) || pathname === href;
}

function linkClass(active: boolean): string {
  return `whitespace-nowrap rounded-md px-2 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 ${
    active
      ? 'bg-emerald-50 text-highland'
      : 'text-slate-700 hover:bg-slate-50 hover:text-highland'
  }`;
}

export function HeaderNavigation({
  authenticated,
  publicLinks,
  authenticatedLinks,
}: HeaderNavigationProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const profileButtonRef = useRef<HTMLButtonElement>(null);

  const navigationLinks = authenticated
    ? [...publicLinks, ...authenticatedLinks]
    : publicLinks;

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (
        profileRef.current &&
        event.target instanceof Node &&
        !profileRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const wasProfileOpen = profileOpen;
      setProfileOpen(false);
      setMobileOpen(false);
      if (wasProfileOpen) profileButtonRef.current?.focus();
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileOpen]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
      <nav
        className="hidden min-w-0 flex-1 items-center justify-center gap-1 px-2 text-sm lg:flex xl:gap-2 xl:px-6"
        aria-label="Primary navigation"
      >
        {navigationLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive(pathname, link.href) ? 'page' : undefined}
            className={linkClass(isActive(pathname, link.href))}
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {authenticated ? <NotificationBell /> : null}

        {authenticated ? (
          <div ref={profileRef} className="relative hidden lg:block">
            <button
              ref={profileButtonRef}
              type="button"
              aria-expanded={profileOpen}
              aria-controls="profile-menu"
              aria-haspopup="menu"
              onClick={() => setProfileOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            >
              <UserRound className="h-5 w-5" aria-hidden="true" />
              <span>Account</span>
              <ChevronDown
                className={`h-4 w-4 transition-transform ${profileOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {profileOpen ? (
              <div
                id="profile-menu"
                role="menu"
                aria-label="Account menu"
                className="absolute right-0 z-[1200] mt-2 flex w-52 max-w-[calc(100vw-1rem)] flex-col items-stretch rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
              >
                {accountLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    onClick={() => setProfileOpen(false)}
                    className={`block w-full text-left ${linkClass(isActive(pathname, link.href))}`}
                  >
                    {link.label}
                  </Link>
                ))}
                <div className="my-2 border-t border-slate-100" />
                <div className="w-full" onClick={() => setProfileOpen(false)}>
                  <LogoutButton className="block w-full rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href={businessOnboardingHref}
              className="hidden whitespace-nowrap rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 xl:inline-flex"
            >
              List Your Business
            </Link>
            <Link
              href="/login"
              className={linkClass(isActive(pathname, '/login'))}
            >
              Sign In
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            >
              Register
            </Link>
          </div>
        )}

        <div className="relative lg:hidden">
          <button
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={
              mobileOpen ? 'Close navigation menu' : 'Open navigation menu'
            }
            onClick={() => setMobileOpen((open) => !open)}
            className="flex items-center justify-center rounded-md border border-slate-200 p-2 text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
          {mobileOpen ? (
            <div
              id="mobile-navigation"
              className="absolute right-0 z-[1200] mt-3 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
            >
              <nav aria-label="Mobile primary navigation" className="space-y-1">
                {navigationLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={
                      isActive(pathname, link.href) ? 'page' : undefined
                    }
                    onClick={() => setMobileOpen(false)}
                    className={`block ${linkClass(isActive(pathname, link.href))}`}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <div className="mt-3 border-t border-slate-100 pt-3">
                {authenticated ? (
                  <>
                    <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Account
                    </p>
                    <div className="space-y-1">
                      {accountLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          onClick={() => setMobileOpen(false)}
                          className={`block ${linkClass(isActive(pathname, link.href))}`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                    <div className="my-3 border-t border-slate-100" />
                    <div onClick={() => setMobileOpen(false)}>
                      <LogoutButton className="block w-full rounded-md bg-highland px-3 py-2.5 text-left text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" />
                    </div>
                  </>
                ) : (
                  <div className="space-y-1">
                    <Link
                      href={businessOnboardingHref}
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                    >
                      List Your Business
                    </Link>
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className={`block ${linkClass(isActive(pathname, '/login'))}`}
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md bg-highland px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                    >
                      Register
                    </Link>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
