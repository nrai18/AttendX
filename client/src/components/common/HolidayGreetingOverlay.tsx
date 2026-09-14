import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { HolidayIconRenderer } from "./HolidayIconRenderer";
import { Button } from "../ui/button";

interface HolidayGreetingOverlayProps {
  isOpen: boolean;
  holidayName: string;
  holidayAssetSrc?: string;
  hasClasses: boolean;
  onMarkOff: () => void;
  onClose: () => void;
}

export const HolidayGreetingOverlay: React.FC<HolidayGreetingOverlayProps> = ({
  isOpen, holidayName, holidayAssetSrc, hasClasses, onMarkOff, onClose
}) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setShowPrompt(false);
      
      if (!holidayAssetSrc) {
        const timer = setTimeout(() => {
          if (hasClasses) {
            setShowPrompt(true);
          } else {
            setTimeout(onClose, 2000);
          }
        }, 2000);
        return () => clearTimeout(timer);
      }
    }
  }, [isOpen, holidayAssetSrc, hasClasses, onClose]);

  const handleAnimationComplete = () => {
    if (hasClasses) {
      setShowPrompt(true);
    } else {
      setTimeout(onClose, 2000);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-[9999] flex flex-col items-center justify-center p-4 bg-black/80 backdrop-blur-3xl cursor-pointer"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div 
            onClick={(e) => e.stopPropagation()} 
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="flex flex-col items-center justify-center text-center max-w-md w-full"
          >
            {holidayAssetSrc && (
              <div className="w-full max-w-[250px] h-48 md:h-64 mb-8 flex items-center justify-center relative">
                <HolidayIconRenderer 
                  src={holidayAssetSrc} 
                  className="max-w-full max-h-full object-contain drop-shadow-2xl" 
                  onAnimationComplete={handleAnimationComplete}
                />
              </div>
            )}
            
            <motion.h2 
              className="text-4xl font-extrabold text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.3)] mb-4"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              {holidayName}
            </motion.h2>

            <AnimatePresence>
              {showPrompt && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-8 space-y-6 w-full overflow-hidden"
                >
                  <p className="text-lg text-white/80 font-medium">
                    Do you want to mark all your classes off for today?
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button 
                      size="lg" 
                      className="w-full text-lg rounded-xl h-14 font-semibold shadow-[0_0_20px_rgba(255,255,255,0.1)] bg-white text-black hover:bg-white/90 border border-transparent hover:border-white/20 transition-all cursor-pointer"
                      onClick={() => {
                        onMarkOff();
                        onClose();
                      }}
                    >
                      Yes, mark full day off
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="lg" 
                      className="w-full text-white/60 hover:text-white hover:bg-white/10 h-12 rounded-xl transition-colors cursor-pointer"
                      onClick={onClose}
                    >
                      No, I'll do it manually
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
};
