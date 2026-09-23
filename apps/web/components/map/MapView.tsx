'use client';

import Link from 'next/link';
import { divIcon } from 'leaflet';
import { useEffect, useRef } from 'react';
import {
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import { publicBusinessPath } from '../../lib/public-business-route';
import { publicDestinationPath } from '../../lib/public-destination-route';
import type { MapPlace } from '../../lib/types';

const markerIcon = divIcon({
  className: 'ethio-map-marker',
  html: '<span aria-hidden="true"></span>',
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

type Bounds = { north: number; south: number; east: number; west: number };

function BoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: Bounds) => void;
}) {
  const onBoundsChangeRef = useRef(onBoundsChange);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  const map = useMapEvents({
    moveend: () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const bounds = map.getBounds();
        onBoundsChangeRef.current({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      }, 180);
    },
  });

  useEffect(() => {
    const bounds = map.getBounds();
    onBoundsChangeRef.current({
      north: bounds.getNorth(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      west: bounds.getWest(),
    });
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [map]);

  return null;
}

function SelectionFocus({ place }: { place?: MapPlace | null }) {
  const map = useMap();
  useEffect(() => {
    if (!place) return;
    map.flyTo(
      [Number(place.latitude), Number(place.longitude)],
      Math.max(map.getZoom(), 12),
      {
        animate: true,
      },
    );
  }, [map, place]);
  return null;
}

function placeHref(place: MapPlace): string | null {
  if (place.type === 'service')
    return `/services/${encodeURIComponent(place.id)}`;
  if (place.type === 'business') {
    return publicBusinessPath({
      slug: place.slug,
      city: place.location.city,
      region: place.location.region,
    });
  }
  if (place.type === 'destination') {
    return publicDestinationPath({
      slug: place.slug,
      city: place.location.city,
      region: place.location.region,
    });
  }
  return null;
}

function MarkerPopup({ place }: { place: MapPlace }) {
  const href = placeHref(place);
  return (
    <Popup>
      <div className="space-y-1.5">
        <p className="font-semibold text-slate-950">{place.name}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {place.type}
        </p>
        {place.category?.name ? (
          <p className="text-sm text-slate-600">{place.category.name}</p>
        ) : null}
        {place.rating ? (
          <p className="text-sm text-slate-600">
            {place.rating.average.toFixed(1)} / 5 ({place.rating.count})
          </p>
        ) : null}
        {place.distanceKm !== undefined ? (
          <p className="text-sm text-slate-600">
            {place.distanceKm.toFixed(1)} km away
          </p>
        ) : null}
        {href ? (
          <Link
            href={href}
            className="inline-flex text-sm font-semibold text-highland hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland"
          >
            View details
          </Link>
        ) : null}
      </div>
    </Popup>
  );
}

export function MapView({
  places,
  onBoundsChange,
  selectedPlaceKey,
  onSelectPlace,
  nearbyPosition,
}: {
  places: MapPlace[];
  onBoundsChange: (bounds: Bounds) => void;
  selectedPlaceKey?: string | null;
  onSelectPlace?: (place: MapPlace) => void;
  nearbyPosition?: { lat: number; lng: number } | null;
}) {
  const selectedPlace =
    places.find((place) => `${place.type}:${place.id}` === selectedPlaceKey) ??
    null;

  return (
    <MapContainer
      center={
        nearbyPosition
          ? [nearbyPosition.lat, nearbyPosition.lng]
          : [8.98, 38.76]
      }
      zoom={nearbyPosition ? 11 : 6}
      scrollWheelZoom
      className="h-[min(68vh,680px)] min-h-[420px] w-full rounded-lg border border-slate-200"
      aria-label="Public discovery map"
    >
      <TileLayer
        attribution={
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsReporter onBoundsChange={onBoundsChange} />
      <SelectionFocus place={selectedPlace} />
      {nearbyPosition ? (
        <CircleMarker
          center={[nearbyPosition.lat, nearbyPosition.lng]}
          radius={8}
          pathOptions={{
            color: '#0f766e',
            fillColor: '#14b8a6',
            fillOpacity: 0.9,
          }}
        >
          <Popup>Your approximate location for this search.</Popup>
        </CircleMarker>
      ) : null}
      <MarkerClusterGroup chunkedLoading>
        {places.map((place) => (
          <Marker
            key={`${place.type}:${place.id}`}
            position={[Number(place.latitude), Number(place.longitude)]}
            icon={markerIcon}
            eventHandlers={{ click: () => onSelectPlace?.(place) }}
          >
            <MarkerPopup place={place} />
          </Marker>
        ))}
      </MarkerClusterGroup>
    </MapContainer>
  );
}
