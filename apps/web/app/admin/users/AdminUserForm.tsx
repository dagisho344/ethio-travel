'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useState } from 'react';
import { AdminUser, adminFetch } from '../../../lib/admin';

const roleCodes = [
  'TRAVELER',
  'BUSINESS_OWNER',
  'BUSINESS_STAFF',
  'ADMIN',
] as const;
type RoleCode = (typeof roleCodes)[number];

const roleLabelKeys = {
  TRAVELER: 'roleTraveler',
  BUSINESS_OWNER: 'roleBusinessOwner',
  BUSINESS_STAFF: 'roleBusinessStaff',
  ADMIN: 'roleAdmin',
} as const;

export function AdminUserForm({
  userId,
  currentUserId,
}: {
  userId?: string;
  currentUserId?: string;
}) {
  const t = useTranslations('adminUsers');
  const router = useRouter();
  const editing = Boolean(userId);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [roles, setRoles] = useState<RoleCode[]>(['TRAVELER']);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(editing);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let current = true;
    void adminFetch<AdminUser>(`/api/admin/users/${userId}`)
      .then((user) => {
        if (!current) return;
        setLoadFailed(false);
        setFirstName(user.firstName ?? '');
        setLastName(user.lastName ?? '');
        setEmail(user.email);
        setPhone(user.phone ?? '');
        setRoles(roleCodes.filter((role) => user.roles.includes(role)));
      })
      .catch((cause: unknown) => {
        if (current) {
          setLoadFailed(true);
          setError(cause instanceof Error ? cause.message : t('loadError'));
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
    };
  }, [userId, t]);

  function toggleRole(role: RoleCode) {
    setRoles((current) =>
      current.includes(role)
        ? current.filter((item) => item !== role)
        : [...current, role],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    if (
      !firstName.trim() ||
      !lastName.trim() ||
      !email.trim() ||
      !roles.length
    ) {
      setError(t('requiredFields'));
      return;
    }
    if (!editing) {
      if (password.length < 8 || password.length > 128) {
        setError(t('passwordLength'));
        return;
      }
      if (password !== confirmation) {
        setError(t('passwordMismatch'));
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      const user = await adminFetch<AdminUser>(
        editing ? `/api/admin/users/${userId}` : '/api/admin/users',
        {
          method: editing ? 'PATCH' : 'POST',
          body: JSON.stringify({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim() || null,
            roles,
            ...(!editing ? { temporaryPassword: password } : {}),
          }),
        },
      );
      setPassword('');
      setConfirmation('');
      router.push(`/admin/users/${user.id}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href={userId ? `/admin/users/${userId}` : '/admin/users'}
        className="text-sm font-semibold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
      >
        ← {t('backToUsers')}
      </Link>
      <h1 className="text-3xl font-bold text-slate-950">
        {editing ? t('editUser') : t('addUser')}
      </h1>
      {loading ? (
        <p aria-live="polite">{t('loading')}</p>
      ) : loadFailed ? (
        <p role="alert" className="rounded-md bg-red-50 p-3 text-red-800">
          {error ?? t('loadError')}
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              {t('firstName')}
              <input
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                maxLength={100}
                autoComplete="given-name"
                className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              {t('lastName')}
              <input
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                required
                maxLength={100}
                autoComplete="family-name"
                className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-800">
            {t('email')}
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              maxLength={254}
              autoComplete="off"
              className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            {t('phone')}
            <input
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              maxLength={32}
              autoComplete="off"
              className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </label>
          <fieldset className="rounded-md border border-slate-200 p-4">
            <legend className="px-1 text-sm font-semibold text-slate-800">
              {t('chooseRoles')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {roleCodes.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-2 text-sm text-slate-800"
                >
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    disabled={
                      role === 'ADMIN' &&
                      Boolean(userId && userId === currentUserId)
                    }
                    className="h-4 w-4 accent-emerald-700 focus:ring-2 focus:ring-emerald-600 disabled:opacity-60"
                  />
                  {t(roleLabelKeys[role])}
                </label>
              ))}
            </div>
          </fieldset>
          {editing && userId === currentUserId ? (
            <p className="text-sm text-slate-600">{t('selfProtection')}</p>
          ) : null}
          {!editing ? (
            <>
              <p className="text-sm text-slate-600">{t('submitHelp')}</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-800">
                  {t('temporaryPassword')}
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </label>
                <label className="block text-sm font-semibold text-slate-800">
                  {t('confirmPassword')}
                  <input
                    type="password"
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    required
                    minLength={8}
                    maxLength={128}
                    autoComplete="new-password"
                    className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </label>
              </div>
            </>
          ) : null}
          {error ? (
            <p
              role="alert"
              className="rounded-md bg-red-50 p-3 text-sm text-red-800"
            >
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={saving}
              className="min-h-10 rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 disabled:opacity-60"
            >
              {saving ? t('saving') : editing ? t('saveUser') : t('createUser')}
            </button>
            <Link
              href={userId ? `/admin/users/${userId}` : '/admin/users'}
              className="inline-flex min-h-10 items-center rounded-md border border-slate-300 px-4 font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {t('cancel')}
            </Link>
          </div>
        </form>
      )}
    </div>
  );
}
