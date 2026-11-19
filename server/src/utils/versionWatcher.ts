import fs from "fs";
import path from "path";
import { redisClient } from "../lib/redis";
import { PushNotificationService } from "../services/push_notification.service";

export interface VersionWatcherRedis {
  status: string;
  get(key: string): Promise<string | null>;
  set?(key: string, value: string, expiryMode: "EX", time: number, setMode: "NX"): Promise<"OK" | null>;
  setnx(key: string, value: string): Promise<number>;
  del(key: string): Promise<number>;
}

export interface VersionWatcherOptions {
  env?: NodeJS.ProcessEnv;
  redis?: VersionWatcherRedis;
  fetchFn?: typeof fetch;
  broadcastFn?: (title: string, body: string, data?: any) => Promise<boolean>;
  version?: string;
  githubOwner?: string;
  githubRepo?: string;
}

export type VersionWatcherOutcome =
  | { status: "skipped_non_prod"; reason: string }
  | { status: "skipped_redis_not_ready" }
  | { status: "already_notified"; version: string }
  | { status: "skipped_no_release"; version: string; reason: string }
  | { status: "skipped_lock_busy"; version: string }
  | { status: "broadcast_failed"; version: string }
  | { status: "broadcasted"; version: string; apkAssetName: string };

const NOTIFY_TTL_SECONDS = 60 * 60 * 24 * 90; // 90 days

/**
 * Only allow automated update FCM broadcasts in live cloud production
 * (explicit production mode on Render, or explicit opt-in flag) so local
 * dev boots using production .env credentials never blast users' phones.
 */
export function isProductionVersionWatcherEnv(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.NODE_ENV !== "production") return false;
  if (env.DISABLE_VERSION_WATCHER === "true") return false;
  return (
    env.RENDER === "true" ||
    Boolean(env.RENDER_SERVICE_ID) ||
    Boolean(env.RENDER_INSTANCE_ID) ||
    env.ENABLE_VERSION_WATCHER === "true"
  );
}

/**
 * Read current backend package version cleanly regardless of CWD (server/ or repo root).
 */
export function resolveServerPackageVersion(fallback = "4.4.1"): string {
  const candidates = [
    path.resolve(process.cwd(), "package.json"),
    path.resolve(__dirname, "../../package.json"),
    path.resolve(__dirname, "../package.json"),
  ];
  for (const pkgPath of candidates) {
    try {
      if (!fs.existsSync(pkgPath)) continue;
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg?.name === "server" && pkg?.version) {
        return String(pkg.version).replace(/^v/i, "").trim();
      }
    } catch {
      // Ignore malformed/unreadable candidates and continue
    }
  }
  return fallback.replace(/^v/i, "").trim();
}

/**
 * Verify via GitHub Releases API that a non-draft, non-prerelease release
 * matching `version` is published and actually contains a downloadable `.apk` asset.
 */
export async function verifyGitHubReleaseHasApk(
  version: string,
  options: {
    owner?: string;
    repo?: string;
    fetchFn?: typeof fetch;
    githubToken?: string;
  } = {}
): Promise<{ ok: true; apkAssetName: string; tagName: string } | { ok: false; reason: string }> {
  const cleanVersion = version.replace(/^v/i, "").trim();
  const owner = options.owner || "nrai18";
  const repo = options.repo || "AttendX";
  const fetchImpl = options.fetchFn || globalThis.fetch;

  if (typeof fetchImpl !== "function") {
    return { ok: false, reason: "fetch_unavailable" };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "AttendX-Server-VersionWatcher",
  };
  if (options.githubToken) {
    headers.Authorization = `Bearer ${options.githubToken}`;
  }

  const tagCandidates = [`v${cleanVersion}`, cleanVersion];
  let lastReason = "release_not_found";

  for (const tag of tagCandidates) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    timeoutId.unref?.();

    try {
      const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/releases/tags/${encodeURIComponent(tag)}`;
      const res = await fetchImpl(url, { headers, signal: controller.signal });

      if (res.status === 404) {
        lastReason = `release_tag_404:${tag}`;
        continue;
      }
      if (!res.ok) {
        return { ok: false, reason: `github_http_${res.status}` };
      }

      const release: any = await res.json();
      if (!release || release.draft === true || release.prerelease === true) {
        return { ok: false, reason: "release_draft_or_prerelease" };
      }

      const releaseTag = String(release.tag_name || "").replace(/^v/i, "").trim();
      if (releaseTag !== cleanVersion) {
        return { ok: false, reason: `tag_mismatch:${releaseTag}!=${cleanVersion}` };
      }

      const assets = Array.isArray(release.assets) ? release.assets : [];
      const apkAsset =
        assets.find(
          (a: any) =>
            String(a?.name || "").toLowerCase() === "attendx.apk" &&
            Number(a?.size || 0) > 0 &&
            Boolean(a?.browser_download_url)
        ) ||
        assets.find(
          (a: any) =>
            String(a?.name || "").toLowerCase().endsWith(".apk") &&
            Number(a?.size || 0) > 0 &&
            Boolean(a?.browser_download_url)
        );

      if (!apkAsset) {
        return { ok: false, reason: "missing_apk_asset" };
      }

      return {
        ok: true,
        apkAssetName: String(apkAsset.name),
        tagName: String(release.tag_name),
      };
    } catch (err: any) {
      return { ok: false, reason: err?.name === "AbortError" ? "github_timeout" : err?.message || "github_fetch_error" };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { ok: false, reason: lastReason };
}

/**
 * Safely check once whether the deployed production version should announce a new release via FCM.
 * Never locks Redis or pushes FCM unless the environment is Render production AND the matching
 * GitHub Release with an `.apk` asset is verified live.
 */
export async function checkAndBroadcastVersionUpdate(
  opts: VersionWatcherOptions = {}
): Promise<VersionWatcherOutcome> {
  const env = opts.env || process.env;
  if (!isProductionVersionWatcherEnv(env)) {
    return {
      status: "skipped_non_prod",
      reason: `NODE_ENV=${env.NODE_ENV || "unset"}, RENDER=${env.RENDER || "unset"}`,
    };
  }

  const redis = opts.redis || redisClient;
  if (redis.status !== "ready") {
    return { status: "skipped_redis_not_ready" };
  }

  const currentVersion = (opts.version || resolveServerPackageVersion()).replace(/^v/i, "").trim();
  const lockKey = `notified_update_${currentVersion}`;

  // Avoid hitting GitHub API on routine Render restarts if this version was already announced
  const alreadyNotified = await redis.get(lockKey).catch(() => null);
  if (alreadyNotified === "1") {
    return { status: "already_notified", version: currentVersion };
  }

  const owner = opts.githubOwner || env.GITHUB_OWNER || env.VITE_GITHUB_OWNER || "nrai18";
  const repo = opts.githubRepo || env.GITHUB_REPO || env.VITE_GITHUB_REPO || "AttendX";
  const releaseCheck = await verifyGitHubReleaseHasApk(currentVersion, {
    owner,
    repo,
    fetchFn: opts.fetchFn,
    githubToken: env.GITHUB_TOKEN,
  });

  if (!releaseCheck.ok) {
    console.log(`[Version Watcher] Skipping push for v${currentVersion}: ${releaseCheck.reason}.`);
    return { status: "skipped_no_release", version: currentVersion, reason: releaseCheck.reason };
  }

  // Acquire distributed lock only AFTER GitHub Release + .apk verification succeeds
  let acquired = false;
  try {
    if (typeof redis.set === "function") {
      acquired = (await redis.set(lockKey, "1", "EX", NOTIFY_TTL_SECONDS, "NX")) === "OK";
    } else {
      acquired = (await redis.setnx(lockKey, "1")) === 1;
    }
  } catch {
    acquired = false;
  }

  if (!acquired) {
    return { status: "skipped_lock_busy", version: currentVersion };
  }

  const broadcast = opts.broadcastFn || PushNotificationService.broadcastMessage.bind(PushNotificationService);
  try {
    console.log(
      `[Version Watcher] Verified GitHub Release ${releaseCheck.tagName} (${releaseCheck.apkAssetName}). Broadcasting FCM update notification...`
    );
    const ok = await broadcast(
      `AttendX Update ${currentVersion} is Live! 🚀`,
      "Tap to download the update and see what's new!",
      { type: "app_update", version: currentVersion }
    );
    if (!ok) {
      await redis.del(lockKey).catch(() => 0);
      return { status: "broadcast_failed", version: currentVersion };
    }
    return { status: "broadcasted", version: currentVersion, apkAssetName: releaseCheck.apkAssetName };
  } catch (err) {
    await redis.del(lockKey).catch(() => 0);
    throw err;
  }
}

/**
 * Schedules guarded post-boot checks in production. If Render deploys slightly before
 * the GitHub Release + APK upload completes, retries cleanly every 5 minutes (up to 6 times)
 * without ever locking Redis prematurely.
 */
export function scheduleVersionWatcher(opts: VersionWatcherOptions = {}): void {
  const env = opts.env || process.env;
  if (!isProductionVersionWatcherEnv(env)) {
    console.log("[Version Watcher] Disabled in non-production / local environment.");
    return;
  }

  const MAX_ATTEMPTS = 6;
  const RETRY_DELAY_MS = 5 * 60 * 1000;

  const attemptCheck = (attempt: number, delayMs: number) => {
    const timer = setTimeout(async () => {
      try {
        const outcome = await checkAndBroadcastVersionUpdate(opts);
        if (
          (outcome.status === "skipped_no_release" ||
            outcome.status === "skipped_redis_not_ready" ||
            outcome.status === "broadcast_failed") &&
          attempt < MAX_ATTEMPTS
        ) {
          attemptCheck(attempt + 1, RETRY_DELAY_MS);
        }
      } catch (error) {
        console.error("[Version Watcher] Failed to check or send update notification:", error);
      }
    }, delayMs);
    timer.unref?.();
  };

  attemptCheck(1, 10000);
}
