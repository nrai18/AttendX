import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, History, Sparkles, Wrench } from "lucide-react";

interface Release {
  version: string;
  date: string;
  notes: {
    category: string;
    icon: React.ReactNode;
    items: string[];
  }[];
}

const RELEASES: Release[] = [
  {
    version: "1.3.4",
    date: "August 2026",
    notes: [
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Restored full offline animations (Lottie JSONs) natively to the app",
          "Fixed massive 285MB download size bug."
        ]
      }
    ]
  },
  {
    version: "1.3.3",
    date: "August 2026",
    notes: [
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Added "Not right now" button to skip updates and work uninterrupted.",
          "Fixed Landing Page logo visibility and contrast on dark theme.",
          "Fixed Google Sign-In redirecting to web browser."
        ]
      }
    ]
  },
  {
    version: "1.3.1",
    date: "August 2026",
    notes: [
      {
        category: "Native Enhancements",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "Splash screen now gracefully skips on web, preventing duplicate animations.",
          "Native Google OAuth login now fully supported through Capacitor."
        ]
      }
    ]
  },
  {
    version: "1.3.0",
    date: "August 2026",
    notes: [
      {
        category: "New Features & OTA Improvements",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "OTA Updates now aggregate changelogs accurately.",
          "Landing page hero animations replaced with stable pulse effects.",
          "Fixed infinite OTA loop in background check.",
          "Z-index issues fixed on settings overlays."
        ]
      }
    ]
  },
  {
    version: "1.2.0",
    date: "August 2026",
    notes: [
      {
        category: "New Features",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "Added automated 10-minute push notifications before every class.",
          "Added one-tap Mute action directly from lock screen notifications."
        ]
      },
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Completely revamped native push notification engine."
        ]
      }
    ]
  },
  {
    version: "1.1.2",
    date: "August 2026",
    notes: [
      {
        category: "New Features",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "Brand new cumulative OTA Update system.",
          "Added AES-256 encrypted support logs."
        ]
      },
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Added live Capacitor OTA engine.",
          "Implemented device fingerprinting for modals.",
          "Fixed ghost node process holding port 3000."
        ]
      }
    ]
  }
];

export const ChangelogModal = ({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center items-center bg-black/40 backdrop-blur-sm p-0 md:p-4">
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
            className="bg-card w-full md:w-full max-w-lg md:rounded-2xl rounded-t-2xl shadow-xl z-10 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-4 md:p-6 border-b border-border flex justify-between items-center bg-muted/30 sticky top-0 z-20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <History className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-lg leading-tight">Update History</h2>
                  <p className="text-xs text-muted-foreground">What's new in AttendX</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-muted/50 hover:bg-muted flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 md:p-6 overflow-y-auto space-y-8 pb-20">
              {RELEASES.map((release, i) => (
                <div key={release.version} className="relative pl-6 border-l-2 border-border/50">
                  {/* Timeline Node */}
                  <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-4 border-card ${i === 0 ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  
                  <div className="mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">
                      Version {release.version}
                      {i === 0 && <span className="text-[10px] uppercase tracking-wider font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">Latest</span>}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{release.date}</p>
                  </div>

                  <div className="space-y-4">
                    {release.notes.map((noteGroup, j) => (
                      <div key={j} className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          {noteGroup.icon}
                          {noteGroup.category}
                        </h4>
                        <ul className="space-y-1.5 pl-6">
                          {noteGroup.items.map((item, k) => (
                            <li key={k} className="text-sm text-foreground/80 list-disc marker:text-primary/50">
                              {item}
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
