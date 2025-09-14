import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'

dayjs.extend(utc)
dayjs.extend(timezone)

const DEFAULT_TIMEZONE = 'Asia/Taipei'

export function getDayRange(date: Date | string, tz = DEFAULT_TIMEZONE): { end: Date; start: Date; } {
  const day = dayjs(date).tz(tz)
  const start = day.startOf('day').toDate()
  const end = day.endOf('day').toDate()
  return { end, start }
}

export function getDateRange(from: Date | string, to: Date | string, tz = DEFAULT_TIMEZONE): { end: Date; start: Date; } {
  const start = dayjs(from).tz(tz).startOf('day').toDate()
  const end = dayjs(to).tz(tz).endOf('day').toDate()
  return { end, start }
}

export function isWithinRange(timestamp: Date | number | string, start: Date, end: Date): boolean {
  const ts = dayjs(timestamp).toDate()
  return ts >= start && ts <= end
}

export function formatDate(date: Date | string, format = 'YYYY-MM-DD'): string {
  return dayjs(date).format(format)
}

export function parseTimestamp(value: unknown): Date | null {
  if (!value) return null
  
  try {
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = dayjs(value)
      return parsed.isValid() ? parsed.toDate() : null
    }

    if (value instanceof Date) {
      return value
    }
  } catch {
    // Fall through to null
  }
  
  return null
}