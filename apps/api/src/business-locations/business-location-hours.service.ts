import { Injectable } from '@nestjs/common';
import { BusinessWeekday } from '@prisma/client';

type OperatingHour = {
  dayOfWeek: BusinessWeekday;
  isClosed: boolean;
  opensAt: string | null;
  closesAt: string | null;
};

const weekdayByShortName: Record<string, BusinessWeekday> = {
  Mon: BusinessWeekday.MONDAY,
  Tue: BusinessWeekday.TUESDAY,
  Wed: BusinessWeekday.WEDNESDAY,
  Thu: BusinessWeekday.THURSDAY,
  Fri: BusinessWeekday.FRIDAY,
  Sat: BusinessWeekday.SATURDAY,
  Sun: BusinessWeekday.SUNDAY,
};

@Injectable()
export class BusinessLocationHoursService {
  isOpenAt(
    location: { timezone: string; operatingHours: OperatingHour[] },
    at = new Date(),
  ): boolean {
    const local = this.localTime(location.timezone, at);
    if (!local) return false;
    const weekday = weekdayByShortName[local.weekday];
    const schedule = location.operatingHours.find(
      (hour) => hour.dayOfWeek === weekday,
    );
    if (
      !schedule ||
      schedule.isClosed ||
      !schedule.opensAt ||
      !schedule.closesAt
    ) {
      return false;
    }
    return local.time >= schedule.opensAt && local.time < schedule.closesAt;
  }

  private localTime(
    timezone: string,
    at: Date,
  ): { weekday: string; time: string } | null {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).formatToParts(at);
      const weekday = parts.find((part) => part.type === 'weekday')?.value;
      const hour = parts.find((part) => part.type === 'hour')?.value;
      const minute = parts.find((part) => part.type === 'minute')?.value;
      if (!weekday || !hour || !minute || !weekdayByShortName[weekday]) {
        return null;
      }
      return { weekday, time: `${hour}:${minute}` };
    } catch {
      return null;
    }
  }
}
