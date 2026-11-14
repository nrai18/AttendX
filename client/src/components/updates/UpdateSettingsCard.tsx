import React from "react";
import { Download, RefreshCw, CheckCircle2, ArrowRight } from "lucide-react";
import {
  NativeUpdateInfo,
  UpdatePhase,
} from "../../services/updater/updateTypes";

interface Props {
  updateInfo: NativeUpdateInfo | null;
  phase: UpdatePhase;
  onOpenSheet: () => void;
  onCheckAgain: () => void;
}

export const UpdateSettingsCard: React.FC<Props> = ({
  updateInfo,
  phase,
  onOpenSheet,
  onCheckAgain,
}) => {
  return (
    <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl flex items-center justify-between gap-4">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-white">
            System Software Update
          </span>
          {updateInfo && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Build {updateInfo.tag}
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-400">
          {updateInfo
            ? `New release ${updateInfo.versionName} is ready to install.`
            : "AttendX is running the latest verified version."}
        </p>
      </div>

      {updateInfo ? (
        <button
          onClick={onOpenSheet}
          className="px-3.5 py-2 bg-white text-black font-bold text-xs rounded-xl flex items-center gap-1.5 hover:bg-zinc-200 transition-colors cursor-pointer shrink-0"
        >
          <span>Update</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      ) : (
        <button
          onClick={onCheckAgain}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
          title="Check for updates"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
