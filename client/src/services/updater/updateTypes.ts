export type UpdateChannel = "native-apk" | "none";

export type UpdatePhase =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "verified"
  | "installing"
  | "up-to-date"
  | "error";

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  prerelease: boolean;
  draft: boolean;
  assets: GitHubAsset[];
}

export interface NativeUpdateInfo {
  tag: string;
  versionName: string;
  releaseTitle: string;
  changelogMarkdown: string;
  publishedAt: string;
  apkUrl: string;
  apkSizeMb: number;
  expectedSha256?: string;
  installedVersionCode: number;
  installedVersionName: string;
}

export interface DownloadProgressInfo {
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speedBps: number;
}
