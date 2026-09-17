import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  strictAllowedJsonBody,
  tourPath,
  type TourRouteContext,
} from '../tour-bff';

const itineraryKeys = [
  'dayNumber',
  'title',
  'description',
  'sortOrder',
] as const;

export async function GET(request: NextRequest, context: TourRouteContext) {
  try {
    return managedResponse(request, await tourPath(context, '/itinerary'));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: TourRouteContext) {
  try {
    return managedResponse(request, await tourPath(context, '/itinerary'), {
      method: 'POST',
      body: await strictAllowedJsonBody(request, itineraryKeys),
    });
  } catch (error) {
    return jsonError(error);
  }
}
