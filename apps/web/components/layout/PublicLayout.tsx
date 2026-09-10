import Link from 'next/link';
import { Compass } from 'lucide-react';
import { HeaderNavigation } from './HeaderNavigation';
import { RealtimeProvider } from '../realtime/RealtimeProvider';
import { currentSessionSnapshot } from '../../lib/auth/session';
import { Container } from '../ui/Container';

const publicLinks = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/businesses', label: 'Businesses' },
  { href: '/services', label: 'Services' },
];

const authenticatedLinks = [
  { href: '/trips', label: 'My Trips' },
  { href: '/messages', label: 'Messages' },
  { href: '/assistant', label: 'AI Assistant' },
];
export async function Header() {
  const session = await currentSessionSnapshot();

  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center gap-4 sm:gap-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 whitespace-nowrap text-lg font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <Compass
            className="h-6 w-6 shrink-0 text-highland"
            aria-hidden="true"
          />
          <span>EthioTravel</span>
        </Link>
        <HeaderNavigation
          authenticated={session.authenticated}
          publicLinks={publicLinks}
          authenticatedLinks={authenticatedLinks}
        />
      </Container>
    </header>
  );
}
export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="grid gap-6 py-10 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <p className="font-bold text-slate-950">EthioTravel</p>
          <p className="mt-2 max-w-md">
            Discover destinations, verified local businesses, services and
            attractions across Ethiopia.
          </p>
        </div>
        <nav
          className="flex flex-wrap gap-4 md:justify-end"
          aria-label="Footer navigation"
        >
          {publicLinks.slice(1).map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-highland"
            >
              {link.label}
            </Link>
          ))}
          <span>About EthioTravel</span>
        </nav>
        <p className="md:col-span-2">Copyright 2026 EthioTravel.</p>
      </Container>
    </footer>
  );
}

export async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await currentSessionSnapshot();
  return (
    <RealtimeProvider enabled={session.authenticated}>
      <Header />
      {children}
      <Footer />
    </RealtimeProvider>
  );
}
