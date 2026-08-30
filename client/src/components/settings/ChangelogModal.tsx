import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, History } from "lucide-react";
import { useHardwareBack } from "../../hooks/useHardwareBack";

export interface ChangelogItem {
  icon: string;
  text: string;
}

export interface ChangelogSection {
  title: string;
  items: ChangelogItem[];
}

export interface Release {
  version: string;
  sizeMb?: number;
  sections: ChangelogSection[];
}

export const ChangelogModal = ({
  isOpen,
  onClose,
  releases = []
}: {
  isOpen: boolean;
  onClose: () => void;
  releases?: Release[];
}) => {
  useHardwareBack(isOpen, onClose);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex flex-col justify-end md:justify-center items-center bg-black/40 backdrop-blur-sm p-0 md:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-0"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%", opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: "100%", opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-card w-full md:w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl z-10 overflow-hidden flex flex-col max-h-[90vh] border border-border"
          >
            <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-muted/30 sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20">
                  <History className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight text-foreground">Update History</h2>
                  <p className="text-xs text-muted-foreground">What's new in AttendX</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 md:p-6 overflow-y-auto space-y-8 pb-20 bg-background text-foreground">
              {releases.length === 0 && (
                 <div className="text-center py-8 text-muted-foreground text-sm">
                   Loading changelog...
                 </div>
              )}
              {releases.map((release, i) => (
                <div key={release.version} className="relative pl-6 border-l-2 border-border/50">
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-card ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  
                  <div className="mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                      Version {release.version}
                      {i === 0 && <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Latest</span>}
                    </h3>
                  </div>

                  <div className="space-y-4">
                    {release.sections.map((section, j) => (
                      <div key={j} className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground/90">
                          {section.title}
                        </h4>
                        <ul className="space-y-1.5 pl-2">
                          {section.items.map((item, k) => (
                            <li key={k} className="text-sm text-foreground/80 flex items-start gap-2">
                              <span className="shrink-0">{item.icon}</span>
                              <span>{item.text}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
