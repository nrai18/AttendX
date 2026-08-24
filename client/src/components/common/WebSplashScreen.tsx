import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const videos = [
  '/logo_animation.mp4',
  '/logo_animation_2.mp4',
  '/logo_animation_3.mp4',
  '/logo_animation_4.mp4'
];

export function WebSplashScreen({ onComplete }: { onComplete: () => void }) {
  const [videoSrc, setVideoSrc] = useState('');
  const [isFading, setIsFading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    // If it's a laptop/desktop (>= 768px wide), skip the animation entirely
    if (window.innerWidth >= 768) {
      onComplete();
      return;
    }

    const randomVideo = videos[Math.floor(Math.random() * videos.length)];
    setVideoSrc(randomVideo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (videoSrc && videoRef.current) {
      // Ensure the video plays
      videoRef.current.play().catch(e => {
        console.error('Autoplay prevented:', e);
        // If autoplay fails (e.g. strict browser policy), just skip the splash screen
        handleEnd();
      });
    }
  }, [videoSrc]);

  const handleEnd = () => {
    setIsFading(true);
    setTimeout(() => {
      onComplete();
    }, 500); // 500ms fade out duration
  };

  if (!videoSrc) return null;

  return (
    <AnimatePresence>
      {!isFading && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[9999] bg-[#050508] flex items-center justify-center overflow-hidden"
        >
          <video
            ref={videoRef}
            src={videoSrc}
            autoPlay
            playsInline
            onEnded={handleEnd}
            className="w-full h-full object-cover"
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
