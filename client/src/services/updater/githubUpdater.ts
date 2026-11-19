import { GitHubRelease, NativeUpdateInfo } from "./updateTypes";
import { nativeUpdater } from "./nativeUpdater.ts";
import { stripShaFromChangelog } from "../../components/updates/UpdateChangelog";

const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || "nrai18";
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || "AttendX";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

/**
 * Compares two semantic version strings (e.g. "4.3.0" vs "4.3.1", "v4.4.0" vs "4.3.1").
 * Returns true strictly if remoteVersion is newer than localVersion.
 */
export function isVersionNewer(remoteVersion: string, localVersion: string): boolean {
  if (!remoteVersion || !localVersion) return false;

  const [remoteCore, remotePre = ""] = remoteVersion.replace(/^v/i, "").trim().split("-");
  const [localCore, localPre = ""] = localVersion.replace(/^v/i, "").trim().split("-");

  const rParts = remoteCore.split(".").map((p) => parseInt(p, 10));
  const lParts = localCore.split(".").map((p) => parseInt(p, 10));

  const maxLen = Math.max(rParts.length, lParts.length);
  for (let i = 0; i < maxLen; i++) {
    const r = isNaN(rParts[i]) ? 0 : rParts[i];
    const l = isNaN(lParts[i]) ? 0 : lParts[i];
    if (r > l) return true;
    if (r < l) return false;
  }

  if (!remotePre && localPre) return true;
  if (remotePre && !localPre) return false;
  if (remotePre && localPre) return remotePre.localeCompare(localPre) > 0;
  return false;
}

export type ReleaseFetchStatus = "ok" | "up-to-date" | "rate-limited" | "network-error";

export class GitHubUpdater {
  private static cachedRelease: GitHubRelease | null = null;
  private static lastCheckTime = 0;

  static async fetchLatestReleaseWithStatus(force = false): Promise<{
    release: GitHubRelease | null;
    status: ReleaseFetchStatus;
  }> {
    const now = Date.now();
    if (
      !force &&
      this.cachedRelease &&
      now - this.lastCheckTime < 10 * 60 * 1000
    ) {
      return { release: this.cachedRelease, status: "ok" };
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      const res = await fetch(GITHUB_API_URL, {
        headers: {
          Accept: "application/vnd.github.v3+json",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 403 || res.status === 429) {
        console.warn("[GitHubUpdater] GitHub API rate limit reached.");
        return { release: this.cachedRelease, status: "rate-limited" };
      }

      if (!res.ok) {
        return { release: null, status: "network-error" };
      }

      const release: GitHubRelease = await res.json();
      if (release.draft || release.prerelease) {
        return { release: null, status: "up-to-date" };
      }

      this.cachedRelease = release;
      this.lastCheckTime = now;
      return { release, status: "ok" };
    } catch (err) {
      console.warn("[GitHubUpdater] Failed to query releases:", err);
      return { release: force ? null : this.cachedRelease, status: "network-error" };
    }
  }

  static async fetchLatestRelease(force = false): Promise<GitHubRelease | null> {
    const { release } = await this.fetchLatestReleaseWithStatus(force);
    return release;
  }

  static async checkForNativeUpdateWithStatus(force = false): Promise<{
    info: NativeUpdateInfo | null;
    status: ReleaseFetchStatus;
  }> {
    if (!nativeUpdater.isAvailable()) return { info: null, status: "up-to-date" };
    const appInfo = await nativeUpdater.getAppInfo();
    if (!appInfo) return { info: null, status: "network-error" };

    const { release, status } = await this.fetchLatestReleaseWithStatus(force);
    if (!release) return { info: null, status };

    const assets = Array.isArray(release.assets) ? release.assets : [];
    const apkAsset = assets.find(
      (a) => a.name.toLowerCase() === "attendx.apk" || a.name.endsWith(".apk"),
    );
    if (!apkAsset) return { info: null, status: "up-to-date" };

    // Null-safe SHA-256 extraction for internal verification (stripped from UI changelog below)
    const bodyText = typeof release.body === "string" ? release.body : "";
    let sha256: string | undefined;
    const shaMatch =
      bodyText.match(/(?:sha[- ]?256|checksum)[^a-f0-9\n]{0,30}([a-fA-F0-9]{64})/i) ||
      bodyText.match(/\b([a-fA-F0-9]{64})\b/);
    if (shaMatch) {
      sha256 = shaMatch[1].toLowerCase();
    }

    const cleanChangelog = stripShaFromChangelog(bodyText);

    const releaseVersion = release.tag_name.replace(/^v/i, "").trim();
    const installedVersion = (appInfo.versionName || "").replace(/^v/i, "").trim();

    if (!isVersionNewer(releaseVersion, installedVersion)) {
      console.log(
        `[GitHubUpdater] Installed build (v${installedVersion}) is up to date or newer than remote (v${releaseVersion}). Skipping update prompt.`,
      );
      return { info: null, status: "up-to-date" };
    }

    return {
      status: "ok",
      info: {
        tag: release.tag_name,
        versionName: releaseVersion,
        releaseTitle: release.name || `AttendX ${release.tag_name}`,
        changelogMarkdown:
          cleanChangelog || "Performance improvements and maintenance fixes.",
        publishedAt: release.published_at,
        apkUrl: apkAsset.browser_download_url,
        apkSizeMb: Number((apkAsset.size / (1024 * 1024)).toFixed(1)),
        expectedSha256: sha256,
        installedVersionCode: appInfo.versionCode,
        installedVersionName: appInfo.versionName,
      },
    };
  }

  static async checkForNativeUpdate(force = false): Promise<NativeUpdateInfo | null> {
    const { info } = await this.checkForNativeUpdateWithStatus(force);
    return info;
  }
}
