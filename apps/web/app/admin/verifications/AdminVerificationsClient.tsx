'use client';

import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getAdminVerifications } from '../../../lib/admin-verifications';
import type { AdminVerification } from '../../../lib/admin-verifications';
import type { PaginatedResponse } from '../../../lib/types';

export function AdminVerificationsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PaginatedResponse<AdminVerification> | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status') ?? '';
  const currentPage = searchParams.get('page') ?? '1';
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const query = new URLSearchParams({ page: currentPage, limit: '12' });
        if (status) query.set('status', status);
        setPage(await getAdminVerifications(`?${query}`));
        setError(null);
      } catch (reason) {
        const code =
          reason instanceof Error &&
          'status' in reason &&
          typeof reason.status === 'number'
            ? reason.status
            : undefined;
        if (code === 401)
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        else if (code === 403)
          setError('Only administrators can review business verifications.');
        else setError('We could not load verification requests.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [currentPage, pathname, router, status]);
  const update = (values: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(values)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    router.push(next.toString() ? `${pathname}?${next}` : pathname);
  };
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            value={status}
            onChange={(event) =>
              update({ status: event.target.value || null, page: null })
            }
            className="mt-1.5 block rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-highland focus:ring-2 focus:ring-highland/20"
          >
            <option value="">All statuses</option>
            <option value="PENDING">Pending</option>
            <option value="REJECTED">Rejected</option>
            <option value="APPROVED">Approved</option>
          </select>
        </label>
        <button
          type="button"
          onClick={() => update({ status: null, page: null })}
          className="rounded border px-3 py-2 text-sm font-semibold text-slate-700"
        >
          Clear
        </button>
      </div>
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="rounded border bg-white p-6 text-sm text-slate-600">
          Loading verification queue...
        </p>
      ) : null}
      {!loading && page?.data.length ? (
        <div className="space-y-4">
          {page.data.map((item) => (
            <article
              key={item.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {item.status}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {item.business.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Applicant: {item.applicant.email} · {item.documents.length}{' '}
                    document{item.documents.length === 1 ? '' : 's'}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">
                    Submitted:{' '}
                    {item.submittedAt
                      ? new Date(item.submittedAt).toLocaleString()
                      : 'Not submitted'}
                  </p>
                </div>
                <Link
                  href={`/admin/verifications/${item.id}`}
                  className="h-fit rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-highland"
                >
                  Review request
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
      {!loading && !page?.data.length && !error ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-highland" />
          <h2 className="mt-3 font-semibold text-slate-950">
            No verification requests
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Requests matching this filter will appear here.
          </p>
        </div>
      ) : null}
      {page && page.meta.totalPages > 1 ? (
        <div className="mt-6 flex justify-center gap-2">
          <button
            disabled={page.meta.page <= 1}
            onClick={() => update({ page: String(page.meta.page - 1) })}
            className="rounded border px-3 py-2 text-sm disabled:opacity-40"
          >
            Previous
          </button>
          <button
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded border px-3 py-2 text-sm disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
