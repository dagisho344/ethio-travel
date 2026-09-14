'use client';

import { usePathname } from 'next/navigation';
import { AdminPortalTopBar } from './AdminPortalTopBar';
import { BusinessPortalTopBar } from './BusinessPortalTopBar';

function isAdminPortalPath(pathname: string): boolean {
  return pathname === '/admin' || pathname.startsWith('/admin/');
}

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
  const isAdminPortal = isAdminPortalPath(pathname);
  const nonBusinessFooter = isBusinessPortal ? null : footer;

  return (
    <>
      {isAdminPortal ? (
        <AdminPortalTopBar authenticated={authenticated} />
      ) : isBusinessPortal ? (
        <BusinessPortalTopBar authenticated={authenticated} />
      ) : (
        header
      )}
      {children}
      {isAdminPortal ? null : nonBusinessFooter}
    </>
  );
}
