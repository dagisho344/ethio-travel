import Link from 'next/link';
import { Compass, Menu } from 'lucide-react';
import { Container } from '../ui/Container';

const links = [
  { href: '/', label: 'Home' },
  { href: '/explore', label: 'Explore' },
  { href: '/destinations', label: 'Destinations' },
  { href: '/businesses', label: 'Businesses' },
  { href: '/services', label: 'Services' },
];

export function Header() {
  return (
    <header className="sticky top-0 z-[1100] border-b border-slate-200 bg-white/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
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

        <nav
          className="hidden flex-1 items-center justify-center gap-7 px-8 text-sm font-medium text-slate-700 lg:flex"
          aria-label="Primary navigation"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="whitespace-nowrap rounded-md px-1 py-2 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden shrink-0 items-center gap-3 lg:flex">
          <Link
            href="/login"
            className="whitespace-nowrap rounded-md px-2 py-2 text-sm font-semibold text-slate-700 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            Sign In
          </Link>
          <Link
            href="/register"
            className="whitespace-nowrap rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            Register
          </Link>
        </div>

        <details className="relative lg:hidden">
          <summary
            aria-label="Open navigation menu"
            className="flex cursor-pointer list-none items-center justify-center rounded-md border border-slate-200 p-2 text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 [&::-webkit-details-marker]:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </summary>
          <div className="absolute right-0 mt-3 w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland"
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2 border-t border-slate-100 pt-2">
              <Link
                href="/login"
                className="block rounded-md px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="mt-1 block rounded-md bg-highland px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland"
              >
                Register
              </Link>
            </div>
          </div>
        </details>
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
          {links.slice(1).map((link) => (
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

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      {children}
      <Footer />
    </>
  );
}
