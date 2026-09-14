import { redirect } from 'next/navigation';
import { AdminWorkspaceShell } from '../../components/admin/AdminWorkspaceShell';
import { currentSessionSnapshot } from '../../lib/auth/session';

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await currentSessionSnapshot();
  if (!session.authenticated) redirect('/login?returnTo=%2Fadmin');
  if (!session.user?.roles.includes('ADMIN')) redirect('/explore');
  return <AdminWorkspaceShell>{children}</AdminWorkspaceShell>;
}
