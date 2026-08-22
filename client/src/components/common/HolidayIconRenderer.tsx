import React, { useState, useEffect } from 'react';
import { Lottie } from 'lottie-react';

interface HolidayIconRendererProps {
  src: string;
  className?: string;
  alt?: string;
  onAnimationComplete?: () => void;
}

export const HolidayIconRenderer: React.FC<HolidayIconRendererProps> = ({ src, className, alt, onAnimationComplete }) => {
  if (src.endsWith('.json') || src.endsWith('.lottie')) {
    return (
      <Lottie 
        src={src} 
        loop={true} 
        autoplay={true} 
        className={className}
        subscriptions={onAnimationComplete ? { loopCompleted: onAnimationComplete } : undefined}
      />
    );
  }

  // Fallback for SVGs to fire immediately or after a short delay since they don't have a duration
  useEffect(() => {
    if (!src.endsWith('.json') && !src.endsWith('.lottie') && onAnimationComplete) {
      const timer = setTimeout(onAnimationComplete, 2000);
      return () => clearTimeout(timer);
    }
  }, [src, onAnimationComplete]);

  return <img src={src} alt={alt || "Holiday Icon"} className={className} />;
};
