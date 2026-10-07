import { BadRequestException } from '@nestjs/common';
import { DateTime } from 'luxon';
export const dateOnly = (value: string | Date) =>
  new Date(`${(value instanceof Date ? value.toISOString() : value).slice(0, 10)}T00:00:00.000Z`);
export const isoDate = (value: Date) => value.toISOString().slice(0, 10);
export function datesBetween(start: Date, end: Date, max = 366) {
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days < 1 || days > max) throw new BadRequestException(`Date range must be 1–${max} days`);
  return Array.from({ length: days }, (_, i) => new Date(start.getTime() + i * 86400000));
}
export function localDay(value: Date, zone: string) {
  return dateOnly(DateTime.fromJSDate(value).setZone(zone).toISODate()!);
}
export function shiftTimes(date: Date, start: number, end: number, zone: string) {
  const d = DateTime.fromISO(isoDate(date), { zone }).startOf('day');
  return {
    start: d.plus({ minutes: start }).toJSDate(),
    end: d.plus({ days: end <= start ? 1 : 0, minutes: end }).toJSDate(),
  };
}
