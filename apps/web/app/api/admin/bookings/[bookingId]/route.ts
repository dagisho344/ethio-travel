import type { NextRequest } from 'next/server';
import { adminError, adminJson, adminUuid } from '../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    return await adminJson(
      request,
      '/admin/bookings/' + adminUuid(bookingId, 'Booking'),
    );
  } catch (error) {
    return adminError(error);
  }
}
