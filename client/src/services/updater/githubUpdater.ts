import { GitHubRelease, NativeUpdateInfo } from "./updateTypes";
import { nativeUpdater } from "./nativeUpdater.ts";

const GITHUB_OWNER = import.meta.env.VITE_GITHUB_OWNER || "nrai18";
const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO || "AttendX";
const GITHUB_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

export class GitHubUpdater {
  private static cachedRelease: GitHubRelease | null = null;
  private static lastCheckTime = 0;

  static async fetchLatestRelease(
    force = false,
  ): Promise<GitHubRelease | null> {
    const now = Date.now();
    if (
      !force &&
      this.cachedRelease &&
      now - this.lastCheckTime < 10 * 60 * 1000
    ) {
      return this.cachedRelease;
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
        return this.cachedRelease;
      }

      if (!res.ok) {
        return null;
      }

      const release: GitHubRelease = await res.json();
      if (release.draft || release.prerelease) {
        return null;
      }

      this.cachedRelease = release;
      this.lastCheckTime = now;
      return release;
    } catch (err) {
      console.warn("[GitHubUpdater] Failed to query releases:", err);
      return this.cachedRelease;
    }
  }

  static async checkForNativeUpdate(
    force = false,
  ): Promise<NativeUpdateInfo | null> {
    const appInfo = await nativeUpdater.getAppInfo();
    if (!appInfo) return null;

    const release = await this.fetchLatestRelease(force);
    if (!release) return null;

    // Look for AttendX.apk in assets
    const apkAsset = release.assets.find(
      (a) => a.name.toLowerCase() === "attendx.apk" || a.name.endsWith(".apk"),
    );

    if (!apkAsset) return null;

    // Extract SHA-256 digest from release body if tagged
    let sha256: string | undefined;
    const shaMatch = release.body.match(/sha256[:\s]+([a-fA-F0-9]{64})/i);
    if (shaMatch) {
      sha256 = shaMatch[1].toLowerCase();
    }

    const releaseVersion = release.tag_name.replace(/^v/, "").trim();

    return {
      tag: release.tag_name,
      versionName: releaseVersion,
      releaseTitle: release.name || `AttendX ${release.tag_name}`,
      changelogMarkdown:
        release.body || "Performance improvements and maintenance fixes.",
      publishedAt: release.published_at,
      apkUrl: apkAsset.browser_download_url,
      apkSizeMb: Number((apkAsset.size / (1024 * 1024)).toFixed(1)),
      expectedSha256: sha256,
      installedVersionCode: appInfo.versionCode,
      installedVersionName: appInfo.versionName,
    };
  }
}
