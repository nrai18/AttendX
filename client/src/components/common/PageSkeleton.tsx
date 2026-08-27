import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";

interface Props {
  type?: "today" | "list" | "calendar" | "grid";
}

const WAKE_MESSAGES = [
  "Connecting...",
  "Waking up the cloud server...",
  "Running database checks...",
  "Fetching your data...",
  "Almost there...",
  "Server is having its morning coffee...",
  "Still loading... Render is taking its time."
];

export const PageSkeleton: React.FC<Props> = ({ type = "today" }) => {
  const [showStatus, setShowStatus] = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    // Wait 2 seconds before assuming it is a cold start
    const initialDelay = setTimeout(() => {
      setShowStatus(true);
      
      const interval = setInterval(() => {
        setMessageIndex((prev) => (prev < WAKE_MESSAGES.length - 1 ? prev + 1 : prev));
      }, 3500);
      
      return () => clearInterval(interval);
    }, 1500);
    
    return () => clearTimeout(initialDelay);
  }, []);

  return (
    <div className="relative p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full pb-24 md:pb-8">
      {/* Top Banner Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6 animate-pulse">
        <div className="h-20 bg-muted/60 rounded-2xl border border-border/40"></div>
        <div className="h-20 bg-muted/60 rounded-2xl border border-border/40 hidden md:block"></div>
      </div>

      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-4 animate-pulse">
        <div className="h-8 bg-muted/60 rounded-lg w-48"></div>
        <div className="h-8 bg-muted/60 rounded-lg w-24"></div>
      </div>

      {/* Cards Skeleton */}
      <div className="space-y-4 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-28 bg-muted/40 rounded-2xl border border-border/30"></div>
        ))}
      </div>

      {/* Cold Start Indicator */}
      <AnimatePresence>
        {showStatus && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div className="flex items-center gap-3 px-4 py-2.5 bg-background/80 backdrop-blur-xl border border-border/50 shadow-2xl rounded-full text-sm font-medium text-foreground">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <motion.span
                key={messageIndex}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="whitespace-nowrap"
              >
                {WAKE_MESSAGES[messageIndex]}
              </motion.span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
