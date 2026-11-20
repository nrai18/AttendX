import { Capacitor } from "@capacitor/core";
import { GoogleSignIn } from "@capawesome/capacitor-google-sign-in";
import { api } from "../lib/api";
import { useConfigStore } from "../stores/configStore";

const DEFAULT_GOOGLE_CLIENT_ID =
  "729387616931-qlajf1dss2qi1cta5pvc3dos03fh4coi.apps.googleusercontent.com";

let initPromise: Promise<void> | null = null;
let lastWarmupAt = 0;

function getGoogleClientId(): string {
  return (
    useConfigStore.getState().googleClientId ||
    import.meta.env.VITE_GOOGLE_CLIENT_ID ||
    DEFAULT_GOOGLE_CLIENT_ID
  );
}

/**
 * Fires a silent non-blocking /health ping to start waking the Render backend
 * and Neon DB while the user views the login screen or selects a Google account.
 */
export function warmUpAuthServer(force = false): void {
  const now = Date.now();
  if (!force && now - lastWarmupAt < 20_000) return;
  lastWarmupAt = now;
  api.get("/health", { timeout: 45_000, silent: true, skipToast: true }).catch(() => {});
}

/**
 * Ensures Capawesome's native GoogleSignIn plugin is initialized before signIn() is called.
 * Deduplicates concurrent calls and resets cleanly if initialization fails.
 */
export function ensureGoogleSignInInitialized(forceReinit = false): Promise<void> {
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  if (forceReinit) {
    initPromise = null;
  }
  if (!initPromise) {
    initPromise = GoogleSignIn.initialize({
      clientId: getGoogleClientId(),
    }).catch((err) => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/**
 * Clears Android Credential Manager state non-blockingly on logout so the next
 * Google Sign-In does not hit stale credential manager caches.
 */
export async function signOutGoogleNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await GoogleSignIn.signOut();
  } catch {
    // Ignore when not previously signed in via Credential Manager
  }
}

/**
 * Reads already-cached GPS coordinates synchronously in 0ms so login NEVER blocks
 * on Android location permission modals or slow satellite fixes.
 */
export function getCachedLocationHeaders(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem("attendx_live_coords");
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed?.lat && parsed?.lon) {
      return {
        "x-attendx-lat": String(parsed.lat),
        "x-attendx-lon": String(parsed.lon),
      };
    }
  } catch {}
  return {};
}

export function isGoogleSignInCanceledError(err: any): boolean {
  const code = String(err?.code || "").toLowerCase();
  const msg = String(err?.message || "").toLowerCase();
  // Android Credential Manager sometimes reports missing SHA-1 / OAuth config as a cancellation
  // with a diagnostic message; only treat genuine user dismissal as silent cancel.
  const looksLikeConfigError =
    msg.includes("developer") ||
    msg.includes("configuration") ||
    msg.includes("client") ||
    msg.includes("reauth") ||
    msg.includes("16:") ||
    msg.includes("28433") ||
    msg.includes("28444");
  if (looksLikeConfigError) return false;
  return (
    code.includes("cancel") ||
    msg.includes("canceled") ||
    msg.includes("cancelled")
  );
}

function isRetryableAuthNetworkError(err: any): boolean {
  const status = err?.response?.status;
  const code = String(err?.code || "").toUpperCase();
  const msg = String(err?.message || "").toLowerCase();
  if (status === 400 || status === 401 || status === 403 || status === 429) {
    return false;
  }
  return (
    !err?.response ||
    status === 0 ||
    status === 408 ||
    status === 502 ||
    status === 503 ||
    status === 504 ||
    (typeof status === "number" && status >= 500) ||
    code === "ECONNABORTED" ||
    code === "ERR_NETWORK" ||
    msg.includes("timeout") ||
    msg.includes("network error") ||
    msg.includes("socket")
  );
}

export interface NativeGoogleAuthResult {
  user: any;
  accessToken: string;
  refreshToken?: string;
}

/**
 * Performs reliable native Android/iOS Google Sign-In:
 * 1. Wakes Render in parallel with the Google account picker.
 * 2. Awaits GoogleSignIn.initialize() before calling signIn() and recovers from transient
 *    NOT_INITIALIZED / binder errors once without bothering the user.
 * 3. Exchanges the valid 1-hour idToken with POST /auth/google/native using a 45s cold-start
 *    timeout and up to 3 automatic retries on transient server/network drops.
 */
export async function signInWithNativeGoogle(
  onStatusChange?: (status: string) => void
): Promise<NativeGoogleAuthResult> {
  warmUpAuthServer(true);
  onStatusChange?.("Opening Google...");
  await ensureGoogleSignInInitialized();

  let signInResult: any;
  try {
    signInResult = await GoogleSignIn.signIn();
  } catch (pickerErr: any) {
    const pickerMsg = String(pickerErr?.message || "").toLowerCase();
    const pickerCode = String(pickerErr?.code || "").toLowerCase();
    const isTransientPickerError =
      !isGoogleSignInCanceledError(pickerErr) &&
      (pickerCode.includes("not_initialized") ||
        pickerMsg.includes("not initialized") ||
        pickerMsg.includes("interrupted") ||
        pickerMsg.includes("temporarily"));

    if (isTransientPickerError) {
      await ensureGoogleSignInInitialized(true);
      await new Promise((r) => setTimeout(r, 250));
      signInResult = await GoogleSignIn.signIn();
    } else {
      throw pickerErr;
    }
  }

  const idToken = signInResult?.idToken;
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Google did not return an identity token. Please try again.");
  }

  const headers = getCachedLocationHeaders();
  const maxAttempts = 3;
  let lastError: any = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (attempt === 1) {
      onStatusChange?.("Signing in with Google...");
    } else if (attempt === 2) {
      onStatusChange?.("Waking up server, retrying...");
    } else {
      onStatusChange?.("Almost there...");
    }

    try {
      const res = await api.post(
        "/auth/google/native",
        { idToken },
        {
          headers,
          timeout: 45_000,
          silent: true,
        }
      );

      if (!res.data?.user || !res.data?.accessToken || res.data?._queued) {
        throw new Error("Could not verify Google account with server. Please try again.");
      }

      return {
        user: res.data.user,
        accessToken: res.data.accessToken,
        refreshToken: res.data.refreshToken,
      };
    } catch (err: any) {
      lastError = err;
      if (!isRetryableAuthNetworkError(err) || attempt === maxAttempts) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, attempt === 1 ? 1200 : 2500));
    }
  }

  throw lastError || new Error("Google Sign-In failed. Please try again.");
}
