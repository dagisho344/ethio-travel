import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendJson, jsonError } from '../../../../../lib/auth/session';

function availabilityQuery(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ['startAt', 'endAt', 'quantity']) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  return query.toString();
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ serviceId: string }> },
) {
  try {
    const { serviceId } = await params;
    const query = availabilityQuery(request);
    return NextResponse.json(
      await backendJson(
        `/services/${serviceId}/availability${query ? `?${query}` : ''}`,
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
