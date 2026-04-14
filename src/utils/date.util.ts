/**
 * IST date utilities for the India/Whitefield market.
 *
 * The server (Railway) runs in UTC. Indian Standard Time is UTC+5:30.
 * Using `new Date().toISOString().slice(0, 10)` on a UTC server gives
 * the previous day before 5:30 AM IST. These helpers ensure all
 * "today" calculations use the IST calendar date.
 */

const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Returns today's date in IST as YYYY-MM-DD.
 * Works correctly regardless of server timezone.
 */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}

/**
 * Converts a Date/timestamp to its IST calendar date (YYYY-MM-DD).
 * Useful when comparing activity creation dates to attendance dates.
 */
export function toISTDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('en-CA', { timeZone: IST_TIMEZONE });
}
