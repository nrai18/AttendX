import React, { useEffect } from "react";
import {
  X,
  Sparkles,
  Download,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
} from "lucide-react";
import { useBackHandlerStore } from "../../stores/backHandlerStore";
import {
  NativeUpdateInfo,
  UpdatePhase,
  DownloadProgressInfo,
} from "../../services/updater/updateTypes";
import { UpdateChangelog } from "./UpdateChangelog.tsx";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  updateInfo: NativeUpdateInfo | null;
  phase: UpdatePhase;
  progress: DownloadProgressInfo | null;
  errorMessage: string | null;
  onStartDownload: () => void;
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
  onInstall,
  onSnooze,
}) => {
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

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0b0d11]/90 backdrop-blur-2xl border border-white/10 rounded-t-[2.5rem] sm:rounded-3xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="p-6 pb-4 border-b border-white/5 flex items-start justify-between shrink-0">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-[10px] font-mono text-blue-400 font-bold mb-2">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              SYSTEM UPDATE • BUILD {updateInfo.tag}
            </div>
            <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              AttendX {updateInfo.versionName}
            </h2>
            <p className="text-xs text-zinc-400 mt-0.5 font-mono">
              v{updateInfo.installedVersionName} → v{updateInfo.versionName} •{" "}
              {updateInfo.apkSizeMb} MB
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-white/5 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 scrollbar-hide text-xs">
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-wider text-zinc-400">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>What's new in this release</span>
          </div>

          <UpdateChangelog markdown={updateInfo.changelogMarkdown} />
        </div>

        {/* Footer Actions */}
        <div className="p-6 pt-4 border-t border-white/5 bg-black/40 shrink-0">
          {phase === "verified" ? (
            <div className="space-y-3">
              <button
                onClick={onInstall}
                className="w-full py-3.5 bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                Install Update Now
              </button>
              <div className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-400 font-mono">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>SHA-256 Verified • Package Ready</span>
              </div>
            </div>
          ) : phase === "downloading" && progress ? (
            <div className="space-y-3">
              <div className="flex justify-between text-xs font-mono text-zinc-400">
                <span>Downloading update...</span>
                <span>{progress.percent}%</span>
              </div>
              <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-200"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-zinc-400">
                <span>
                  {(progress.bytesDownloaded / (1024 * 1024)).toFixed(1)} MB /{" "}
                  {(progress.totalBytes / (1024 * 1024)).toFixed(1)} MB
                </span>
                <span>
                  {(progress.speedBps / (1024 * 1024)).toFixed(1)} MB/s
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <button
                onClick={onStartDownload}
                className="w-full py-3.5 bg-white hover:bg-zinc-200 text-black font-bold text-sm rounded-xl transition-all active:scale-[0.99] flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Download and Install ({updateInfo.apkSizeMb} MB)
              </button>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onSnooze(24)}
                  className="py-2.5 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-semibold rounded-xl transition-colors text-center cursor-pointer"
                >
                  Remind Tomorrow
                </button>
                <button
                  onClick={onClose}
                  className="py-2.5 bg-transparent hover:bg-white/5 text-zinc-400 text-xs font-semibold rounded-xl transition-colors text-center cursor-pointer"
                >
                  Later
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
