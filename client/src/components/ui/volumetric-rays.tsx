import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export const VolumetricRays = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-[-1] overflow-hidden pointer-events-none", className)}>
      {/* 
        Background glow to illuminate the rays
      */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#E6FFF0] to-[#FFFFFF] dark:from-background dark:to-background" />
      <div 
        className="absolute inset-0 opacity-80 mix-blend-normal dark:mix-blend-screen"
        style={{
          background: "radial-gradient(circle at center, rgba(0, 255, 136, 0.15) 0%, transparent 100%)",
        }}
      >
        {/* Primary bold rays */}
        <div 
          className="absolute inset-[-150%] origin-center animate-[spin_40s_linear_infinite]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent 0%,
              rgba(0, 255, 136, 0.4) 2%,
              transparent 4%,
              transparent 10%,
              rgba(0, 255, 136, 0.6) 12%,
              transparent 14%,
              transparent 25%,
              rgba(0, 255, 136, 0.3) 26%,
              transparent 28%
            )`,
            maskImage: "radial-gradient(circle at center, black 10%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(circle at center, black 10%, transparent 100%)"
          }}
        />
        
        {/* Secondary contrasting rays */}
        <div 
          className="absolute inset-[-150%] origin-center animate-[spin_60s_linear_infinite_reverse]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent 0%,
              rgba(0, 210, 255, 0.3) 1%,
              transparent 3%,
              transparent 15%,
              rgba(0, 255, 136, 0.5) 17%,
              transparent 20%,
              transparent 35%,
              rgba(0, 255, 136, 0.4) 37%,
              transparent 40%
            )`,
            maskImage: "radial-gradient(circle at center, black 20%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(circle at center, black 20%, transparent 100%)"
          }}
        />
      </div>

      {/* Heavy Volumetric fog at the bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[70vh] mix-blend-normal dark:mix-blend-screen opacity-70"
        style={{
          background: "linear-gradient(to top, rgba(0, 255, 136, 0.3), transparent)",
          maskImage: "radial-gradient(ellipse at bottom, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at bottom, black 40%, transparent 100%)"
        }}
      />
    </div>,
    document.body
  );
};
