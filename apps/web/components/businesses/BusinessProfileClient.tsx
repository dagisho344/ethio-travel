'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';
import type { ManagedBusiness } from '../../lib/business-management';
import { BusinessProfileEditor } from './BusinessProfileEditor';

export function BusinessProfileClient({ businessId }: { businessId: string }) {
  const [business, setBusiness] = useState<ManagedBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadBusiness() {
    setLoading(true);
    setError(null);
    try {
      setBusiness(await getManagedBusiness(businessId));
    } catch (requestError) {
      setBusiness(null);
      setError(
        requestErrorMessage(
          requestError,
          'We could not load this business profile.',
        ),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBusiness();
  }, [businessId]);

  if (loading) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading business profile…
        </span>
      </section>
    );
  }

  if (!business) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
      >
        {error ?? 'Business not found.'}
      </p>
    );
  }

  return <BusinessProfileEditor business={business} onSaved={loadBusiness} />;
}
