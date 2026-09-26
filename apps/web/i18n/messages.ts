import am from '../messages/am.json';
import en from '../messages/en.json';
import { defaultLocale, type AppLocale } from './config';

type MessageValue = string | { [key: string]: MessageValue };
type MessageCatalog = Record<string, MessageValue>;

function isMessageCatalog(
  value: MessageValue | undefined,
): value is MessageCatalog {
  return typeof value === 'object' && value !== null;
}

/**
 * English is the canonical catalog. A missing localized leaf deliberately
 * inherits its English value instead of rendering a missing-key placeholder.
 */
function mergeWithEnglishFallback(
  fallback: MessageCatalog,
  localized: MessageCatalog,
): MessageCatalog {
  const result: MessageCatalog = { ...fallback };

  for (const [key, fallbackValue] of Object.entries(fallback)) {
    const localizedValue = localized[key];
    if (typeof fallbackValue === 'string') {
      if (typeof localizedValue === 'string') result[key] = localizedValue;
      continue;
    }
    if (isMessageCatalog(fallbackValue) && isMessageCatalog(localizedValue)) {
      result[key] = mergeWithEnglishFallback(fallbackValue, localizedValue);
    }
  }

  return result;
}

export const messageCatalogs = {
  en,
  am,
} satisfies Record<AppLocale, MessageCatalog>;

export function getMessages(locale: AppLocale): MessageCatalog {
  if (locale === defaultLocale) return en;
  return mergeWithEnglishFallback(en, messageCatalogs[locale]);
}

declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof en;
  }
}
