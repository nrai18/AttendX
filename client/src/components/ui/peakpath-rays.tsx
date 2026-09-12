import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export const PeakpathRays = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-[-1] overflow-hidden pointer-events-none", className)}>
      <div className="absolute inset-0 bg-[#F3FDF8] dark:bg-[#03110E] transition-colors duration-500" />
      
      <div 
        className="absolute inset-0 opacity-40 dark:opacity-90 mix-blend-multiply dark:mix-blend-screen transition-opacity duration-500"
        style={{
          background: "radial-gradient(ellipse at center, rgba(201, 244, 107, 0.3) 0%, transparent 100%)",
        }}
      >
        {/* Primary bold rays - Primary #C9F46B */}
        <div 
          className="absolute inset-[-150%] origin-center animate-[spin_40s_linear_infinite]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              45deg,
              transparent 0%,
              rgba(201, 244, 107, 0.4) 2%,
              transparent 4%,
              transparent 10%,
              rgba(201, 244, 107, 0.6) 12%,
              transparent 14%,
              transparent 25%,
              rgba(201, 244, 107, 0.3) 26%,
              transparent 28%
            )`,
            maskImage: "radial-gradient(ellipse at center, black 20%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 20%, transparent 100%)"
          }}
        />
        
        {/* Secondary contrasting rays - Accent #A7FFD0 */}
        <div 
          className="absolute inset-[-150%] origin-center animate-[spin_60s_linear_infinite_reverse]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              -45deg,
              transparent 0%,
              rgba(167, 255, 208, 0.3) 1%,
              transparent 3%,
              transparent 15%,
              rgba(201, 244, 107, 0.5) 17%,
              transparent 20%,
              transparent 35%,
              rgba(167, 255, 208, 0.4) 37%,
              transparent 40%
            )`,
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 100%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 100%)"
          }}
        />
      </div>

      {/* Heavy Volumetric fog at the bottom */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[70vh] mix-blend-multiply dark:mix-blend-screen opacity-40 dark:opacity-70 transition-opacity duration-500"
        style={{
          background: "linear-gradient(to top, rgba(201, 244, 107, 0.4), transparent)",
          maskImage: "radial-gradient(ellipse at bottom, black 40%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at bottom, black 40%, transparent 100%)"
        }}
      />
    </div>,
    document.body
  );
};
