'use client';

import { Loader2, MessageCircleMore } from 'lucide-react';
import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createConversation } from '../../lib/messaging';
import { BffRequestError } from '../../lib/private-api';

export function StartConversationButton({
  businessId,
  bookingId,
  className,
  label = 'Message business',
  subject,
}: {
  businessId: string;
  bookingId?: string;
  className?: string;
  label?: string;
  subject?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setWorking(true);
    setError(null);
    try {
      const conversation = await createConversation({
        businessId,
        bookingId,
        subject,
      });
      router.push(`/messages/${conversation.id}`);
    } catch (cause) {
      if (cause instanceof BffRequestError && cause.status === 401) {
        router.push(`/login?returnTo=${encodeURIComponent(pathname)}`);
      } else if (
        cause instanceof BffRequestError &&
        (cause.status === 403 || cause.status === 404)
      ) {
        setError('This business is not available for messaging.');
      } else {
        setError('We could not start a conversation right now.');
      }
    } finally {
      setWorking(false);
    }
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        disabled={working}
        onClick={() => void start()}
        className={
          className ??
          'inline-flex items-center gap-2 rounded-md border border-highland px-4 py-2 text-sm font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60'
        }
      >
        {working ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <MessageCircleMore className="h-4 w-4" aria-hidden="true" />
        )}
        {label}
      </button>
      {error ? <p className="text-sm text-red-700">{error}</p> : null}
    </div>
  );
}
