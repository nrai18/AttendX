import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player as Lottie } from '@lottiefiles/react-lottie-player';

const animations = [
  '/logo_animation.json',
  '/logo_animation_2.json'
];

export function WebSplashScreen({ onComplete }: { onComplete: () => void }) {
  const [animPath] = useState(() => animations[Math.floor(Math.random() * animations.length)]);
  const [isFading, setIsFading] = useState(false);
  
  // Web Audio Context & Node refs for seamless non-interrupting background playback
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    if (window.innerWidth >= 768) {
      onComplete();
      return;
    }

    let isCancelled = false;

    // Play corresponding actual audio via Web Audio API to prevent stopping Spotify/background music
    const playActualAudio = async () => {
      if (!animPath) return;
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtxClass) return;

        const ctx = new AudioCtxClass();
        audioCtxRef.current = ctx;

        if (ctx.state === 'suspended') {
          await ctx.resume();
        }

        const audioUrl = animPath.replace(/\.json$/i, '.mp3');
        const response = await fetch(audioUrl);
        const arrayBuffer = await response.arrayBuffer();
        if (isCancelled) return;

        const decodedBuffer = await ctx.decodeAudioData(arrayBuffer);
        if (isCancelled) return;

        const source = ctx.createBufferSource();
        source.buffer = decodedBuffer;
        sourceNodeRef.current = source;

        const gainNode = ctx.createGain();
        gainNode.gain.setValueAtTime(0.5, ctx.currentTime);
        gainNodeRef.current = gainNode;

        source.connect(gainNode);
        gainNode.connect(ctx.destination);

        source.start(0);
      } catch (err) {
        console.debug("WebSplash audio playback deferred or unhandled:", err);
      }
    };

    playActualAudio();

    // Fallback timer in case the animation doesn't trigger 'complete' event
    const fallbackTimer = setTimeout(() => {
      handleEnd();
    }, 12000);

    return () => {
      isCancelled = true;
      clearTimeout(fallbackTimer);
      try {
        if (sourceNodeRef.current) {
          sourceNodeRef.current.stop();
        }
        if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
          audioCtxRef.current.close();
        }
      } catch (e) {}
    };
  }, [onComplete, animPath]);

  const handleEnd = () => {
    setIsFading(true);

    // Fade out audio over the 500ms visual transition using Web Audio gain ramp
    try {
      if (audioCtxRef.current && gainNodeRef.current) {
        const ctx = audioCtxRef.current;
        const gain = gainNodeRef.current;
        const now = ctx.currentTime;
        gain.gain.setValueAtTime(gain.gain.value, now);
        gain.gain.linearRampToValueAtTime(0, now + 0.5);
      }
    } catch (e) {}

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
          <div className="absolute inset-0 w-full h-full origin-center flex items-center justify-center">
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
