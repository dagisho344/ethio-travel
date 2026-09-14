import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../../../../../lib/auth/session';
import { allowedJsonBody } from '../../../../operations-bff';

const resources = new Map([
  ['config', 'availability-config'],
  ['rules', 'availability-rules'],
  ['overrides', 'availability-overrides'],
]);
const configKeys = [
  'enabled',
  'bookingMode',
  'timezone',
  'capacity',
  'minQuantity',
  'maxQuantity',
  'minDurationMinutes',
  'maxDurationMinutes',
  'advanceNoticeMinutes',
];
const ruleKeys = [
  'weekday',
  'startTime',
  'endTime',
  'capacity',
  'isActive',
  'validFrom',
  'validUntil',
];
const overrideKeys = ['startAt', 'endAt', 'type', 'capacity', 'reason'];

async function backendPath(
  params: Promise<{ serviceId: string; resource: string }>,
) {
  const resolved = await params;
  if (
    !/^[0-9a-f-]{36}$/i.test(resolved.serviceId) ||
    !resources.has(resolved.resource)
  )
    throw new BffAuthError(404, 'Availability resource not found.');
  return {
    resolved,
    path: `/services/${resolved.serviceId}/${resources.get(resolved.resource)}`,
  };
}
function keys(resource: string) {
  return resource === 'config'
    ? configKeys
    : resource === 'rules'
      ? ruleKeys
      : overrideKeys;
}
async function relay(
  request: NextRequest,
  params: Promise<{ serviceId: string; resource: string }>,
  method: 'GET' | 'PUT' | 'POST',
) {
  try {
    if (method !== 'GET') validateSameOrigin(request);
    const { resolved, path } = await backendPath(params);
    const result = await authenticatedBackendJson(
      path,
      method === 'GET'
        ? undefined
        : {
            method,
            body: await allowedJsonBody(request, keys(resolved.resource)),
          },
    );
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
export function GET(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string; resource: string }> },
) {
  return relay(request, context.params, 'GET');
}
export function PUT(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string; resource: string }> },
) {
  return relay(request, context.params, 'PUT');
}
export function POST(
  request: NextRequest,
  context: { params: Promise<{ serviceId: string; resource: string }> },
) {
  return relay(request, context.params, 'POST');
}
