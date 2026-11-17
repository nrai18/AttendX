import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import { useScrollLock } from "../../hooks/useScrollLock";
import {
  NativeUpdateInfo,
  UpdatePhase,
  DownloadProgressInfo,
} from "../../services/updater/updateTypes";
import { UpdateChangelog } from "./UpdateChangelog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: NativeUpdateInfo | null;
  phase: UpdatePhase;
  progress: DownloadProgressInfo | null;
  errorMessage: string | null;
  onStartDownload: () => void;
  onCancelDownload?: () => void;
  onInstall: () => void;
  onSnooze: (hours: number) => void;
}

export const NativeUpdateSheet: React.FC<Props> = ({
  isOpen,
  onClose,
  updateInfo,
  phase,
  progress,
  errorMessage,
  onStartDownload,
  onCancelDownload,
  onInstall,
  onSnooze,
}) => {
  useScrollLock(isOpen);

  // Register Android Hardware Back Button to dismiss sheet safely
  useEffect(() => {
    if (!isOpen) return;
    const unregister = useBackHandlerStore.getState().register(() => {
      onClose();
      return true;
    });
    return () => unregister();
  }, [isOpen, onClose]);

  if (!isOpen || !updateInfo) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 dark:bg-black/75 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Modal Container with Clean Theme-Adaptive Framing */}
      <div className="relative bg-card dark:bg-[#0B0E14]/95 text-foreground dark:text-zinc-100 border border-border dark:border-white/10 rounded-t-[2.5rem] sm:rounded-[2.5rem] w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] ring-1 ring-emerald-500/20 dark:ring-emerald-500/30">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-border/80 dark:border-white/10 flex items-start justify-between shrink-0 bg-card/80 dark:bg-[#080A0E]/80 backdrop-blur-md">
          <div className="flex items-center gap-3.5">
            {/* App Icon Glass Squircle */}
            <div className="w-11 h-11 rounded-2xl bg-primary/10 border border-primary/20 text-primary dark:bg-white/[0.08] dark:border-white/15 dark:text-white flex items-center justify-center text-xl shadow-xs shrink-0">
              ⚡
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
                SYSTEM UPDATE • BUILD {updateInfo.tag}
              </div>
              <h2 className="text-lg font-black tracking-tight text-foreground dark:text-white flex items-center gap-2">
                AttendX {updateInfo.versionName}
              </h2>
              <p className="text-[11px] text-muted-foreground dark:text-zinc-400 font-mono mt-0.5">
                v{updateInfo.installedVersionName} → v{updateInfo.versionName} •{" "}
                {updateInfo.apkSizeMb} MB
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-full bg-muted/60 hover:bg-muted dark:bg-white/[0.06] dark:hover:bg-white/[0.12] text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-hide text-xs">
          {errorMessage && (
            <div className="p-3 bg-destructive/15 border border-destructive/30 rounded-2xl text-destructive flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium">{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-muted-foreground dark:text-zinc-400 font-bold">
            <Sparkles className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>What's new in this release</span>
          </div>

          <UpdateChangelog markdown={updateInfo.changelogMarkdown} />
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t border-border/80 dark:border-white/10 bg-card/90 dark:bg-[#080A0E]/90 backdrop-blur-xl shrink-0 space-y-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {phase === "verified" ? (
            <div className="space-y-3">
              <button
                onClick={onInstall}
                className="w-full py-3.5 rounded-2xl bg-foreground text-background dark:bg-white dark:text-black hover:opacity-90 font-extrabold text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Install Update Now
              </button>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground dark:text-zinc-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
                <span>SHA-256 Verified • Package Ready</span>
              </div>
            </div>
          ) : phase === "installing" ? (
            <div className="space-y-3">
              <button
                disabled
                className="w-full py-3.5 rounded-2xl bg-muted text-muted-foreground font-extrabold text-sm flex items-center justify-center gap-2 cursor-not-allowed opacity-80"
              >
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                Launching Package Installer...
              </button>
              <p className="text-[11px] text-center text-muted-foreground dark:text-zinc-400 font-mono">
                Android PackageInstaller will prompt you to complete installation
              </p>
            </div>
          ) : phase === "downloading" ? (
            progress ? (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-mono text-muted-foreground dark:text-zinc-400 font-bold">
                  <span>Downloading update package...</span>
                  <span className="text-emerald-500 dark:text-emerald-400">
                    {progress.percent >= 0 ? `${progress.percent}%` : "Streaming"}
                  </span>
                </div>
                <div className="h-2 w-full bg-muted dark:bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-200 ${progress.percent < 0 ? "animate-pulse w-full" : ""}`}
                    style={progress.percent >= 0 ? { width: `${progress.percent}%` } : undefined}
                  />
                </div>
                <div className="flex justify-between text-[11px] font-mono text-muted-foreground dark:text-zinc-400">
                  <span>
                    {(progress.bytesDownloaded / (1024 * 1024)).toFixed(1)} MB
                    {progress.totalBytes > 0
                      ? ` / ${(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB`
                      : ` / ${updateInfo.apkSizeMb} MB`}
                  </span>
                  <span>
                    {(progress.speedBps / (1024 * 1024)).toFixed(1)} MB/s
                  </span>
                </div>
                {onCancelDownload && (
                  <button
                    onClick={onCancelDownload}
                    className="w-full py-2 rounded-xl bg-muted/60 hover:bg-muted dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-muted-foreground hover:text-foreground font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel Download
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex justify-between text-xs font-mono text-muted-foreground dark:text-zinc-400 font-bold">
                  <span>Connecting to update server...</span>
                  <span className="text-emerald-500 animate-pulse">Initializing...</span>
                </div>
                <div className="h-2 w-full bg-muted dark:bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500/70 rounded-full animate-pulse w-full" />
                </div>
                {onCancelDownload && (
                  <button
                    onClick={onCancelDownload}
                    className="w-full py-2 rounded-xl bg-muted/60 hover:bg-muted dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-muted-foreground hover:text-foreground font-bold text-xs transition-all cursor-pointer"
                  >
                    Cancel Download
                  </button>
                )}
              </div>
            )
          ) : (
            <div className="space-y-2.5">
              <button
                onClick={onStartDownload}
                className="w-full py-3.5 rounded-2xl bg-foreground text-background dark:bg-white dark:text-black hover:opacity-90 font-extrabold text-sm transition-all shadow-md active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download and Install ({updateInfo.apkSizeMb} MB)
              </button>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  onClick={() => onSnooze(24)}
                  className="py-2.5 px-4 rounded-xl bg-muted/60 hover:bg-muted dark:bg-white/[0.08] dark:hover:bg-white/[0.14] text-foreground dark:text-zinc-200 font-bold text-xs transition-all text-center cursor-pointer border border-border dark:border-white/10"
                >
                  Remind Tomorrow
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 px-4 rounded-xl bg-transparent hover:bg-muted/60 dark:hover:bg-white/[0.08] text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-white font-bold text-xs transition-all text-center cursor-pointer border border-transparent"
                >
                  Later
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
