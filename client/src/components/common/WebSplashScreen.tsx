import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player as Lottie } from '@lottiefiles/react-lottie-player';

const animations = [
  '/logo_animation.json',
  '/logo_animation_2.json'
];

export function WebSplashScreen({ onComplete }: { onComplete: () => void }) {
  const [animPath] = useState(() => animations[Math.floor(Math.random() * animations.length)]);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      onComplete();
      return;
    }
    
    // Fallback timer in case the animation doesn't trigger 'complete' event
    const fallbackTimer = setTimeout(() => {
      handleEnd();
    }, 12000);
    
    return () => clearTimeout(fallbackTimer);
  }, [onComplete]);

  const handleEnd = () => {
    setIsFading(true);
    setTimeout(() => {
      onComplete();
    }, 500); // 500ms fade out duration
  };

  if (!animPath) return null;

  return (
    <AnimatePresence>
      {!isFading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] bg-background flex items-center justify-center overflow-hidden"
        >
          <div className="absolute inset-0 w-full h-full scale-[1.35] md:scale-100 origin-center">
            <Lottie 
              src={animPath} 
              loop={false}
              speed={2}
              autoplay={true}
              onEvent={(event) => {
                if (event === 'complete') handleEnd();
              }}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              rendererSettings={{ preserveAspectRatio: 'xMidYMid slice' }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

