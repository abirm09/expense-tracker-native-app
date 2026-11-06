/**
 * Format a Date as a calendar date in the device's local timezone.
 *
 * `Date.toISOString()` always returns UTC, so in timezones ahead of UTC
 * (e.g. Asia/Dhaka, UTC+6) it can return yesterday's date after 6 PM.
 * Ledger dates must follow the user's local calendar day.
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** First and last day of the month containing `date`, as local YYYY-MM-DD. */
export function getLocalMonthRange(date: Date = new Date()): {
  startDate: string;
  endDate: string;
} {
  const year = date.getFullYear();
  const month = date.getMonth();
  return {
    startDate: getLocalDateString(new Date(year, month, 1)),
    endDate: getLocalDateString(new Date(year, month + 1, 0)),
  };
}

/** Validate a strict YYYY-MM-DD calendar date (rejects e.g. 2026-02-31). */
export function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const parsed = new Date(year, month - 1, day);
  return (
    parsed.getFullYear() === year &&
    parsed.getMonth() === month - 1 &&
    parsed.getDate() === day
  );
}
