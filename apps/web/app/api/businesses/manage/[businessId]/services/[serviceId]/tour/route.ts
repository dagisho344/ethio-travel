import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  strictAllowedJsonBodyWithStringArrays,
  tourPath,
  type TourRouteContext,
} from './tour-bff';

const detailScalarKeys = [
  'durationDays',
  'difficulty',
  'meetingPoint',
] as const;
const detailStringArrayKeys = ['inclusions', 'exclusions'] as const;

export async function GET(request: NextRequest, context: TourRouteContext) {
  try {
    return managedResponse(request, await tourPath(context));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: TourRouteContext) {
  try {
    return managedResponse(request, await tourPath(context), {
      method: 'PATCH',
      body: await strictAllowedJsonBodyWithStringArrays(
        request,
        detailScalarKeys,
        detailStringArrayKeys,
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
