'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AdminNoteActionDialog } from '../../../../components/admin/AdminNoteActionDialog';
import {
  AdminReport,
  adminFetch,
  formatDate,
  statusClass,
} from '../../../../lib/admin';

export function AdminReportDetailClient({ reportId }: { reportId: string }) {
  const t = useTranslations('adminPortal');
  const [report, setReport] = useState<AdminReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const load = useCallback(() => {
    void adminFetch<AdminReport>(`/api/admin/reports/${reportId}`)
      .then(setReport)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : t('reportsUnavailable'),
        ),
      );
  }, [reportId]);
  useEffect(load, [load]);
  async function startReview() {
    setStarting(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/reports/${reportId}/start-review`, {
        method: 'POST',
      });
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('reportStartError'));
    } finally {
      setStarting(false);
    }
  }
  if (!report) return <p className="text-slate-600">{t('loadingReport')}</p>;
  const targetLabel =
    report.target?.name ?? report.target?.displayName ?? report.targetId;
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('reportInvestigation')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('reportSuffix', { type: report.targetType })}
        </h1>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <article className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap justify-between gap-3">
          <div>
            <p className="font-bold text-slate-950">
              {t('target')}: {targetLabel}
            </p>
            <p className="text-sm text-slate-600">
              {t('reportedBy', { name: report.reporter.displayName })} ·{' '}
              {formatDate(report.createdAt)}
            </p>
          </div>
          <span
            className={`h-fit rounded px-2 py-1 text-xs font-semibold ${statusClass(report.status)}`}
          >
            {report.status}
          </span>
        </div>
        <div>
          <h2 className="font-semibold text-slate-950">{t('reason')}</h2>
          <p className="mt-1 text-slate-700">{report.reason}</p>
        </div>
        {report.details ? (
          <div>
            <h2 className="font-semibold text-slate-950">{t('details')}</h2>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">
              {report.details}
            </p>
          </div>
        ) : null}
        {report.resolution ? (
          <div className="rounded-lg bg-slate-50 p-4">
            <h2 className="font-semibold text-slate-950">{t('resolution')}</h2>
            <p className="mt-1 whitespace-pre-wrap text-slate-700">
              {report.resolution}
            </p>
          </div>
        ) : null}
      </article>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          {t('investigationAction')}
        </h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {report.status === 'OPEN' ? (
            <button
              type="button"
              disabled={starting}
              onClick={() => {
                void startReview();
              }}
              className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {starting ? t('startingReview') : t('startReview')}
            </button>
          ) : null}
          {report.status === 'UNDER_REVIEW' ? (
            <>
              <AdminNoteActionDialog
                action={t('resolved')}
                endpoint={`/api/admin/reports/${report.id}/resolve`}
                field="resolution"
                target={t('thisReport')}
                onComplete={load}
              />
              <AdminNoteActionDialog
                action={t('dismiss')}
                endpoint={`/api/admin/reports/${report.id}/dismiss`}
                field="resolution"
                target={t('thisReport')}
                onComplete={load}
              />
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
