import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { PublicLayout } from '../components/layout/PublicLayout';
import { getMessages } from '../i18n/messages';
import { getRequestLocale } from '../i18n/server';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.css';
import 'react-leaflet-cluster/dist/assets/MarkerCluster.Default.css';

export const metadata: Metadata = {
  title: 'EthioTravel',
  description: 'Verified travel discovery and local services across Ethiopia.',
};
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();
  const messages = getMessages(locale);

  return (
    <html lang={locale} dir="ltr">
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PublicLayout>{children}</PublicLayout>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
