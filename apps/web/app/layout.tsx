import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EthioTravel',
  description: 'Verified travel discovery and local services across Ethiopia.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
