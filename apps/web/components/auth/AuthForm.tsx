'use client';

import Link from 'next/link';
import { Eye, EyeOff } from 'lucide-react';
import type { FormEvent } from 'react';
import { useId, useState } from 'react';
import { ApiError, postJson } from '../../lib/api';

type Mode = 'login' | 'register';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

function textValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value : '';
}

function authErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return 'The email or password you entered is incorrect.';
    }
    if (error.status === 400) {
      return 'Please check your email and password and try again.';
    }
    return 'We could not sign you in right now. Please try again soon.';
  }
  return 'We could not reach EthioTravel right now. Please try again soon.';
}

function registerErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 409) {
      return 'An account with this email already exists. Sign in instead.';
    }
    if (error.status === 400) {
      return 'Please check your details and try again.';
    }
    return 'We could not create your account right now. Please try again soon.';
  }
  return 'We could not reach EthioTravel right now. Please try again soon.';
}

function validEmail(email: string): boolean {
  return /^\S+@\S+\.\S+$/.test(email);
}

function validatePassword(password: string): string | null {
  if (!password) return 'Enter a password.';
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (password.length > 128) return 'Password must be 128 characters or fewer.';
  return null;
}

function validateLogin(email: string, password: string): string | null {
  if (!email) return 'Enter your email address.';
  if (!validEmail(email)) return 'Enter a valid email address.';
  return validatePassword(password);
}

function validateRegister({
  firstName,
  lastName,
  email,
  password,
  confirmPassword,
}: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
}): string | null {
  if (!firstName) return 'Enter your first name.';
  if (firstName.length > 100)
    return 'First name must be 100 characters or fewer.';
  if (!lastName) return 'Enter your last name.';
  if (lastName.length > 100)
    return 'Last name must be 100 characters or fewer.';
  if (!email) return 'Enter your email address.';
  if (!validEmail(email)) return 'Enter a valid email address.';
  const passwordError = validatePassword(password);
  if (passwordError) return passwordError;
  if (!confirmPassword) return 'Confirm your password.';
  if (confirmPassword !== password) return 'Passwords do not match.';
  return null;
}

export function AuthForm({ mode }: { mode: Mode }) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const emailId = useId();
  const passwordId = useId();
  const confirmPasswordId = useId();
  const errorId = useId();
  const successId = useId();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setError(null);
    setSuccess(null);

    const form = new FormData(event.currentTarget);
    const trimmedEmail = textValue(form, 'email').trim();
    const password = textValue(form, 'password');
    const firstName = textValue(form, 'firstName').trim();
    const lastName = textValue(form, 'lastName').trim();
    const confirmPassword = textValue(form, 'confirmPassword');
    const validationError =
      mode === 'login'
        ? validateLogin(trimmedEmail, password)
        : validateRegister({
            firstName,
            lastName,
            email: trimmedEmail,
            password,
            confirmPassword,
          });
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    const body =
      mode === 'login'
        ? {
            email: trimmedEmail,
            password,
          }
        : {
            email: trimmedEmail,
            password,
            firstName,
            lastName,
          };
    try {
      await postJson<AuthResponse>(
        mode === 'login' ? '/auth/login' : '/auth/register',
        body,
      );
      setSuccess(
        mode === 'login'
          ? 'Sign-in accepted, but staying signed in is not available in this browser yet.'
          : 'Account created. You can sign in now.',
      );
      if (mode === 'register') {
        event.currentTarget.reset();
        setEmail('');
      }
    } catch (err) {
      setError(
        mode === 'login' ? authErrorMessage(err) : registerErrorMessage(err),
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event);
      }}
      aria-describedby={[error ? errorId : null, success ? successId : null]
        .filter(Boolean)
        .join(' ')}
      className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      <h1 className="text-2xl font-bold text-slate-950">
        {mode === 'login' ? 'Sign In' : 'Create Account'}
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        Use your EthioTravel account to continue.
      </p>
      {mode === 'register' ? (
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-slate-700">
            First name
            <input
              name="firstName"
              autoComplete="given-name"
              maxLength={100}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
            />
          </label>
          <label className="text-sm font-medium text-slate-700">
            Last name
            <input
              name="lastName"
              autoComplete="family-name"
              maxLength={100}
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
            />
          </label>
        </div>
      ) : null}
      <div className="mt-5 space-y-4">
        <label
          className="block text-sm font-medium text-slate-700"
          htmlFor={emailId}
        >
          Email
        </label>
        <input
          id={emailId}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          onBlur={(event) => setEmail(event.target.value.trim())}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? errorId : undefined}
          className="-mt-3 w-full rounded-md border border-slate-300 px-3 py-2 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
        />
        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor={passwordId}
            >
              Password
            </label>
            {mode === 'login' ? (
              <span className="text-sm font-medium text-slate-500">
                Forgot password?
              </span>
            ) : null}
          </div>
          <div className="relative mt-1">
            <input
              id={passwordId}
              minLength={8}
              maxLength={128}
              type={showPassword ? 'text' : 'password'}
              name="password"
              autoComplete={
                mode === 'login' ? 'current-password' : 'new-password'
              }
              aria-invalid={Boolean(error) || undefined}
              aria-describedby={error ? errorId : undefined}
              className="w-full rounded-md border border-slate-300 px-3 py-2 pr-11 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          {mode === 'register' ? (
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Use 8 to 128 characters.
            </p>
          ) : null}
        </div>
        {mode === 'register' ? (
          <div>
            <label
              className="text-sm font-medium text-slate-700"
              htmlFor={confirmPasswordId}
            >
              Confirm password
            </label>
            <div className="relative mt-1">
              <input
                id={confirmPasswordId}
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                autoComplete="new-password"
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? errorId : undefined}
                className="w-full rounded-md border border-slate-300 px-3 py-2 pr-11 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirmed password'
                    : 'Show confirmed password'
                }
                aria-pressed={showConfirmPassword}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>
        ) : null}
      </div>
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          id={successId}
          role="status"
          className="mt-4 rounded-md bg-emerald-50 p-3 text-sm text-emerald-700"
        >
          {success}
        </p>
      ) : null}
      <button
        disabled={loading}
        aria-busy={loading}
        className="mt-6 w-full rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading
          ? mode === 'login'
            ? 'Signing in...'
            : 'Creating account...'
          : mode === 'login'
            ? 'Sign In'
            : 'Register'}
      </button>
      {mode === 'login' ? (
        <p className="mt-5 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link
            href="/register"
            className="font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          >
            Register
          </Link>
        </p>
      ) : (
        <p className="mt-5 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
        </p>
      )}
    </form>
  );
}
