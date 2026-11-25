import { useEffect, useState } from "react";
import { api } from "../lib/api";

const AVATAR_CACHE_PREFIX = "attendx_avatar_data_";
const AVATAR_SOURCE_PREFIX = "attendx_avatar_src_";
const inFlightAvatarPromises = new Map<string, Promise<string | null>>();

export function normalizeRawAvatarUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = String(url).trim();
  if (!trimmed || trimmed === "null" || trimmed === "undefined") return null;
  if (/^(https?:|data:|blob:|\/)/i.test(trimmed)) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
}

export function getCachedLocalAvatar(userId?: string | null, rawUrl?: string | null): string | null {
  const normalized = normalizeRawAvatarUrl(rawUrl);
  if (!normalized) return null;
  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }
  if (!userId || typeof window === "undefined") return null;
  try {
    const cachedSrc = localStorage.getItem(`${AVATAR_SOURCE_PREFIX}${userId}`);
    const cachedData = localStorage.getItem(`${AVATAR_CACHE_PREFIX}${userId}`);
    if (cachedData && cachedData.startsWith("data:image/") && (!cachedSrc || cachedSrc === normalized)) {
      return cachedData;
    }
  } catch {}
  return null;
}

function blobToCompressedDataUrl(blob: Blob, maxDim = 360): Promise<string> {
  return new Promise((resolve, reject) => {
    // SVG avatars (e.g. DiceBear) can be converted directly to base64 data URLs cleanly
    if (blob.type.includes("svg")) {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") resolve(reader.result);
        else reject(new Error("Empty SVG reader result"));
      };
      reader.onerror = () => reject(new Error("Failed reading SVG blob"));
      reader.readAsDataURL(blob);
      return;
    }

    const objUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width || maxDim;
        let h = img.naturalHeight || img.height || maxDim;
        if (w > h && w > maxDim) {
          h = Math.max(1, Math.round((h * maxDim) / w));
          w = maxDim;
        } else if (h > maxDim) {
          w = Math.max(1, Math.round((w * maxDim) / h));
          h = maxDim;
        }
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          URL.revokeObjectURL(objUrl);
          reject(new Error("Canvas context unavailable"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL("image/jpeg", 0.88);
        URL.revokeObjectURL(objUrl);
        resolve(dataUrl);
      } catch (err) {
        URL.revokeObjectURL(objUrl);
        reject(err);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error("Failed decoding avatar blob"));
    };
    img.src = objUrl;
  });
}

/**
 * Resolves any user avatar URL (`https://lh3.googleusercontent.com/...`, DiceBear, or `data:`)
 * into a CORS-free local `data:image/...` URL persisted in `localStorage`.
 * Uses `cache: "reload"` on first fetch so non-CORS `<img>` cache entries never poison Canvas exports!
 */
export async function ensureLocalAvatarDataUrl(
  userId?: string | null,
  rawUrl?: string | null,
): Promise<string | null> {
  const normalized = normalizeRawAvatarUrl(rawUrl);
  if (!normalized) return null;
  if (normalized.startsWith("data:") || normalized.startsWith("blob:")) {
    return normalized;
  }

  const existing = getCachedLocalAvatar(userId, normalized);
  if (existing) return existing;

  const dedupKey = `${userId || "anon"}:${normalized}`;
  const active = inFlightAvatarPromises.get(dedupKey);
  if (active) return active;

  const work = (async (): Promise<string | null> => {
    let dataUrl: string | null = null;

    // 1. Direct CORS fetch bypassing poisoned non-CORS browser image cache
    try {
      const resp = await fetch(normalized, {
        mode: "cors",
        credentials: "omit",
        referrerPolicy: "no-referrer",
        cache: "reload",
      });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 0) {
          dataUrl = await blobToCompressedDataUrl(blob);
        }
      }
    } catch {
      // Fall through to authenticated server proxy if external host lacks CORS headers
    }

    // 2. Authenticated server-side avatar fetch fallback (zero browser CORS limits)
    if (!dataUrl && userId && typeof navigator !== "undefined" && navigator.onLine) {
      try {
        const proxyRes = await api.get("/users/me/avatar-data", {
          silent: true,
          skipToast: true,
          skipErrorToast: true,
        } as any);
        if (typeof proxyRes.data?.dataUrl === "string" && proxyRes.data.dataUrl.startsWith("data:image/")) {
          dataUrl = proxyRes.data.dataUrl;
        }
      } catch {}
    }

    if (dataUrl && userId && typeof window !== "undefined") {
      try {
        localStorage.setItem(`${AVATAR_SOURCE_PREFIX}${userId}`, normalized);
        localStorage.setItem(`${AVATAR_CACHE_PREFIX}${userId}`, dataUrl);
        window.dispatchEvent(new CustomEvent("attendx-avatar-cached", { detail: { userId, dataUrl } }));
      } catch {}
    }

    return dataUrl;
  })().finally(() => {
    inFlightAvatarPromises.delete(dedupKey);
  });

  inFlightAvatarPromises.set(dedupKey, work);
  return work;
}

export function clearCachedAvatars() {
  if (typeof window === "undefined") return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(AVATAR_CACHE_PREFIX) || k.startsWith(AVATAR_SOURCE_PREFIX))) {
        keys.push(k);
      }
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

/**
 * React hook returning a locally cached `data:image/...` URL whenever available (even 100% offline),
 * smoothly upgrading remote URLs to local base64 in the background.
 */
export function useLocalAvatar(userId?: string | null, rawUrl?: string | null): string | null {
  const normalized = normalizeRawAvatarUrl(rawUrl);
  const [resolved, setResolved] = useState<string | null>(() => getCachedLocalAvatar(userId, normalized) || normalized);

  useEffect(() => {
    const localHit = getCachedLocalAvatar(userId, normalized);
    if (localHit) {
      setResolved(localHit);
      return;
    }
    setResolved(normalized);
    if (!normalized || normalized.startsWith("data:") || normalized.startsWith("blob:")) return;

    let cancelled = false;
    ensureLocalAvatarDataUrl(userId, normalized).then((dataUrl) => {
      if (!cancelled && dataUrl) {
        setResolved(dataUrl);
      }
    });

    const onCached = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (!cancelled && detail?.userId === userId && detail?.dataUrl) {
        setResolved(detail.dataUrl);
      }
    };
    window.addEventListener("attendx-avatar-cached", onCached);
    return () => {
      cancelled = true;
      window.removeEventListener("attendx-avatar-cached", onCached);
    };
  }, [userId, normalized]);

  return resolved;
}
