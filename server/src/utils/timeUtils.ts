/**
 * Server-side time normalization utilities
 * Normalizes start and end time strings to 24-hour "HH:mm" representation.
 */

export function normalizeTimeString(
  timeStr: string | null | undefined,
  fallback: string = "00:00",
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
  const ampmMatch = raw.match(
    /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/i,
  );
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
