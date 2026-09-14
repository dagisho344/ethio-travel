import type { NextRequest } from 'next/server';
import { adminAllowedBody, adminError, adminJson, adminUuid } from '../../bff';

const fields = [
  'cityId',
  'name',
  'slug',
  'shortDescription',
  'fullDescription',
  'latitude',
  'longitude',
  'travelInfo',
] as const;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> },
) {
  try {
    const { destinationId } = await params;
    return adminJson(
      request,
      `/admin/destinations/${adminUuid(destinationId, 'Destination')}`,
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> },
) {
  try {
    const { destinationId } = await params;
    return adminJson(
      request,
      `/admin/destinations/${adminUuid(destinationId, 'Destination')}`,
      { body: await adminAllowedBody(request, fields), method: 'PATCH' },
    );
  } catch (error) {
    return adminError(error);
  }
}
