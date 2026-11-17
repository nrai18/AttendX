import { nativeUpdater } from "./nativeUpdater";
import { api } from "../../lib/api";
import { isUserAuthenticated } from "../../stores/authStore";

const SESSIONS_CACHE_KEY = "attendx_cached_linked_devices";

export interface LinkedSessionLike {
  id?: string;
  os?: string | null;
  browser?: string | null;
  deviceType?: string | null;
  isCurrent?: boolean;
}

export function isNativeAndroidLinkedSession(
  session?: LinkedSessionLike | null,
): boolean {
  if (!session) return false;
  const os = String(session.os || "").toLowerCase();
  const browser = String(session.browser || "");
  const isAttendxNativeClient =
    browser.startsWith("AttendX Native App") ||
    /^AttendX(?:\s+[^\s(]+)?\s*\(/i.test(browser);
  return os === "android" && isAttendxNativeClient;
}

export async function verifyNativeUpdaterEligibility(
  forceSessionRefresh = false,
): Promise<{ eligible: boolean; reason: string; session?: LinkedSessionLike | null }> {
  // 1. Hard synchronous guard: blocks website on laptop & website on mobile browser
  if (!nativeUpdater.isAvailable()) {
    return { eligible: false, reason: "Not running inside native Android APK" };
  }

  // 2. If logged out (pre-login launch), runtime check is authoritative
  if (!isUserAuthenticated()) {
    return { eligible: true, reason: "Unauthenticated native Android launch" };
  }

  // 3. Verify via Linked Devices sessions (/users/sessions or offline cache)
  let sessions: LinkedSessionLike[] | null = null;
  const isOnline = typeof navigator === "undefined" || navigator.onLine;

  if (isOnline && forceSessionRefresh) {
    try {
      const res = await api.get("/users/sessions", {
        silent: true,
        skipToast: true,
        timeout: 6000,
      } as any);
      if (Array.isArray(res.data)) {
        sessions = res.data;
        try {
          localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(res.data));
        } catch {}
      }
    } catch {}
  }

  if (!sessions && !forceSessionRefresh) {
    try {
      const raw = localStorage.getItem(SESSIONS_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) sessions = parsed;
      }
    } catch {}
  }

  // If online and cache didn't exist yet, fetch Linked Devices now
  if (!sessions && isOnline) {
    try {
      const res = await api.get("/users/sessions", {
        silent: true,
        skipToast: true,
        timeout: 6000,
      } as any);
      if (Array.isArray(res.data)) {
        sessions = res.data;
        try {
          localStorage.setItem(SESSIONS_CACHE_KEY, JSON.stringify(res.data));
        } catch {}
      }
    } catch {}
  }

  const currentSession = sessions?.find((s) => s.isCurrent) || null;
  if (currentSession && currentSession.id !== "current-local-session") {
    if (!isNativeAndroidLinkedSession(currentSession)) {
      return {
        eligible: false,
        reason: `Current Linked Devices session is not native Android (${currentSession.browser} on ${currentSession.os})`,
        session: currentSession,
      };
    }
  }

  return { eligible: true, reason: "Verified native Android session", session: currentSession };
}
