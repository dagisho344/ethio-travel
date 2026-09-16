import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const schema = readFileSync(
  join(process.cwd(), 'prisma', 'schema.prisma'),
  'utf8',
);

function modelBody(name: string): string {
  const match = new RegExp(`model ${name} \\{([\\s\\S]*?)\\n\\}`).exec(schema);
  if (!match?.[1]) {
    throw new Error(`Expected ${name} in the Prisma schema.`);
  }

  return match[1];
}

describe('Phase 14A category-specific service foundation', () => {
  it('keeps Service as the optional common aggregate root for every category extension', () => {
    const service = modelBody('Service');

    expect(service).toContain('accommodationDetail   AccommodationDetail?');
    expect(service).toContain('restaurantDetail      RestaurantDetail?');
    expect(service).toContain('tourDetail            TourDetail?');
    expect(service).toContain('transportDetail       TransportDetail?');

    for (const model of [
      'AccommodationDetail',
      'RestaurantDetail',
      'TourDetail',
      'TransportDetail',
    ]) {
      expect(modelBody(model)).toContain('serviceId');
      expect(modelBody(model)).toContain('@unique');
      expect(modelBody(model)).toContain(
        '@relation(fields: [serviceId], references: [id], onDelete: Restrict)',
      );
    }
  });

  it('models accommodation details and room types with explicit Decimal money, currency, and preserved content', () => {
    const accommodation = modelBody('AccommodationDetail');
    const roomType = modelBody('RoomType');

    expect(accommodation).toContain('starClass');
    expect(accommodation).toContain('checkInTime');
    expect(accommodation).toContain('checkOutTime');
    expect(accommodation).toContain('roomTypes RoomType[]');
    expect(roomType).toContain('capacity');
    expect(roomType).toContain('basePrice');
    expect(roomType).toContain('@db.Decimal(12, 2)');
    expect(roomType).toContain('currency');
    expect(roomType).toContain('@db.Char(3)');
    expect(roomType).toContain('quantity');
    expect(roomType).toContain('isActive');
    expect(roomType).toContain('@@index([accommodationDetailId, isActive])');
  });

  it('models extensible restaurant cuisines, menus, and available menu items without a fixed cuisine enum', () => {
    const restaurant = modelBody('RestaurantDetail');
    const menu = modelBody('RestaurantMenu');
    const item = modelBody('RestaurantMenuItem');

    expect(restaurant).toContain('cuisineTypes         String[]');
    expect(restaurant).toContain('reservationSupported');
    expect(restaurant).toContain('deliverySupported');
    expect(restaurant).toContain('menus   RestaurantMenu[]');
    expect(menu).toContain('items            RestaurantMenuItem[]');
    expect(menu).toContain('@@index([restaurantDetailId, sortOrder])');
    expect(item).toContain('section');
    expect(item).toContain('price');
    expect(item).toContain('@db.Decimal(12, 2)');
    expect(item).toContain('currency');
    expect(item).toContain('@db.Char(3)');
    expect(item).toContain('available');
    expect(item).toContain('@@index([menuId, available])');
    expect(schema).not.toMatch(/enum\s+Cuisine/);
  });

  it('models tour content as typed details with deterministic itinerary ordering', () => {
    const tour = modelBody('TourDetail');
    const itinerary = modelBody('TourItineraryItem');

    expect(tour).toContain('durationDays');
    expect(tour).toContain('difficulty');
    expect(tour).toContain('meetingPoint');
    expect(tour).toContain('inclusions   String[]');
    expect(tour).toContain('exclusions   String[]');
    expect(tour).toContain('itineraryItems TourItineraryItem[]');
    expect(itinerary).toContain('dayNumber');
    expect(itinerary).toContain('sortOrder');
    expect(itinerary).toContain(
      '@@unique([tourDetailId, dayNumber, sortOrder])',
    );
    expect(itinerary).toContain('@@index([tourDetailId, sortOrder])');
  });

  it('uses existing City records for transport endpoints and keeps schedules as explicit UTC instants', () => {
    const route = modelBody('TransportRoute');
    const schedule = modelBody('TransportSchedule');
    const city = modelBody('City');

    expect(route).toContain('originCityId');
    expect(route).toContain('destinationCityId');
    expect(route).toContain('TransportRouteOriginCity');
    expect(route).toContain('TransportRouteDestinationCity');
    expect(route).toContain('@@index([originCityId, destinationCityId])');
    expect(city).toContain('transportRoutesFrom TransportRoute[]');
    expect(city).toContain('transportRoutesTo   TransportRoute[]');
    expect(schedule).toContain('departureAt DateTime');
    expect(schedule).toContain('arrivalAt   DateTime');
    expect(schedule).toContain('fare        Decimal');
    expect(schedule).toContain('@db.Decimal(12, 2)');
    expect(schedule).toContain('currency    String');
    expect(schedule).toContain('@db.Char(3)');
    expect(schedule).toContain('capacity    Int');
    expect(schedule).toContain('@@index([routeId, departureAt])');
    expect(schedule).toContain('@@index([isActive, departureAt])');
  });
});
