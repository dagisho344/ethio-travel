'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';
import type { ManagedBusiness } from '../../lib/business-management';
import { getLocations } from '../../lib/business-locations';
import { BusinessDashboardOverview } from './BusinessDashboardOverview';

export function BusinessWorkspaceClient({
  businessId,
}: {
  businessId: string;
}) {
  const t = useTranslations('businessPortal');
  const [business, setBusiness] = useState<ManagedBusiness | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasPrimaryLocation, setHasPrimaryLocation] = useState(false);

  async function loadBusiness() {
    setLoading(true);
    setError(null);
    try {
      const [loadedBusiness, locations] = await Promise.all([
        getManagedBusiness(businessId),
        getLocations(businessId).catch(() => []),
      ]);
      setBusiness(loadedBusiness);
      setHasPrimaryLocation(
        locations.some(
          (location) => location.isPrimary && location.status === 'ACTIVE',
        ),
      );
    } catch (requestError) {
      setBusiness(null);
      setError(requestErrorMessage(requestError, t('loadWorkspaceError')));
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
          {t('loadingDashboard')}
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
        {error ?? t('businessNotFound')}
      </p>
    );
  }

  return (
    <BusinessDashboardOverview
      business={business}
      hasPrimaryLocation={hasPrimaryLocation}
    />
  );
}
