import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isoWeek from 'dayjs/plugin/isoWeek';
import utc from 'dayjs/plugin/utc';

dayjs.extend(utc);
dayjs.extend(isoWeek);
dayjs.extend(customParseFormat);

/** Current instant as an ISO-8601 string (UTC). The app's canonical timestamp format. */
export function nowIso(): string {
  return dayjs().utc().toISOString();
}

/** Add `days` to a base date (default now) and return an ISO string. */
export function addDays(days: number, from: Date | string = new Date()): string {
  return dayjs(from).add(days, 'day').toISOString();
}

/** Add `hours` to a base date and return an ISO string. */
export function addHours(hours: number, from: Date | string = new Date()): string {
  return dayjs(from).add(hours, 'hour').toISOString();
}

/**
 * Set a specific local hour-of-day on a date (e.g. schedule a reminder for 9am).
 * Minutes/seconds/ms are zeroed.
 */
export function atHour(hour: number, from: Date | string = new Date()): string {
  return dayjs(from).hour(hour).minute(0).second(0).millisecond(0).toISOString();
}

/** Milliseconds between `target` and now. Negative means `target` is in the past. */
export function msUntil(target: Date | string): number {
  return dayjs(target).diff(dayjs());
}

export function isPast(target: Date | string): boolean {
  return dayjs(target).isBefore(dayjs());
}

/** Start (Monday 00:00) of the ISO week containing `from`. */
export function startOfIsoWeek(from: Date | string = new Date()): string {
  return dayjs(from).startOf('isoWeek').toISOString();
}

/** Inclusive day key `YYYY-MM-DD` used for heatmaps and streak buckets. */
export function dayKey(from: Date | string = new Date()): string {
  return dayjs(from).format('YYYY-MM-DD');
}

export { dayjs };
