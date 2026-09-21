/** Parse a YYYY-MM-DD calendar date as local midnight. */
export function parseLocalDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

/** Inclusive end-of-day for a YYYY-MM-DD string, otherwise a Date parse. */
export function parseEndDate(value: string): Date | null {
  const local = parseLocalDate(value);
  if (local) {
    local.setHours(23, 59, 59, 999);
    return local;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Start-of-day for a YYYY-MM-DD string, otherwise a Date parse. */
export function parseStartDate(value: string): Date | null {
  const local = parseLocalDate(value);
  if (local) return local;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
