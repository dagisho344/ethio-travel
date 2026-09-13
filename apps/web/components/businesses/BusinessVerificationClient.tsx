'use client';

import Link from 'next/link';
import { CheckCircle2, Circle, LoaderCircle, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  createVerificationDraft,
  getVerificationDraft,
  getVerificationHistory,
  submitVerification,
  uploadVerificationDocument,
} from '../../lib/business-verifications';
import type {
  BusinessVerification,
  VerificationDocumentType,
} from '../../lib/business-verifications';
import {
  canEditBusiness,
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';

const maxDocumentBytes = 15 * 1024 * 1024;
const supportedDocumentTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
]);
const requirements: Array<[VerificationDocumentType, string, boolean]> = [
  ['BUSINESS_LICENSE', 'Business License', true],
  ['TAX_DOCUMENT', 'Tax Document', true],
  ['OWNER_ID', 'Owner ID', true],
  ['ADDRESS_PROOF', 'Address Proof', false],
  ['OTHER', 'Other supporting document', false],
];

export function BusinessVerificationClient({
  businessId,
}: {
  businessId: string;
}) {
  const [draft, setDraft] = useState<BusinessVerification | null>(null);
  const [latest, setLatest] = useState<BusinessVerification | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [business, currentDraft, history] = await Promise.all([
        getManagedBusiness(businessId),
        getVerificationDraft(businessId),
        getVerificationHistory(businessId),
      ]);
      setCanEdit(canEditBusiness(business));
      setDraft(currentDraft);
      setLatest(history.data[0] ?? null);
      setError(null);
    } catch (reason) {
      setError(
        requestErrorMessage(reason, 'We could not load verification details.'),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, [businessId]);

  const createDraft = async () => {
    setCreating(true);
    setError(null);
    try {
      await createVerificationDraft(businessId);
      await reload();
    } catch (reason) {
      setError(
        requestErrorMessage(
          reason,
          'We could not create a verification draft.',
        ),
      );
    } finally {
      setCreating(false);
    }
  };
  const submit = async () => {
    if (!draft || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitVerification(businessId, draft.id);
      await reload();
    } catch (reason) {
      setError(
        requestErrorMessage(
          reason,
          'The verification request could not be submitted.',
        ),
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return (
      <main className="mx-auto max-w-4xl p-6 text-sm text-slate-600">
        Loading verification...
      </main>
    );
  const displayed = draft ?? latest;
  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      <Link
        href={`/businesses/manage/${businessId}`}
        className="text-sm font-semibold text-highland focus:outline-none focus:ring-2 focus:ring-highland"
      >
        ← Business workspace
      </Link>
      <header className="mt-4">
        <h1 className="text-2xl font-bold text-slate-950">
          Business verification
        </h1>
        <p className="mt-1 text-sm leading-6 text-slate-600">
          EthioTravel requires a Business License, Tax Document, and Owner ID
          before review. This is platform policy, not legal advice.
        </p>
      </header>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      {!canEdit ? (
        <p className="mt-5 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
          Staff members can view verification status but cannot upload documents
          or submit a verification request.
        </p>
      ) : null}
      {!displayed ? (
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold">Ready to start?</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create a private draft before uploading required evidence. It
            remains private and does not make the business public.
          </p>
          {canEdit ? (
            <button
              type="button"
              disabled={creating}
              onClick={() => void createDraft()}
              className="mt-4 inline-flex items-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            >
              {creating ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : null}
              {creating ? 'Creating draft...' : 'Start verification'}
            </button>
          ) : null}
        </section>
      ) : null}
      {displayed ? (
        <VerificationPanel
          businessId={businessId}
          verification={displayed}
          draft={draft}
          canEdit={canEdit}
          onReload={reload}
          onSubmit={submit}
          submitting={submitting}
          onResubmit={createDraft}
          creating={creating}
        />
      ) : null}
    </main>
  );
}

function VerificationPanel({
  businessId,
  verification,
  draft,
  canEdit,
  onReload,
  onSubmit,
  submitting,
  onResubmit,
  creating,
}: {
  businessId: string;
  verification: BusinessVerification;
  draft: BusinessVerification | null;
  canEdit: boolean;
  onReload: () => Promise<void>;
  onSubmit: () => Promise<void>;
  submitting: boolean;
  onResubmit: () => Promise<void>;
  creating: boolean;
}) {
  const isDraft =
    verification.status === 'DRAFT' && draft?.id === verification.id;
  return (
    <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-950">
            Verification status
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {verificationStatusLabel(verification.status)}
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {verification.status}
        </span>
      </div>
      {verification.status === 'PENDING' ? (
        <p className="mt-4 rounded bg-amber-50 p-3 text-sm text-amber-900">
          Verification under review. Your submitted evidence cannot be changed
          while it is being reviewed.
        </p>
      ) : null}
      {verification.status === 'APPROVED' ? (
        <p className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-900">
          Verified. This completed verification remains part of business
          history.
        </p>
      ) : null}
      {verification.status === 'REJECTED' ? (
        <div className="mt-4 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <strong>Verification rejected.</strong>
          {verification.rejectionReason ? (
            <p className="mt-2 whitespace-pre-wrap">
              Reason: {verification.rejectionReason}
            </p>
          ) : null}
          <p className="mt-2">
            Submitted: {displayDate(verification.submittedAt)} · Reviewed:{' '}
            {displayDate(verification.reviewedAt)}
          </p>
          {canEdit ? (
            <button
              type="button"
              disabled={creating}
              onClick={() => void onResubmit()}
              className="mt-3 rounded-md bg-highland px-3 py-2 font-semibold text-white disabled:opacity-50"
            >
              {creating ? 'Creating draft...' : 'Correct and resubmit'}
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="mt-5 space-y-3">
        {requirements.map(([type, label, required]) => (
          <DocumentRow
            key={type}
            businessId={businessId}
            verification={verification}
            type={type}
            label={label}
            required={required}
            editable={isDraft && canEdit}
            onUploaded={onReload}
          />
        ))}
      </div>
      {isDraft ? (
        <div className="mt-6 rounded-md bg-slate-50 p-4">
          <p className="text-sm text-slate-700">
            {verification.completeness.readyToSubmit
              ? 'All required finalized documents are present.'
              : 'Upload all required documents before submitting.'}
          </p>
          <button
            type="button"
            disabled={!verification.completeness.readyToSubmit || submitting}
            onClick={() => void onSubmit()}
            className="mt-3 inline-flex items-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : null}
            {submitting ? 'Submitting...' : 'Submit for verification'}
          </button>
        </div>
      ) : null}
    </section>
  );
}

function DocumentRow({
  businessId,
  verification,
  type,
  label,
  required,
  editable,
  onUploaded,
}: {
  businessId: string;
  verification: BusinessVerification;
  type: VerificationDocumentType;
  label: string;
  required: boolean;
  editable: boolean;
  onUploaded: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const document = verification.documents.find(
    (item) => item.type === type && item.status === 'READY',
  );
  const upload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    if (
      !supportedDocumentTypes.has(file.type) ||
      file.size > maxDocumentBytes
    ) {
      setError('Use a PDF, JPEG, or PNG no larger than 15 MB.');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      await uploadVerificationDocument(businessId, verification.id, type, file);
      if (fileRef.current) fileRef.current.value = '';
      await onUploaded();
    } catch (reason) {
      setError(
        requestErrorMessage(reason, 'The document could not be uploaded.'),
      );
    } finally {
      setUploading(false);
    }
  };
  return (
    <article className="rounded-md border border-slate-200 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-2">
          {document ? (
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-highland" />
          ) : (
            <Circle className="mt-0.5 h-5 w-5 text-slate-400" />
          )}
          <div>
            <h3 className="font-semibold text-slate-900">
              {label}
              {required ? (
                <span className="ml-1 text-red-700">*</span>
              ) : (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  optional
                </span>
              )}
            </h3>
            {document ? (
              <p className="mt-1 break-all text-sm text-slate-600">
                {document.originalFilename} ·{' '}
                {Math.ceil(document.sizeBytes / 1024)} KB
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-600">Missing</p>
            )}
          </div>
        </div>
        {editable ? (
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="max-w-full text-sm"
              disabled={uploading}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => void upload()}
              className="inline-flex items-center gap-1 rounded border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
            >
              {uploading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {document ? 'Replace' : 'Upload'}
            </button>
          </div>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </article>
  );
}
function verificationStatusLabel(status: string) {
  return status
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\\w/, (value) => value.toUpperCase());
}
function displayDate(value: string | null) {
  return value ? new Date(value).toLocaleString() : 'Not submitted';
}
