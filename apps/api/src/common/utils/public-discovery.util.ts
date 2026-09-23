import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export const DEFAULT_NEARBY_RADIUS_KM = 25;
export const MIN_NEARBY_RADIUS_KM = 1;
export const MAX_NEARBY_RADIUS_KM = 200;
export const MAX_DISCOVERY_RESULT_WINDOW = 1000;

export interface PublicDiscoveryScope {
  regionSlug?: string;
  citySlug?: string;
  destinationSlug?: string;
}

export interface NearbyCoordinates {
  lat?: number;
  lng?: number;
  radiusKm?: number;
}

export interface GeographicBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function validatePublicDiscoveryScope(
  scope: PublicDiscoveryScope,
): void {
  if (scope.citySlug && !scope.regionSlug) {
    throw new BadRequestException('citySlug requires regionSlug.');
  }
  if (scope.destinationSlug && (!scope.regionSlug || !scope.citySlug)) {
    throw new BadRequestException(
      'destinationSlug requires regionSlug and citySlug.',
    );
  }
}

export function hasNearbyCoordinates(
  coordinates: NearbyCoordinates,
): coordinates is Required<Pick<NearbyCoordinates, 'lat' | 'lng'>> &
  NearbyCoordinates {
  return coordinates.lat !== undefined && coordinates.lng !== undefined;
}

export function validateNearbyCoordinates(
  coordinates: NearbyCoordinates,
): void {
  const hasLat = coordinates.lat !== undefined;
  const hasLng = coordinates.lng !== undefined;
  const hasRadius = coordinates.radiusKm !== undefined;

  if (hasLat !== hasLng) {
    throw new BadRequestException('lat and lng must be provided together.');
  }
  if (hasRadius && !hasLat) {
    throw new BadRequestException('radiusKm requires lat and lng.');
  }
  if (!hasLat) return;

  if (
    coordinates.lat! < -90 ||
    coordinates.lat! > 90 ||
    coordinates.lng! < -180 ||
    coordinates.lng! > 180
  ) {
    throw new BadRequestException(
      'Nearby coordinates are outside valid bounds.',
    );
  }

  const radiusKm = coordinates.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;
  if (radiusKm < MIN_NEARBY_RADIUS_KM || radiusKm > MAX_NEARBY_RADIUS_KM) {
    throw new BadRequestException(
      `radiusKm must be between ${MIN_NEARBY_RADIUS_KM} and ${MAX_NEARBY_RADIUS_KM}.`,
    );
  }
}

export function nearbyRadiusKm(coordinates: NearbyCoordinates): number {
  return coordinates.radiusKm ?? DEFAULT_NEARBY_RADIUS_KM;
}

export function radiusBounds(
  lat: number,
  lng: number,
  radiusKm: number,
): GeographicBounds {
  const latitudeDelta = radiusKm / 111.32;
  const longitudeScale = Math.max(
    Math.cos((lat * Math.PI) / 180),
    Number.EPSILON,
  );
  const longitudeDelta = radiusKm / (111.32 * longitudeScale);

  return {
    north: Math.min(90, lat + latitudeDelta),
    south: Math.max(-90, lat - latitudeDelta),
    east: Math.min(180, lng + longitudeDelta),
    west: Math.max(-180, lng - longitudeDelta),
  };
}

export function haversineDistanceKm(
  sourceLat: number,
  sourceLng: number,
  targetLat: number | Prisma.Decimal,
  targetLng: number | Prisma.Decimal,
): number {
  const latitude =
    targetLat instanceof Prisma.Decimal ? targetLat.toNumber() : targetLat;
  const longitude =
    targetLng instanceof Prisma.Decimal ? targetLng.toNumber() : targetLng;
  const radians = Math.PI / 180;
  const latitudeDelta = (latitude - sourceLat) * radians;
  const longitudeDelta = (longitude - sourceLng) * radians;
  const sourceLatitude = sourceLat * radians;
  const targetLatitude = latitude * radians;
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(sourceLatitude) *
      Math.cos(targetLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}
