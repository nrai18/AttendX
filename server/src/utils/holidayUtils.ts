/**
 * Utility functions for holiday normalization and smart deduplication.
 * Ensures official central holidays and academic calendar variations
 * (e.g., "Dussehra" vs "Dussehra (Vijay Dashmi)") are recognized as the same holiday.
 */

export function normalizeHolidayTitle(t: string): string {
  if (!t) return "";
  return t
    .toLowerCase()
    .replace(/\(.*?\)/g, "") // remove parentheticals like (Vijay Dashmi), (Deepavali)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const HOLIDAY_EQUIVALENCE_GROUPS = [
  ["dussehra", "vijay dashmi", "vijayadashami", "dasara", "dashami"],
  ["diwali", "deepavali", "deepawali"],
  ["holi", "dolyatra", "dhulandi"],
  ["eid", "id-ul-fitr", "id ul fitr", "ramzan id", "eid-ul-fitr"],
  ["bakrid", "id-ul-zuha", "eid al-adha", "bakr id"],
  ["muharram", "moharram"],
  ["gandhi", "mahatma gandhi", "gandhi jayanti"],
  ["independence", "independence day"],
  ["republic", "republic day"],
  ["christmas", "xmas"],
  ["buddha", "buddha purnima", "vesak"],
  ["mahavir", "mahavir jayanti"],
  ["guru nanak", "gurpurab", "nanak"],
  ["janmashtami", "krishna janmashtami", "gokulashtami"],
  ["ram navami", "rama navami"],
  ["shivratri", "maha shivratri", "shivaratri"],
  ["makar sankranti", "sankranti", "pongal", "magha bihu"],
  ["raksha bandhan", "rakshabandhan", "rakhi"]
];

export function isSameHoliday(titleA: string, titleB: string): boolean {
  if (!titleA || !titleB) return false;
  const rawA = titleA.toLowerCase().trim();
  const rawB = titleB.toLowerCase().trim();
  if (rawA === rawB) return true;

  const normA = normalizeHolidayTitle(titleA);
  const normB = normalizeHolidayTitle(titleB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  if (normA.includes(normB) || normB.includes(normA)) return true;

  for (const group of HOLIDAY_EQUIVALENCE_GROUPS) {
    const matchA = group.some(alias => rawA.includes(alias) || normA.includes(alias));
    const matchB = group.some(alias => rawB.includes(alias) || normB.includes(alias));
    if (matchA && matchB) return true;
  }
  return false;
}
