export const DEFAULT_APK_DOWNLOAD_URL =
  "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk";

/**
 * Sanitizes an APK download URL from remote config or build-time env vars.
 * Strips accidental "KEY=" prefixes (e.g. "APP_DOWNLOAD_LINK=https://..."),
 * trims surrounding quotes/whitespace, and enforces an http(s) URL so
 * relative path resolution can never download index.html instead of the APK.
 */
export function sanitizeDownloadUrl(
  raw?: string | null,
  fallback: string = DEFAULT_APK_DOWNLOAD_URL
): string {
  if (!raw || typeof raw !== "string") return fallback;
  let cleaned = raw.trim().replace(/^["']+|["']+$/g, "").trim();
  cleaned = cleaned.replace(/^[A-Z0-9_]+\s*=\s*/i, "").trim();
  cleaned = cleaned.replace(/^["']+|["']+$/g, "").trim();
  if (!/^https?:\/\/\S+$/i.test(cleaned)) {
    return fallback;
  }
  return cleaned;
}
