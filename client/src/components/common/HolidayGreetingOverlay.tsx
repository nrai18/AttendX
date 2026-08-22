import React, { useState, useEffect } from "react";
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

  useEffect(() => {
    if (isOpen) {
      setShowPrompt(false);
      
      // If there is no asset, we must fire the completion handler manually
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

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-background/95 backdrop-blur-lg cursor-pointer"
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
              <div className="w-64 h-64 mb-8">
                <HolidayIconRenderer 
                  src={holidayAssetSrc} 
                  className="w-full h-full drop-shadow-2xl" 
                  onAnimationComplete={handleAnimationComplete}
                />
              </div>
            )}
            
            <motion.h2 
              className="text-4xl font-extrabold bg-gradient-to-br from-primary to-primary/60 bg-clip-text text-transparent mb-4"
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
                  <p className="text-lg text-muted-foreground font-medium">
                    Do you want to mark all your classes off for today?
                  </p>
                  <div className="flex flex-col gap-3">
                    <Button 
                      size="lg" 
                      className="w-full text-lg rounded-xl h-14 font-semibold shadow-lg shadow-primary/20"
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
                      className="w-full text-muted-foreground h-12"
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
    </AnimatePresence>
  );
};
