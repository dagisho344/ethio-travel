'use client';

import { Loader2, UserRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { BffRequestError, bffJson } from '../../lib/private-api';

type ProfileUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roles: string[];
};

type ProfileDraft = {
  firstName: string;
  lastName: string;
  phone: string;
};

const profileFieldLimits = {
  firstName: 100,
  lastName: 100,
  phone: 32,
} as const;

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  BUSINESS_OWNER: 'Business owner',
  BUSINESS_STAFF: 'Business staff',
  TRAVELER: 'Traveler',
};

function toDraft(user: ProfileUser): ProfileDraft {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    phone: user.phone ?? '',
  };
}

function displayName(user: ProfileUser): string {
  const value = [user.firstName, user.lastName].filter(Boolean).join(' ');
  return value || user.email;
}

function initials(user: ProfileUser): string {
  const values = [user.firstName, user.lastName].filter(
    (value): value is string => Boolean(value?.trim()),
  );
  const value = values.map((name) => name.trim().charAt(0)).join('');
  return value ? value.toUpperCase().slice(0, 2) : 'ET';
}

function friendlyRole(role: string): string {
  return (
    roleLabels[role] ??
    role
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  );
}

function profileError(error: unknown, fallback: string): string {
  if (error instanceof BffRequestError) {
    if (error.status === 403) {
      return 'This profile update was not allowed. Refresh and try again.';
    }
    if (error.status === 400) {
      return error.message;
    }
  }
  return fallback;
}

export function AccountProfileClient() {
  const router = useRouter();
  const errorId = useId();
  const successId = useId();
  const requestId = useRef(0);
  const [profile, setProfile] = useState<ProfileUser | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>({
    firstName: '',
    lastName: '',
    phone: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const activeRequest = requestId.current + 1;
    requestId.current = activeRequest;

    async function loadProfile() {
      setLoading(true);
      setError(null);
      try {
        const user = await bffJson<ProfileUser>('/api/account');
        if (activeRequest !== requestId.current) return;
        setProfile(user);
        setDraft(toDraft(user));
      } catch (requestError) {
        if (activeRequest !== requestId.current) return;
        if (
          requestError instanceof BffRequestError &&
          requestError.status === 401
        ) {
          router.replace('/login?returnTo=%2Faccount');
          return;
        }
        setProfile(null);
        setError(profileError(requestError, 'We could not load your profile.'));
      } finally {
        if (activeRequest === requestId.current) setLoading(false);
      }
    }

    void loadProfile();
  }, [reloadNonce, router]);

  const hasChanges =
    profile !== null &&
    (draft.firstName !== (profile.firstName ?? '') ||
      draft.lastName !== (profile.lastName ?? '') ||
      draft.phone !== (profile.phone ?? ''));

  function updateDraft(field: keyof ProfileDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setError(null);
    setSuccess(null);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || saving || !hasChanges) return;

    const update: ProfileDraft = {
      firstName: draft.firstName.trim(),
      lastName: draft.lastName.trim(),
      phone: draft.phone.trim(),
    };
    const invalidField = Object.entries(update).find(
      ([field, value]) =>
        value.length > profileFieldLimits[field as keyof ProfileDraft],
    );
    if (invalidField) {
      setError(
        `${invalidField[0] === 'phone' ? 'Phone' : `${invalidField[0]} name`} is too long.`,
      );
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const user = await bffJson<ProfileUser>('/api/account', {
        method: 'PATCH',
        body: JSON.stringify(update),
      });
      setProfile(user);
      setDraft(toDraft(user));
      setSuccess('Your profile has been updated.');
      router.refresh();
    } catch (requestError) {
      if (
        requestError instanceof BffRequestError &&
        requestError.status === 401
      ) {
        router.replace('/login?returnTo=%2Faccount');
        return;
      }
      setError(
        profileError(
          requestError,
          'We could not update your profile. Try again.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p
          className="flex items-center gap-2 text-sm text-slate-600"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading your profile...
        </p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-950">
        <h2 className="text-lg font-bold">Your profile is unavailable</h2>
        <p className="mt-2 text-sm leading-6">
          {error ?? 'We could not load your profile right now.'}
        </p>
        <button
          type="button"
          onClick={() => setReloadNonce((value) => value + 1)}
          className="mt-4 rounded-md border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <form
        onSubmit={(event) => {
          void saveProfile(event);
        }}
        className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
        aria-describedby={[error ? errorId : null, success ? successId : null]
          .filter(Boolean)
          .join(' ')}
      >
        <div>
          <p className="text-sm font-semibold text-highland">Account details</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
            My Profile
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Keep your name and contact number current. Your email is managed by
            your existing sign-in account.
          </p>
        </div>

        <div className="mt-7 grid gap-5 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            First name
            <input
              value={draft.firstName}
              onChange={(event) => updateDraft('firstName', event.target.value)}
              maxLength={profileFieldLimits.firstName}
              autoComplete="given-name"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Last name
            <input
              value={draft.lastName}
              onChange={(event) => updateDraft('lastName', event.target.value)}
              maxLength={profileFieldLimits.lastName}
              autoComplete="family-name"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Email
            <input
              value={profile.email}
              readOnly
              aria-readonly="true"
              autoComplete="email"
              className="mt-1.5 block w-full cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-600"
            />
            <span className="mt-1.5 block text-xs font-normal leading-5 text-slate-500">
              Email changes are not available in this account area.
            </span>
          </label>
          <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
            Phone
            <input
              value={draft.phone}
              onChange={(event) => updateDraft('phone', event.target.value)}
              maxLength={profileFieldLimits.phone}
              autoComplete="tel"
              inputMode="tel"
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
            />
          </label>
        </div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-5 rounded-md bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </p>
        ) : null}
        {success ? (
          <p
            id={successId}
            role="status"
            className="mt-5 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
          >
            {success}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={saving || !hasChanges}
            aria-busy={saving}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            {saving ? 'Saving changes...' : 'Save changes'}
          </button>
          {hasChanges ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(toDraft(profile));
                setError(null);
                setSuccess(null);
              }}
              className="min-h-11 rounded-md px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Discard changes
            </button>
          ) : null}
        </div>
      </form>

      <aside className="h-fit rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-highland"
            aria-hidden="true"
          >
            {initials(profile)}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-slate-950">
              {displayName(profile)}
            </p>
            <p className="truncate text-sm text-slate-600">{profile.email}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-slate-100 pt-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Authorized roles
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {profile.roles.map((role) => (
              <span
                key={role}
                className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
              >
                {friendlyRole(role)}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-5 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
          <div className="flex gap-2">
            <UserRound
              className="mt-0.5 h-4 w-4 shrink-0 text-highland"
              aria-hidden="true"
            />
            <p>
              Profile photos are not available yet. EthioTravel will add them
              only through a verified upload flow.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}
