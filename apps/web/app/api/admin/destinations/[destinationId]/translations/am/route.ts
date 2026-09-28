import type { NextRequest } from 'next/server';
import {
  adminAllowedBody,
  adminError,
  adminJson,
  adminUuid,
} from '../../../../bff';

const fields = [
  'displayName',
  'shortDescription',
  'fullDescription',
  'bestTimeToVisit',
  'gettingThere',
  'localTips',
  'safetyNotes',
] as const;

function translationPath(destinationId: string): string {
  return `/admin/destinations/${adminUuid(destinationId, 'Destination')}/translations/am`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> },
) {
  try {
    const { destinationId } = await params;
    return adminJson(request, translationPath(destinationId));
  } catch (error) {
    return adminError(error);
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> },
) {
  try {
    const { destinationId } = await params;
    return adminJson(request, translationPath(destinationId), {
      body: await adminAllowedBody(request, fields, true),
      method: 'PUT',
    });
  } catch (error) {
    return adminError(error);
  }
}
