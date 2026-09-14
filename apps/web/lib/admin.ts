export type AdminPage<T> = {
  data: T[];
  meta: { page: number; total: number; totalPages: number };
};

export type AdminUser = {
  businessMembershipCount: number;
  createdAt: string;
  email: string;
  firstName: string | null;
  id: string;
  lastName: string | null;
  roles: string[];
  status: string;
};

export type AdminBusiness = {
  category: { name: string };
  city: { name: string };
  createdAt: string;
  id: string;
  name: string;
  status: string;
  verificationSummary: string;
};

export type AuditEntry = {
  action: string;
  actor: {
    email: string;
    firstName: string | null;
    id: string;
    lastName: string | null;
  } | null;
  createdAt: string;
  entityId: string | null;
  entityType: string;
  id: string;
  metadata: Record<string, unknown> | null;
  outcome: string;
  reason: string | null;
};

export type AdminDashboard = {
  businesses: {
    active: number;
    draft: number;
    suspended: number;
    total: number;
  };
  recent: {
    adminActions: AuditEntry[];
    businesses: AdminBusiness[];
    users: AdminUser[];
  };
  users: {
    active: number;
    deactivated: number;
    suspended: number;
    total: number;
  };
  verifications: { approved: number; pending: number; rejected: number };
};

export function displayName(user: {
  email: string;
  firstName: string | null;
  lastName: string | null;
}): string {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return name || user.email;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? '—' : date.toLocaleDateString();
}

export function statusClass(status: string): string {
  if (status === 'SUSPENDED' || status === 'REJECTED')
    return 'bg-red-50 text-red-800';
  if (status === 'ACTIVE' || status === 'VERIFIED' || status === 'APPROVED')
    return 'bg-emerald-50 text-emerald-800';
  if (status === 'PENDING' || status === 'DRAFT' || status === 'NOT_SUBMITTED')
    return 'bg-amber-50 text-amber-900';
  return 'bg-slate-100 text-slate-700';
}

export async function adminFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof payload === 'object' &&
      payload !== null &&
      typeof (payload as { message?: unknown }).message === 'string'
        ? (payload as { message: string }).message
        : 'We could not complete that administrator request.';
    throw new Error(message);
  }
  return payload as T;
}
