'use client';

import { usePathname } from 'next/navigation';
import { BusinessPortalTopBar } from './BusinessPortalTopBar';

function isBusinessPortalPath(pathname: string): boolean {
  return (
    pathname === '/businesses/manage' ||
    pathname.startsWith('/businesses/manage/')
  );
}

export function RouteAwareChrome({
  authenticated,
  children,
  footer,
  header,
}: {
  authenticated: boolean;
  children: React.ReactNode;
  footer: React.ReactNode;
  header: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBusinessPortal = isBusinessPortalPath(pathname);

  return (
    <>
      {isBusinessPortal ? (
        <BusinessPortalTopBar authenticated={authenticated} />
      ) : (
        header
      )}
      {children}
      {isBusinessPortal ? null : footer}
    </>
  );
}
