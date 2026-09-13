'use client';

import Link from 'next/link';
import { LoaderCircle, Pencil, Upload, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import {
  archiveBusinessMedia,
  getBusinessMedia,
  reorderBusinessMedia,
  updateBusinessMedia,
  uploadBusinessMedia,
} from '../../lib/business-media';
import type { ManagedBusinessMedia, MediaRole } from '../../lib/business-media';
import {
  canEditBusiness,
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';

const maxImageBytes = 10 * 1024 * 1024;
const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const inputClass =
  'mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:border-highland focus:ring-2 focus:ring-highland/20';

function grouped(items: ManagedBusinessMedia[], role: MediaRole) {
  return items.filter(
    (item) => item.role === role && item.media.status === 'READY',
  );
}

export function BusinessMediaClient({ businessId }: { businessId: string }) {
  const [items, setItems] = useState<ManagedBusinessMedia[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<MediaRole | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const reload = async () => {
    try {
      const [business, media] = await Promise.all([
        getManagedBusiness(businessId),
        getBusinessMedia(businessId),
      ]);
      setCanEdit(canEditBusiness(business));
      setItems(media);
      setError(null);
    } catch (reason) {
      setError(
        requestErrorMessage(reason, 'We could not load business media.'),
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, [businessId]);

  const moveGallery = async (mediaId: string, delta: number) => {
    const gallery = grouped(items, 'GALLERY');
    const index = gallery.findIndex((item) => item.media.id === mediaId);
    const destination = index + delta;
    if (index < 0 || destination < 0 || destination >= gallery.length) return;
    const next = [...gallery];
    const moved = next[index];
    if (!moved) return;
    next.splice(index, 1);
    next.splice(destination, 0, moved);
    try {
      await reorderBusinessMedia(
        businessId,
        next.map((item) => item.media.id),
      );
      await reload();
    } catch (reason) {
      setError(
        requestErrorMessage(reason, 'We could not reorder the gallery.'),
      );
    }
  };

  if (loading)
    return (
      <main className="mx-auto max-w-6xl p-6 text-sm text-slate-600">
        Loading media...
      </main>
    );
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <Link
        href={`/businesses/manage/${businessId}`}
        className="text-sm font-semibold text-highland focus:outline-none focus:ring-2 focus:ring-highland"
      >
        ← Business workspace
      </Link>
      <header className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950">Business media</h1>
          <p className="mt-1 text-sm text-slate-600">
            Add real logo, cover, and gallery images. Files are validated before
            they become usable.
          </p>
        </div>
        {!canEdit ? (
          <p className="text-sm text-slate-600">
            Staff members can view media but cannot change it.
          </p>
        ) : null}
      </header>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {(['LOGO', 'HERO'] as const).map((role) => (
          <MediaSection
            key={role}
            title={role === 'HERO' ? 'Cover' : 'Logo'}
            role={role}
            items={grouped(items, role)}
            canEdit={canEdit}
            uploading={uploading === role}
            editing={editing}
            onUpload={async (file, altText, caption) => {
              setUploading(role);
              setError(null);
              try {
                await uploadBusinessMedia(businessId, role, file, {
                  altText,
                  caption,
                });
                await reload();
              } catch (reason) {
                setError(
                  requestErrorMessage(
                    reason,
                    'We could not upload this image.',
                  ),
                );
              } finally {
                setUploading(null);
              }
            }}
            onArchive={async (mediaId) => {
              try {
                await archiveBusinessMedia(businessId, mediaId);
                await reload();
              } catch (reason) {
                setError(
                  requestErrorMessage(
                    reason,
                    'We could not archive this image.',
                  ),
                );
              }
            }}
            onSave={async (mediaId, altText, caption) => {
              try {
                await updateBusinessMedia(businessId, mediaId, {
                  altText,
                  caption,
                });
                setEditing(null);
                await reload();
              } catch (reason) {
                setError(
                  requestErrorMessage(
                    reason,
                    'We could not update image details.',
                  ),
                );
              }
            }}
            onEdit={setEditing}
          />
        ))}
      </div>
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Gallery</h2>
        <p className="mt-1 text-sm text-slate-600">
          Gallery images can be arranged using the keyboard-friendly move
          controls.
        </p>
        {canEdit ? (
          <UploadForm
            role="GALLERY"
            uploading={uploading === 'GALLERY'}
            onUpload={async (file, altText, caption) => {
              setUploading('GALLERY');
              setError(null);
              try {
                await uploadBusinessMedia(businessId, 'GALLERY', file, {
                  altText,
                  caption,
                });
                await reload();
              } catch (reason) {
                setError(
                  requestErrorMessage(
                    reason,
                    'We could not upload this image.',
                  ),
                );
              } finally {
                setUploading(null);
              }
            }}
          />
        ) : null}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {grouped(items, 'GALLERY').map((item, index, gallery) => (
            <MediaCard
              key={item.id}
              item={item}
              canEdit={canEdit}
              editing={editing === item.media.id}
              onEdit={setEditing}
              onSave={async (altText, caption) => {
                try {
                  await updateBusinessMedia(businessId, item.media.id, {
                    altText,
                    caption,
                  });
                  setEditing(null);
                  await reload();
                } catch (reason) {
                  setError(
                    requestErrorMessage(
                      reason,
                      'We could not update image details.',
                    ),
                  );
                }
              }}
              onArchive={async () => {
                try {
                  await archiveBusinessMedia(businessId, item.media.id);
                  await reload();
                } catch (reason) {
                  setError(
                    requestErrorMessage(
                      reason,
                      'We could not archive this image.',
                    ),
                  );
                }
              }}
              controls={
                canEdit ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={index === 0}
                      onClick={() => void moveGallery(item.media.id, -1)}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                    >
                      Move up
                    </button>
                    <button
                      type="button"
                      disabled={index === gallery.length - 1}
                      onClick={() => void moveGallery(item.media.id, 1)}
                      className="rounded border px-2 py-1 text-xs disabled:opacity-40"
                    >
                      Move down
                    </button>
                  </div>
                ) : null
              }
            />
          ))}
          {!grouped(items, 'GALLERY').length ? (
            <p className="text-sm text-slate-600">No gallery images yet.</p>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function MediaSection({
  title,
  role,
  items,
  canEdit,
  uploading,
  editing,
  onUpload,
  onArchive,
  onSave,
  onEdit,
}: {
  title: string;
  role: MediaRole;
  items: ManagedBusinessMedia[];
  canEdit: boolean;
  uploading: boolean;
  editing: string | null;
  onUpload: (file: File, altText: string, caption: string) => Promise<void>;
  onArchive: (mediaId: string) => Promise<void>;
  onSave: (mediaId: string, altText: string, caption: string) => Promise<void>;
  onEdit: (id: string | null) => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">
        Uploading a new {title.toLowerCase()} archives the previous one without
        erasing its history.
      </p>
      {canEdit ? (
        <UploadForm role={role} uploading={uploading} onUpload={onUpload} />
      ) : null}
      <div className="mt-4 space-y-3">
        {items.map((item) => (
          <MediaCard
            key={item.id}
            item={item}
            canEdit={canEdit}
            editing={editing === item.media.id}
            onEdit={onEdit}
            onArchive={() => onArchive(item.media.id)}
            onSave={(altText, caption) =>
              onSave(item.media.id, altText, caption)
            }
          />
        ))}
        {!items.length ? (
          <p className="text-sm text-slate-600">
            No {title.toLowerCase()} uploaded.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function UploadForm({
  role,
  uploading,
  onUpload,
}: {
  role: MediaRole;
  uploading: boolean;
  onUpload: (file: File, altText: string, caption: string) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [altText, setAltText] = useState('');
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError('Choose an image first.');
      return;
    }
    if (!supportedImageTypes.has(file.type) || file.size > maxImageBytes) {
      setError('Use a JPEG, PNG, or WebP image no larger than 10 MB.');
      return;
    }
    setError(null);
    await onUpload(file, altText.trim(), caption.trim());
    setAltText('');
    setCaption('');
    if (fileRef.current) fileRef.current.value = '';
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-4 rounded-md bg-slate-50 p-3"
    >
      <label className="block text-sm font-semibold text-slate-700">
        {role === 'HERO'
          ? 'Replace cover'
          : role === 'LOGO'
            ? 'Replace logo'
            : 'Add gallery image'}
        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className={inputClass}
          disabled={uploading}
        />
      </label>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-slate-700">
          Alt text{' '}
          <input
            className={inputClass}
            value={altText}
            maxLength={240}
            onChange={(event) => setAltText(event.target.value)}
            disabled={uploading}
          />
        </label>
        <label className="text-sm text-slate-700">
          Caption{' '}
          <input
            className={inputClass}
            value={caption}
            maxLength={500}
            onChange={(event) => setCaption(event.target.value)}
            disabled={uploading}
          />
        </label>
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}
      <button
        disabled={uploading}
        className="mt-3 inline-flex items-center gap-2 rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
      >
        {uploading ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading ? 'Uploading...' : 'Upload image'}
      </button>
    </form>
  );
}

function MediaCard({
  item,
  canEdit,
  editing,
  onEdit,
  onSave,
  onArchive,
  controls,
}: {
  item: ManagedBusinessMedia;
  canEdit: boolean;
  editing: boolean;
  onEdit: (id: string | null) => void;
  onSave: (altText: string, caption: string) => Promise<void>;
  onArchive: () => Promise<void>;
  controls?: React.ReactNode;
}) {
  const [altText, setAltText] = useState(item.altText ?? '');
  const [caption, setCaption] = useState(item.caption ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setAltText(item.altText ?? '');
    setCaption(item.caption ?? '');
  }, [item]);
  return (
    <article className="rounded-md border border-slate-200 p-3">
      <p className="truncate font-semibold text-slate-900">
        {item.media.originalFilename}
      </p>
      <p className="mt-1 text-xs text-slate-500">
        {item.media.mimeType} · {Math.ceil(item.media.sizeBytes / 1024)} KB
      </p>
      {editing ? (
        <div className="mt-3 space-y-2">
          <label className="block text-xs">
            Alt text{' '}
            <input
              className={inputClass}
              value={altText}
              maxLength={240}
              onChange={(event) => setAltText(event.target.value)}
            />
          </label>
          <label className="block text-xs">
            Caption{' '}
            <input
              className={inputClass}
              value={caption}
              maxLength={500}
              onChange={(event) => setCaption(event.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setSaving(true);
                void onSave(altText, caption).finally(() => setSaving(false));
              }}
              className="rounded bg-highland px-2 py-1 text-xs font-semibold text-white"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => onEdit(null)}
              className="rounded border px-2 py-1 text-xs"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        {controls}
        {canEdit && !editing ? (
          <button
            type="button"
            onClick={() => onEdit(item.media.id)}
            className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
        ) : null}
        {canEdit ? (
          <button
            type="button"
            onClick={() => void onArchive()}
            className="inline-flex items-center gap-1 rounded border border-red-300 px-2 py-1 text-xs text-red-700"
          >
            <X className="h-3.5 w-3.5" />
            Archive
          </button>
        ) : null}
      </div>
    </article>
  );
}
