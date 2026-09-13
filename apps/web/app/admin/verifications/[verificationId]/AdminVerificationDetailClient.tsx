'use client';

import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  getAdminVerification,
  getPrivateDocumentAccess,
  approveVerification,
  protectedDocumentContentPath,
  rejectVerification,
} from '../../../../lib/admin-verifications';
import type { AdminVerification } from '../../../../lib/admin-verifications';

export function AdminVerificationDetailClient() {
  const params = useParams<{ verificationId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [verification, setVerification] = useState<AdminVerification | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const load = async () => {
    setLoading(true);
    try {
      setVerification(await getAdminVerification(params.verificationId));
      setError(null);
    } catch (caught) {
      const code =
        caught instanceof Error &&
        'status' in caught &&
        typeof caught.status === 'number'
          ? caught.status
          : undefined;
      if (code === 401)
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
      else if (code === 403)
        setError('Only administrators can review this verification.');
      else setError('We could not load this verification.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [params.verificationId]);
  const openDocument = async (documentId: string) => {
    try {
      const access = await getPrivateDocumentAccess(
        params.verificationId,
        documentId,
      );
      const target =
        access.delivery === 'SIGNED_URL'
          ? access.url
          : protectedDocumentContentPath(params.verificationId, documentId);
      window.open(target, '_blank', 'noopener,noreferrer');
    } catch {
      setError('The private document could not be opened.');
    }
  };
  const approve = async () => {
    if (!verification || saving) return;
    setSaving(true);
    try {
      await approveVerification(verification.id, notes.trim() || undefined);
      await load();
    } catch {
      setError('The verification could not be approved.');
    } finally {
      setSaving(false);
    }
  };
  const reject = async () => {
    if (!verification || saving) return;
    if (reason.trim().length < 3) {
      setError('A rejection reason of at least three characters is required.');
      return;
    }
    setSaving(true);
    try {
      await rejectVerification(
        verification.id,
        reason.trim(),
        notes.trim() || undefined,
      );
      await load();
    } catch {
      setError('The verification could not be rejected.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-5">
      <Link
        href="/admin/verifications"
        className="text-sm font-semibold text-highland"
      >
        ← Verification queue
      </Link>
      {loading ? (
        <p className="rounded border bg-white p-6 text-sm text-slate-600">
          Loading verification...
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
      {verification ? (
        <>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">
                  {verification.status}
                </p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">
                  {verification.business.name}
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Applicant: {verification.applicant.email}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Submitted:{' '}
                  {verification.submittedAt
                    ? new Date(verification.submittedAt).toLocaleString()
                    : 'Not submitted'}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                Primary location:{' '}
                {verification.business.locations[0]
                  ? `${verification.business.locations[0].label}, ${verification.business.locations[0].city.name}`
                  : 'Not available'}
              </p>
            </div>
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold">Evidence</h2>
            <ul className="mt-4 space-y-3">
              {verification.documents.map((document) => (
                <li
                  key={document.id}
                  className="flex flex-col gap-2 rounded border border-slate-200 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <span className="break-all text-sm text-slate-700">
                    {document.type.replaceAll('_', ' ')} ·{' '}
                    {document.originalFilename} ·{' '}
                    {Math.ceil(document.sizeBytes / 1024)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => void openDocument(document.id)}
                    className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-highland"
                  >
                    View document
                  </button>
                </li>
              ))}
            </ul>
          </section>
          {verification.status === 'PENDING' ? (
            <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold">Review decision</h2>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Admin notes (optional)
                <textarea
                  value={notes}
                  maxLength={5000}
                  onChange={(event) => setNotes(event.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 p-2"
                  rows={4}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold text-slate-700">
                Rejection reason (required only to reject)
                <textarea
                  value={reason}
                  maxLength={5000}
                  onChange={(event) => setReason(event.target.value)}
                  className="mt-1 block w-full rounded border border-slate-300 p-2"
                  rows={3}
                />
              </label>
              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void approve()}
                  className="rounded bg-highland px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void reject()}
                  className="rounded border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
