import Link from 'next/link';
import { Compass } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import { HeaderNavigation } from './HeaderNavigation';
import { RealtimeProvider } from '../realtime/RealtimeProvider';
import { RouteAwareChrome } from './RouteAwareChrome';
import { currentSessionSnapshot } from '../../lib/auth/session';
import { Container } from '../ui/Container';

type HeaderProps = {
  session: Pick<
    Awaited<ReturnType<typeof currentSessionSnapshot>>,
    'authenticated' | 'hasBusinessWorkspace' | 'user'
  >;
};

export function Header({
  session,
  publicLinks,
  otherPublicLinks,
}: HeaderProps & {
  publicLinks: { href: string; label: string }[];
  otherPublicLinks: { href: string; label: string }[];
}) {
  const hasAdminDashboard =
    session.authenticated && session.user?.roles.includes('ADMIN') === true;

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
          hasAdminDashboard={hasAdminDashboard}
          hasBusinessWorkspace={session.hasBusinessWorkspace}
          otherPublicLinks={otherPublicLinks}
          publicLinks={publicLinks}
        />
      </Container>
    </header>
  );
}
export function Footer({
  footerPublicLinks,
  description,
  navigationLabel,
  aboutLabel,
  copyrightLabel,
}: {
  footerPublicLinks: { href: string; label: string }[];
  description: string;
  navigationLabel: string;
  aboutLabel: string;
  copyrightLabel: string;
}) {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <Container className="grid gap-6 py-10 text-sm text-slate-600 md:grid-cols-2">
        <div>
          <p className="font-bold text-slate-950">EthioTravel</p>
          <p className="i18n-wrap mt-2 max-w-md">{description}</p>
        </div>
        <nav
          className="flex flex-wrap gap-4 md:justify-end"
          aria-label={navigationLabel}
        >
          {footerPublicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-highland"
            >
              {link.label}
            </Link>
          ))}
          <span>{aboutLabel}</span>
        </nav>
        <p className="md:col-span-2">{copyrightLabel}</p>
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
  const navigation = await getTranslations('navigation');
  const footer = await getTranslations('footer');
  const hasAdminDashboard =
    session.authenticated && session.user?.roles.includes('ADMIN') === true;
  const publicLinks = [
    { href: '/', label: navigation('home') },
    { href: '/search', label: navigation('explore') },
    { href: '/destinations', label: navigation('destinations') },
    { href: '/businesses', label: navigation('businesses') },
    { href: '/services', label: navigation('services') },
  ];
  const otherPublicLinks = [
    { href: '/search', label: navigation('search') },
    { href: '/search?view=map', label: navigation('map') },
    { href: '/hotels', label: navigation('hotels') },
    { href: '/restaurants', label: navigation('restaurants') },
    { href: '/tours', label: navigation('tours') },
    { href: '/transport', label: navigation('transport') },
  ];
  const footerPublicLinks = [
    ...publicLinks.slice(1),
    ...otherPublicLinks.slice(1),
  ];

  return (
    <RealtimeProvider enabled={session.authenticated}>
      <RouteAwareChrome
        authenticated={session.authenticated}
        hasAdminDashboard={hasAdminDashboard}
        hasBusinessWorkspace={session.hasBusinessWorkspace}
        header={
          <Header
            session={session}
            publicLinks={publicLinks}
            otherPublicLinks={otherPublicLinks}
          />
        }
        footer={
          <Footer
            footerPublicLinks={footerPublicLinks}
            description={footer('description')}
            navigationLabel={footer('navigation')}
            aboutLabel={footer('about')}
            copyrightLabel={footer('copyright')}
          />
        }
      >
        {children}
      </RouteAwareChrome>
    </RealtimeProvider>
  );
}
