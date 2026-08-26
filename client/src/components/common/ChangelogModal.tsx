import React, { useEffect, useState } from "react";
import { APP_CHANGELOG, CURRENT_VERSION } from "../../lib/changelog";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  version?: string; // If provided, shows specific version. Else shows latest.
}

export const ChangelogModal: React.FC<Props> = ({
  isOpen,
  onClose,
  version,
}) => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setTimeout(() => setIsVisible(false), 300);
    }
  }, [isOpen]);

  if (!isOpen && !isVisible) return null;

  const targetVersion = version || CURRENT_VERSION;
  const changelog =
    APP_CHANGELOG.find((c) => c.version === targetVersion) || APP_CHANGELOG[0];

  return (
    <div
      className={`fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 backdrop-blur-sm transition-opacity duration-300 p-0 sm:p-6 ${isOpen ? "opacity-100" : "opacity-0"}`}
    >
      <div
        className={`w-full min-h-screen sm:min-h-0 sm:h-auto sm:max-w-md bg-[#121212] sm:rounded-[2.5rem] flex flex-col shadow-2xl transition-transform duration-300 my-auto ${isOpen ? "transform translate-y-0 scale-100" : "transform translate-y-8 scale-95"}`}
      >
        {/* Header matching Nothing OS */}
        <div className="pt-12 pb-6 px-8 shrink-0">
          <div className="w-6 h-10 border-2 border-white/20 rounded-md mb-6 flex flex-col items-center justify-end p-1">
            <div className="w-3 h-3 bg-blue-500 rounded-sm"></div>
          </div>
          <h2 className="text-[1.35rem] font-medium text-white mb-1 tracking-tight">
            System update complete
          </h2>
          <h1 className="text-xl font-bold text-white tracking-wide">
            {changelog.title || `What's New in This Update`}
          </h1>
          <p className="text-sm text-white/50 mt-1">
            Version {changelog.version}
          </p>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8 scrollbar-hide">
          {changelog.sections.map((section, idx) => (
            <div key={idx} className="space-y-4">
              <h3 className="text-[0.9rem] font-bold text-white tracking-wide">
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.items.map((item, itemIdx) => (
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

          {changelog.notes && (
            <div className="pt-4 space-y-1">
              <h3 className="text-[0.85rem] font-bold text-white">Notes:</h3>
              <p className="text-[0.8rem] text-white/60 leading-relaxed">
                {changelog.notes}
              </p>
            </div>
          )}

          {changelog.size && (
            <div className="pt-2">
              <p className="text-[0.85rem] font-bold text-white">
                Update size: {changelog.size}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 shrink-0 flex items-center justify-between border-t border-white/5">
          <div className="flex items-center gap-2 text-white/40">
            <div className="w-4 h-4 rounded-full border-2 border-current opacity-50 flex items-center justify-center">
              <div className="w-1.5 h-1.5 bg-current rounded-full"></div>
            </div>
            <span className="text-xs font-medium">Device updated</span>
          </div>
          <button
            onClick={onClose}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-500 active:scale-95 transition-all text-white text-sm font-medium rounded-full"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
