'use client';

import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';
import { icon } from 'leaflet';
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import type { MapPlace } from '../../lib/types';

const markerIcon = icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl:
    'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function BoundsReporter({
  onBoundsChange,
}: {
  onBoundsChange: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
}) {
  const onBoundsChangeRef = useRef(onBoundsChange);

  useEffect(() => {
    onBoundsChangeRef.current = onBoundsChange;
  }, [onBoundsChange]);

  const map = useMapEvents({
    moveend: () => {
      const b = map.getBounds();
      onBoundsChangeRef.current({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    },
    zoomend: () => {
      const b = map.getBounds();
      onBoundsChangeRef.current({
        north: b.getNorth(),
        south: b.getSouth(),
        east: b.getEast(),
        west: b.getWest(),
      });
    },
  });

  useEffect(() => {
    const b = map.getBounds();
    onBoundsChangeRef.current({
      north: b.getNorth(),
      south: b.getSouth(),
      east: b.getEast(),
      west: b.getWest(),
    });
  }, [map]);

  return null;
}
export function MapView({
  places,
  onBoundsChange,
}: {
  places: MapPlace[];
  onBoundsChange: (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => void;
}) {
  return (
    <MapContainer
      center={[8.98, 38.76]}
      zoom={6}
      scrollWheelZoom
      className="h-[600px] w-full rounded-lg border border-slate-200"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <BoundsReporter onBoundsChange={onBoundsChange} />
      {places.map((place) => (
        <Marker
          key={`${place.type}-${place.id}`}
          position={[Number(place.latitude), Number(place.longitude)]}
          icon={markerIcon}
        >
          <Popup>
            <div className="space-y-1">
              <p className="font-semibold text-slate-950">{place.name}</p>
              <p className="text-xs uppercase text-slate-500">{place.type}</p>
              <p className="text-sm text-slate-600">{place.category?.name}</p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
