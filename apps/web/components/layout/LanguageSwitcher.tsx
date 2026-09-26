'use client';

import { Check, ChevronDown, Languages, Loader2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { type RefObject, useEffect, useId, useRef, useState } from 'react';
import { isAppLocale, type AppLocale } from '../../i18n/config';

type LocaleSelection = {
  currentLocale: AppLocale;
  pending: boolean;
  error: string | null;
  selectLocale: (locale: AppLocale) => Promise<boolean>;
};

function useLocaleSelection(): LocaleSelection {
  const router = useRouter();
  const selectedLocale = useLocale();
  const t = useTranslations('locale');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const currentLocale = isAppLocale(selectedLocale) ? selectedLocale : 'en';

  async function selectLocale(locale: AppLocale): Promise<boolean> {
    if (locale === currentLocale || pending) return true;

    setPending(true);
    setError(null);
    try {
      const response = await fetch('/api/locale', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      });
      if (!response.ok) throw new Error('Locale update failed.');

      // Refresh in place: current path and search/map query state are retained.
      router.refresh();
      return true;
    } catch {
      setError(t('changeFailed'));
      return false;
    } finally {
      setPending(false);
    }
  }

  return { currentLocale, pending, error, selectLocale };
}

function localeLabel(
  locale: AppLocale,
  t: ReturnType<typeof useTranslations>,
): string {
  return locale === 'am' ? t('amharic') : t('english');
}

const locales: AppLocale[] = ['en', 'am'];

export function LanguageSwitcher() {
  const t = useTranslations('locale');
  const { currentLocale, error, pending, selectLocale } = useLocaleSelection();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      if (
        open &&
        event.target instanceof Node &&
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target)
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

  async function choose(locale: AppLocale) {
    const changed = await selectLocale(locale);
    if (changed) setOpen(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={open ? t('closeMenu') : t('openMenu')}
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex max-w-32 items-center gap-1 rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <Languages className="h-5 w-5 shrink-0" aria-hidden="true" />
        <span className="hidden truncate sm:inline">
          {localeLabel(currentLocale, t)}
        </span>
        <ChevronDown
          className={`hidden h-4 w-4 shrink-0 transition-transform sm:block ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t('menu')}
          className="absolute right-0 z-[1200] mt-2 flex w-52 max-w-[calc(100vw-1rem)] flex-col rounded-lg border border-slate-200 bg-white p-2 shadow-xl"
        >
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              role="menuitemradio"
              aria-checked={currentLocale === locale}
              disabled={pending}
              onClick={() => {
                void choose(locale);
              }}
              className="i18n-wrap flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{localeLabel(locale, t)}</span>
              {pending ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : currentLocale === locale ? (
                <Check className="h-4 w-4 text-highland" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="sr-only">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type MobileLanguageNavigationProps = {
  buttonRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: () => void;
};

export function MobileLanguageNavigation({
  buttonRef,
  open,
  onOpenChange,
  onNavigate,
}: MobileLanguageNavigationProps) {
  const t = useTranslations('locale');
  const { currentLocale, error, pending, selectLocale } = useLocaleSelection();
  const menuId = useId();

  async function choose(locale: AppLocale) {
    const changed = await selectLocale(locale);
    if (changed) {
      onOpenChange(false);
      onNavigate();
    }
  }

  return (
    <section aria-label={t('mobileMenu')} className="pt-1">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => onOpenChange(!open)}
        className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <span className="inline-flex items-center gap-2">
          <Languages className="h-5 w-5" aria-hidden="true" />
          {t('label')}
        </span>
        <ChevronDown
          className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          aria-label={t('menu')}
          className="mt-1 space-y-1 border-l border-slate-200 pl-2"
        >
          {locales.map((locale) => (
            <button
              key={locale}
              type="button"
              role="menuitemradio"
              aria-checked={currentLocale === locale}
              disabled={pending}
              onClick={() => {
                void choose(locale);
              }}
              className="i18n-wrap flex w-full items-center justify-between gap-3 rounded-md px-2 py-2 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span>{localeLabel(locale, t)}</span>
              {currentLocale === locale ? (
                <Check className="h-4 w-4 text-highland" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
