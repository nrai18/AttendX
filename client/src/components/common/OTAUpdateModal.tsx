import React, { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { Capacitor } from '@capacitor/core';
import { toast } from 'sonner';

interface Props {
  localVersion: string;
}

export const OTAUpdateModal: React.FC<Props> = ({ localVersion }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [remoteData, setRemoteData] = useState<any>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  useEffect(() => {
    // Check for updates on mount
    const checkUpdates = async () => {
      try {
        const res = await api.get("/system/update");
        const { latestVersion, changelog } = res.data;

        if (localVersion !== latestVersion) {
          // Filter changelog to only include versions greater than localVersion
          // For simplicity, we just take all items in the array until we hit the localVersion
          const index = changelog.findIndex(
            (c: any) => c.version === localVersion,
          );
          const newUpdates =
            index !== -1 ? changelog.slice(0, index) : changelog;

          if (newUpdates.length > 0) {
            // Aggregate size and sections
            let totalSize = 0;
            const allSections: any[] = [];

            newUpdates.forEach((update: any) => {
              totalSize += update.sizeMb || 0;
              allSections.push(...update.sections);
            });

            setRemoteData({
              latestVersion,
              sizeMb: parseFloat(totalSize.toFixed(1)),
              title: newUpdates[0].title,
              sections: allSections,
            });
            setIsOpen(true);
          }
        }
      } catch (err) {
        console.error("Failed to check for updates:", err);
      }
    };
    checkUpdates();

    if (Capacitor.isNativePlatform()) {
      CapacitorUpdater.notifyAppReady();
    }
  }, [localVersion]);

  const handleDownload = async () => {
    setIsDownloading(true);

    if (!Capacitor.isNativePlatform()) {
      // Web Fallback Simulation
      let progress = 0;
      const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
          progress = 100;
          clearInterval(interval);
          setTimeout(() => {
            localStorage.setItem("app_version", remoteData.latestVersion);
            window.location.reload();
          }, 1000);
        }
        setDownloadProgress(progress);
      }, 300);
      return;
    }

    // Real Native Capacitor OTA
    try {
      const bundle = await CapacitorUpdater.download({
        url: "http://10.21.9.90:3000/api/system/download-update",
        version: remoteData.latestVersion,
      });

      // We can listen to progress events if we added listener, but for now we'll simulate the UI loader while the background native thread does it
      setDownloadProgress(99);

      await CapacitorUpdater.set({ id: bundle.id });
      // The app will restart automatically after set()
    } catch (error: any) {
      toast.error("OTA Download Failed: " + error.message);
      setIsDownloading(false);
    }
  };

  if (!isOpen || !remoteData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm transition-opacity duration-300 opacity-100 p-0 sm:p-6">
      <div className="w-full min-h-screen sm:min-h-0 sm:h-auto sm:max-w-md bg-[#121212] sm:rounded-[2.5rem] flex flex-col shadow-2xl transition-transform duration-300 transform translate-y-0 scale-100 my-auto">
        {/* Header matching Nothing OS */}
        <div className="pt-12 pb-6 px-8 shrink-0">
          <div className="w-6 h-10 border-2 border-white/20 rounded-md mb-6 flex flex-col items-center justify-end p-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
          </div>
          <h2 className="text-[1.35rem] font-medium text-white mb-1 tracking-tight">
            System update available
          </h2>
          <h1 className="text-xl font-bold text-white tracking-wide">
            {remoteData.title || `What's New in This Update`}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Version {remoteData.latestVersion}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 scrollbar-hide">
          {remoteData.sections.map((section: any, idx: number) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-[0.9rem] font-bold text-white tracking-wide">
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.items.map((item: any, itemIdx: number) => (
                  <div key={itemIdx} className="flex items-start gap-3">
                    <span className="text-base leading-snug shrink-0">
                      {item.icon}
                    </span>
                    <p className="text-[0.85rem] leading-relaxed text-white/90 font-medium">
                      {item.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="pt-2">
            <p className="text-[0.85rem] font-bold text-white">
              Update size: {remoteData.totalSize.toFixed(1)} MB
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 shrink-0 flex flex-col gap-4 border-t border-white/5">
          {isDownloading ? (
            <div className="space-y-2 w-full">
              <div className="flex justify-between text-xs text-white/70">
                <span>Downloading...</span>
                <span>{Math.floor(downloadProgress)}%</span>
              </div>
              <div className="w-full bg-white/10 rounded-full h-1.5">
                <div
                  className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${downloadProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <button
              onClick={handleDownload}
              className="w-full py-3 bg-white hover:bg-white/90 active:scale-95 transition-all text-black text-sm font-bold rounded-full"
            >
              Download and install
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
