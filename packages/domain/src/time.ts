/**
 * Time helpers — Asia/Jakarta + business-day boundary.
 * AGENTS.md §5.4.
 */

const JAKARTA_TZ = 'Asia/Jakarta';

export type BusinessDay = {
  /** YYYY-MM-DD per the outlet's local calendar. */
  isoDate: string;
  /** UTC start of the business day. */
  startUtc: Date;
  /** UTC end (exclusive) of the business day. */
  endUtc: Date;
};

export function businessDayFor(
  at: Date,
  opts: {
    boundary?: string; // "HH:mm" — default "04:00"
    timezone?: string;
  } = {},
): BusinessDay {
  const boundary = parseHHmm(opts.boundary ?? '04:00');
  const tz = opts.timezone ?? JAKARTA_TZ;

  const local = formatInTimezone(at, tz);
  const localTotalMinutes = local.hour * 60 + local.minute;
  const boundaryMinutes = boundary.hour * 60 + boundary.minute;

  const baseDate = new Date(Date.UTC(local.year, local.month - 1, local.day));
  if (localTotalMinutes < boundaryMinutes) {
    baseDate.setUTCDate(baseDate.getUTCDate() - 1);
  }
  const isoDate = baseDate.toISOString().slice(0, 10);

  // Convert "boundary in tz on isoDate" back to UTC.
  const startUtc = utcOfLocalTime(isoDate, boundary.hour, boundary.minute, tz);
  const next = new Date(startUtc);
  next.setUTCDate(next.getUTCDate() + 1);

  return { isoDate, startUtc, endUtc: next };
}

function parseHHmm(s: string): { hour: number; minute: number } {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  if (!m) throw new RangeError(`bad HH:mm: ${s}`);
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new RangeError(`bad HH:mm: ${s}`);
  return { hour, minute };
}

function formatInTimezone(d: Date, tz: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour === '24' ? '00' : parts.hour),
    minute: Number(parts.minute),
    second: Number(parts.second),
  };
}

/** Iteratively converge on the UTC instant whose tz-local rendering matches the requested local clock. */
function utcOfLocalTime(isoDate: string, hour: number, minute: number, tz: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  let guess = new Date(Date.UTC(y, m - 1, d, hour, minute, 0));
  for (let i = 0; i < 3; i++) {
    const local = formatInTimezone(guess, tz);
    const targetMinutes = hour * 60 + minute;
    const localMinutes = local.hour * 60 + local.minute;
    const dayDelta =
      Date.UTC(local.year, local.month - 1, local.day) - Date.UTC(y, m - 1, d);
    const diffMinutes = (dayDelta / 60_000) + (localMinutes - targetMinutes);
    if (diffMinutes === 0) return guess;
    guess = new Date(guess.getTime() - diffMinutes * 60_000);
  }
  return guess;
}

/** ISO date in Jakarta tz. */
export function jakartaIsoDate(at: Date = new Date()): string {
  const local = formatInTimezone(at, JAKARTA_TZ);
  return `${local.year.toString().padStart(4, '0')}-${local.month
    .toString()
    .padStart(2, '0')}-${local.day.toString().padStart(2, '0')}`;
}
