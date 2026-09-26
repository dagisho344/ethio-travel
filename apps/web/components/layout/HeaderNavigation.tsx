'use client';

import Link from 'next/link';
import { ChevronDown, Menu, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { NotificationBell } from '../notifications/NotificationBell';
import { AccountDropdown, MobileAccountNavigation } from './AccountDropdown';
import { LanguageSwitcher, MobileLanguageNavigation } from './LanguageSwitcher';

type NavigationLink = {
  href: string;
  label: string;
};

type HeaderNavigationProps = {
  authenticated: boolean;
  hasAdminDashboard: boolean;
  hasBusinessWorkspace: boolean;
  publicLinks: NavigationLink[];
  otherPublicLinks: NavigationLink[];
};

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
  hasAdminDashboard,
  hasBusinessWorkspace,
  publicLinks,
  otherPublicLinks,
}: HeaderNavigationProps) {
  const pathname = usePathname();
  const t = useTranslations('navigation');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);
  const [mobileOthersOpen, setMobileOthersOpen] = useState(false);
  const [mobileAccountOpen, setMobileAccountOpen] = useState(false);
  const [mobileLanguageOpen, setMobileLanguageOpen] = useState(false);
  const othersRef = useRef<HTMLDivElement>(null);
  const othersButtonRef = useRef<HTMLButtonElement>(null);
  const mobileRef = useRef<HTMLDivElement>(null);
  const mobileButtonRef = useRef<HTMLButtonElement>(null);
  const mobileAccountButtonRef = useRef<HTMLButtonElement>(null);
  const mobileLanguageButtonRef = useRef<HTMLButtonElement>(null);

  const navigationLinks = publicLinks;
  const othersActive = otherPublicLinks.some((link) =>
    isActive(pathname, link.href),
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!(event.target instanceof Node)) return;

      if (othersRef.current && !othersRef.current.contains(event.target)) {
        setOthersOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(event.target)) {
        setMobileOpen(false);
        setMobileOthersOpen(false);
        setMobileAccountOpen(false);
        setMobileLanguageOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      const wasOthersOpen = othersOpen;
      const wasMobileOpen = mobileOpen;
      const wasMobileAccountOpen = mobileAccountOpen;
      const wasMobileLanguageOpen = mobileLanguageOpen;
      setOthersOpen(false);
      setMobileOthersOpen(false);
      setMobileAccountOpen(false);
      setMobileLanguageOpen(false);
      if (wasMobileAccountOpen) {
        mobileAccountButtonRef.current?.focus();
        return;
      }
      if (wasMobileLanguageOpen) {
        mobileLanguageButtonRef.current?.focus();
        return;
      }
      setMobileOpen(false);
      if (wasOthersOpen) {
        othersButtonRef.current?.focus();
      } else if (wasMobileOpen) {
        mobileButtonRef.current?.focus();
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileAccountOpen, mobileLanguageOpen, mobileOpen, othersOpen]);

  return (
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3">
      <nav
        className="hidden min-w-0 flex-1 items-center justify-center gap-1 px-2 text-sm lg:flex xl:gap-2 xl:px-6"
        aria-label={t('primary')}
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
        <div ref={othersRef} className="relative">
          <button
            ref={othersButtonRef}
            type="button"
            aria-expanded={othersOpen}
            aria-controls="other-navigation-menu"
            aria-haspopup="true"
            onClick={() => {
              setOthersOpen((open) => !open);
            }}
            className={`inline-flex items-center gap-1 ${linkClass(othersActive)}`}
          >
            <span>{t('others')}</span>
            <ChevronDown
              className={`h-4 w-4 transition-transform ${othersOpen ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
          {othersOpen ? (
            <nav
              id="other-navigation-menu"
              aria-label={t('more')}
              className="absolute left-0 z-[1200] mt-2 flex w-48 max-w-[calc(100vw-1rem)] flex-col rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
            >
              {otherPublicLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={
                    isActive(pathname, link.href) ? 'page' : undefined
                  }
                  onClick={() => setOthersOpen(false)}
                  className={`block ${linkClass(isActive(pathname, link.href))}`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          ) : null}
        </div>
      </nav>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        <div className="hidden lg:block">
          <LanguageSwitcher />
        </div>
        {authenticated ? <NotificationBell /> : null}

        {authenticated ? (
          <div className="hidden lg:block">
            <AccountDropdown
              authenticated={authenticated}
              hasAdminDashboard={hasAdminDashboard}
              hasBusinessWorkspace={hasBusinessWorkspace}
            />
          </div>
        ) : (
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className={linkClass(isActive(pathname, '/login'))}
            >
              {t('signIn')}
            </Link>
            <Link
              href="/register"
              className="whitespace-nowrap rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            >
              {t('join')}
            </Link>
          </div>
        )}

        <div ref={mobileRef} className="relative lg:hidden">
          <button
            ref={mobileButtonRef}
            type="button"
            aria-expanded={mobileOpen}
            aria-controls="mobile-navigation"
            aria-label={mobileOpen ? t('closeMenu') : t('openMenu')}
            onClick={() => {
              setMobileOpen((open) => !open);
              setMobileOthersOpen(false);
              setMobileAccountOpen(false);
              setMobileLanguageOpen(false);
            }}
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
              className="absolute right-0 z-[1200] mt-3 max-h-[calc(100dvh-5rem)] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-lg border border-slate-200 bg-white p-3 shadow-xl"
            >
              <nav aria-label={t('mobilePrimary')} className="space-y-1">
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
                <div className="pt-1">
                  <button
                    type="button"
                    aria-expanded={mobileOthersOpen}
                    aria-controls="mobile-other-navigation"
                    onClick={() => {
                      setMobileOthersOpen((open) => !open);
                      setMobileAccountOpen(false);
                      setMobileLanguageOpen(false);
                    }}
                    className={`flex w-full items-center justify-between ${linkClass(othersActive)}`}
                  >
                    <span>{t('others')}</span>
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${mobileOthersOpen ? 'rotate-180' : ''}`}
                      aria-hidden="true"
                    />
                  </button>
                  {mobileOthersOpen ? (
                    <div
                      id="mobile-other-navigation"
                      className="mt-1 space-y-1 border-l border-slate-200 pl-2"
                    >
                      {otherPublicLinks.map((link) => (
                        <Link
                          key={link.href}
                          href={link.href}
                          aria-current={
                            isActive(pathname, link.href) ? 'page' : undefined
                          }
                          onClick={() => {
                            setMobileOpen(false);
                            setMobileOthersOpen(false);
                          }}
                          className={`block ${linkClass(isActive(pathname, link.href))}`}
                        >
                          {link.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
              </nav>
              <MobileLanguageNavigation
                buttonRef={mobileLanguageButtonRef}
                open={mobileLanguageOpen}
                onOpenChange={(open) => {
                  setMobileLanguageOpen(open);
                  if (open) {
                    setMobileOthersOpen(false);
                    setMobileAccountOpen(false);
                  }
                }}
                onNavigate={() => {
                  setMobileOpen(false);
                  setMobileOthersOpen(false);
                  setMobileAccountOpen(false);
                  setMobileLanguageOpen(false);
                }}
              />
              <div className="mt-3 border-t border-slate-100 pt-3">
                {authenticated ? (
                  <>
                    <MobileAccountNavigation
                      authenticated={authenticated}
                      hasAdminDashboard={hasAdminDashboard}
                      hasBusinessWorkspace={hasBusinessWorkspace}
                      buttonRef={mobileAccountButtonRef}
                      open={mobileAccountOpen}
                      onOpenChange={(open) => {
                        setMobileAccountOpen(open);
                        if (open) {
                          setMobileOthersOpen(false);
                          setMobileLanguageOpen(false);
                        }
                      }}
                      onNavigate={() => {
                        setMobileOpen(false);
                        setMobileOthersOpen(false);
                        setMobileAccountOpen(false);
                        setMobileLanguageOpen(false);
                      }}
                    />
                  </>
                ) : (
                  <div className="space-y-1">
                    <Link
                      href="/login"
                      onClick={() => setMobileOpen(false)}
                      className={`block ${linkClass(isActive(pathname, '/login'))}`}
                    >
                      {t('signIn')}
                    </Link>
                    <Link
                      href="/register"
                      onClick={() => setMobileOpen(false)}
                      className="block rounded-md bg-highland px-3 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                    >
                      {t('join')}
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
