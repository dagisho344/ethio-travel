import { BusinessWeekday } from '@prisma/client';
import { BusinessLocationHoursService } from './business-locations/business-location-hours.service';

describe('Phase 12B business location hours', () => {
  const service = new BusinessLocationHoursService();
  const location = {
    timezone: 'Africa/Addis_Ababa',
    operatingHours: [
      {
        dayOfWeek: BusinessWeekday.MONDAY,
        isClosed: false,
        opensAt: '09:00',
        closesAt: '17:00',
      },
      {
        dayOfWeek: BusinessWeekday.SUNDAY,
        isClosed: true,
        opensAt: null,
        closesAt: null,
      },
    ],
  };

  it('evaluates recurring hours in the branch local timezone', () => {
    expect(
      service.isOpenAt(location, new Date('2026-09-07T06:00:00.000Z')),
    ).toBe(true);
    expect(
      service.isOpenAt(location, new Date('2026-09-07T14:00:00.000Z')),
    ).toBe(false);
  });

  it('treats closed days, missing schedules, and invalid timezones as closed', () => {
    expect(
      service.isOpenAt(location, new Date('2026-09-06T09:00:00.000Z')),
    ).toBe(false);
    expect(service.isOpenAt({ ...location, timezone: 'Not/A_Timezone' })).toBe(
      false,
    );
  });
});
