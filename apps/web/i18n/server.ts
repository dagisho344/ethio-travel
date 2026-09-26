import { cookies } from 'next/headers';
import { localeCookieName, resolveLocale, type AppLocale } from './config';

export async function getRequestLocale(): Promise<AppLocale> {
  const cookieStore = await cookies();
  return resolveLocale(cookieStore.get(localeCookieName)?.value);
}
