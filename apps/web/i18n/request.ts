import { getRequestConfig } from 'next-intl/server';
import { getMessages } from './messages';
import { getRequestLocale } from './server';

export default getRequestConfig(async () => {
  const locale = await getRequestLocale();

  return {
    locale,
    messages: getMessages(locale),
    timeZone: 'Africa/Addis_Ababa',
  };
});
