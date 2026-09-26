'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import type { MapPlace } from '../../lib/types';

function MapLoading() {
  const t = useTranslations('map');
  return (
    <div className="flex h-[520px] items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-600">
      {t('loading')}
    </div>
  );
}

const MapView = dynamic(() => import('./MapView').then((mod) => mod.MapView), {
  ssr: false,
  loading: MapLoading,
});

export function DynamicMap(props: {
  places: MapPlace[];
  onBoundsChange: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
  selectedPlaceKey?: string | null;
  onSelectPlace?: (place: MapPlace) => void;
  nearbyPosition?: { lat: number; lng: number } | null;
}) {
  return <MapView {...props} />;
}
