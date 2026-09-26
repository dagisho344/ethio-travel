export const supportedLocales = ['en', 'am'] as const;

export type AppLocale = (typeof supportedLocales)[number];

export const defaultLocale: AppLocale = 'en';
export const localeCookieName = 'et_locale';

export const localeCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
};

export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === 'string' && supportedLocales.includes(value as AppLocale)
  );
}

export function resolveLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : defaultLocale;
}

export function intlLocale(locale: AppLocale): 'en-ET' | 'am-ET' {
  return locale === 'am' ? 'am-ET' : 'en-ET';
}
