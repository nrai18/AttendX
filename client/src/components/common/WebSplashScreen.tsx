import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function WebSplashScreen({ onComplete }: { onComplete: () => void }) {
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    // Shorter splash screen duration for a snappier feel
    const fallbackTimer = setTimeout(() => {
      handleEnd();
    }, 2000);
    
    return () => clearTimeout(fallbackTimer);
  }, [onComplete]);

  const handleEnd = () => {
    setIsFading(true);
    setTimeout(() => {
      onComplete();
    }, 500); // 500ms fade out duration
  };

  return (
    <AnimatePresence>
      {!isFading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center overflow-hidden"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ 
              scale: [0.8, 1.1, 1],
              opacity: [0, 1, 1]
            }}
            transition={{ 
              duration: 1.2, 
              times: [0, 0.6, 1],
              ease: "easeOut"
            }}
            className="flex flex-col items-center justify-center gap-6"
          >
            <motion.img 
              src="/attendx_logo_lockup.png" 
              alt="AttendX Logo"
              className="w-32 h-32 md:w-40 md:h-40 object-contain drop-shadow-2xl"
              animate={{
                y: [0, -10, 0],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
                ease: "easeInOut"
              }}
            />
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.5 }}
            >
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
