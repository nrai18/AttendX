/**
 * Timetable & Agenda Time Utilities
 * Normalizes start and end time strings to local 24-hour "HH:mm" representation
 * to prevent UTC offset shifts and inconsistencies across timezones.
 */

/**
 * Normalizes any time representation (HH:mm, HH:mm:ss, 12-hour AM/PM, ISO UTC string)
 * into a consistent local 24-hour "HH:mm" time string without UTC offset shifts.
 *
 * Examples:
 * - "09:00" -> "09:00"
 * - "9:00" -> "09:00"
 * - "09:00:00" -> "09:00"
 * - "9:00 AM" -> "09:00"
 * - "2:30 PM" -> "14:30"
 * - "2026-08-15T09:00:00.000Z" -> "09:00"
 * - "1970-01-01T14:00:00Z" -> "14:00"
 */
export function normalizeTimeString(
  timeStr: string | null | undefined,
  fallback: string = "00:00"
): string {
  if (!timeStr) return fallback;
  const raw = String(timeStr).trim();
  if (!raw) return fallback;

  // Case 1: ISO 8601 string containing 'T' (e.g. 2026-08-15T09:00:00.000Z or 1970-01-01T09:50:00Z)
  if (raw.includes("T")) {
    const timePart = raw.split("T")[1];
    const match = timePart.match(/^(\d{1,2}):(\d{2})/);
    if (match) {
      const hours = match[1].padStart(2, "0");
      const minutes = match[2];
      return `${hours}:${minutes}`;
    }
  }

  // Case 2: 12-hour AM/PM format (e.g. "9:00 AM", "09:50 PM", "2:30pm")
  const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/i);
  if (ampmMatch && ampmMatch[3]) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const modifier = ampmMatch[3].toUpperCase();

    if (modifier === "PM" && hours < 12) {
      hours += 12;
    } else if (modifier === "AM" && hours === 12) {
      hours = 0;
    }

    return `${String(hours).padStart(2, "0")}:${minutes}`;
  }

  // Case 3: Standard 24h format "HH:mm", "H:mm", or "HH:mm:ss"
  const standardMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?/);
  if (standardMatch) {
    const hours = standardMatch[1].padStart(2, "0");
    const minutes = standardMatch[2];
    return `${hours}:${minutes}`;
  }

  return raw;
}

/**
 * Formats a time range (startTime, endTime) into a clean, normalized string
 * e.g. "09:00 - 09:50" or "09:00 - 10:00"
 */
export function formatTimeRange(
  startTime?: string | null,
  endTime?: string | null,
  fallback: string = "TBA"
): string {
  const start = normalizeTimeString(startTime);
  const end = normalizeTimeString(endTime);

  if ((!start || start === "00:00") && (!end || end === "00:00")) {
    return fallback;
  }
  if (!start || start === "00:00") return end;
  if (!end || end === "00:00") return start;

  return `${start} - ${end}`;
}

/**
 * Converts a 24-hour "HH:mm" string to a human-friendly 12-hour format
 * e.g. "09:00" -> "9:00 AM", "14:30" -> "2:30 PM"
 */
export function formatTo12Hour(timeStr: string | null | undefined): string {
  const norm = normalizeTimeString(timeStr);
  if (!norm || norm === "00:00") return "";
  const [hStr, mStr] = norm.split(":");
  let hours = parseInt(hStr, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${mStr} ${ampm}`;
}
