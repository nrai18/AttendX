export const DEFAULT_APK_DOWNLOAD_URL =
  "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk";

/**
 * Sanitizes an APK download URL coming from environment variables or config.
 * Strips accidental "KEY=" prefixes (e.g. "APP_DOWNLOAD_LINK=https://..."),
 * trims surrounding quotes/whitespace, and enforces an http(s) protocol so
 * browsers never resolve a malformed value as a relative path to index.html.
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
