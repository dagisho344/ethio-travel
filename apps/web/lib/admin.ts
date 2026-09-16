import type { Booking, Payment } from './types';

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

export type AdminDestination = {
  cityId: string;
  createdAt: string;
  fullDescription: string;
  id: string;
  latitude: string | number;
  longitude: string | number;
  name: string;
  shortDescription: string;
  slug: string;
  status: string;
  travelInfo: Record<string, unknown> | null;
  updatedAt: string;
};

export type AdminCity = {
  id: string;
  name: string;
  status: string;
};

export type AdminCategory = {
  code: string;
  createdAt: string;
  description: string | null;
  id: string;
  isActive: boolean;
  name: string;
  sortOrder: number;
  updatedAt: string;
};

export type AdminReview = {
  author: { displayName: string; id: string; status: string };
  body: string | null;
  businessResponse: {
    body: string;
    createdAt: string;
    updatedAt: string;
  } | null;
  createdAt: string;
  id: string;
  moderationNote: string | null;
  rating: number;
  status: string;
  target: { id: string; name: string; type: string };
  title: string | null;
};

export type AdminReport = {
  assignedAdmin: { displayName: string; id: string } | null;
  createdAt: string;
  details?: string | null;
  id: string;
  reason: string;
  reporter: { displayName: string; id: string; status: string };
  resolution: string | null;
  resolvedAt: string | null;
  status: string;
  target?: {
    displayName?: string;
    id: string;
    name?: string;
    rating?: number;
    status: string;
    type: string;
  } | null;
  targetId: string;
  targetType: string;
  updatedAt: string;
};

export type ModerationSummary = {
  recentActions: AuditEntry[];
  reports: {
    dismissed: number;
    open: number;
    resolved: number;
    underReview: number;
  };
  reviews: { hidden: number; pending: number };
};

export type AdminBooking = Booking & {
  auditTrail: AuditEntry[];
  payments: Array<{
    amount: string | number;
    createdAt: string;
    currency: string;
    id: string;
    paidAt: string | null;
    status: string;
  }>;
};

export type AdminPayment = Payment & {
  auditTrail: AuditEntry[];
};

export type AdminAnalytics = {
  businesses: {
    active: number;
    draft: number;
    pendingVerification: number;
    rejectedVerification: number;
    suspended: number;
    total: number;
    verified: number;
  };
  bookings: {
    cancelled: number;
    completed: number;
    confirmed: number;
    pending: number;
    recentVolume: number;
    total: number;
  };
  content: {
    openReports: number;
    pendingVerifications: number;
    publishedDestinations: number;
    publishedReviews: number;
  };
  payments: {
    byStatus: {
      failed: number;
      paid: number;
      partiallyRefunded: number;
      pending: number;
      refunded: number;
    };
    revenueByCurrency: Array<{
      currency: string;
      gross: string;
      net: string;
      refunded: string;
    }>;
  };
  users: {
    active: number;
    deactivated: number;
    recentRegistrations: number;
    suspended: number;
    total: number;
  };
};

export type PlatformSettings = {
  supportEmail: string | null;
  supportMessage: string | null;
  supportPhone: string | null;
  updatedAt: string | null;
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
