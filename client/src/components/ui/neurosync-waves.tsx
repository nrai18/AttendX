import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export const NeurosyncWaves = ({ className }: { className?: string }) => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(
    <div className={cn("fixed inset-0 z-[-1] overflow-hidden pointer-events-none", className)}>
      <style>
        {`
          @keyframes slow-spin {
            from { transform: rotate(0deg) scale(2); }
            to { transform: rotate(360deg) scale(2); }
          }
          @keyframes slow-spin-reverse {
            from { transform: rotate(360deg) scale(2); }
            to { transform: rotate(0deg) scale(2); }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-5%) scale(1.05); }
          }
          .volumetric-ray-1 {
            background: conic-gradient(from 180deg at 50% 50%, transparent 0deg, rgba(99, 102, 241, 0.4) 45deg, rgba(168, 85, 247, 0.8) 180deg, rgba(99, 102, 241, 0.4) 315deg, transparent 360deg);
            animation: slow-spin 35s linear infinite;
          }
          .volumetric-ray-2 {
            background: conic-gradient(from 0deg at 50% 50%, transparent 0deg, rgba(45, 212, 191, 0.4) 90deg, rgba(14, 165, 233, 0.7) 180deg, rgba(45, 212, 191, 0.4) 270deg, transparent 360deg);
            animation: slow-spin-reverse 45s linear infinite;
          }
          .glow-orb {
            background: radial-gradient(circle, rgba(168,85,247,0.4) 0%, transparent 70%);
            animation: float 10s ease-in-out infinite;
          }
          @keyframes grid-scroll {
            0% { background-position: 0 0; }
            100% { background-position: 0 40px; }
          }
        `}
      </style>
      
      <div className="absolute inset-0 bg-[#03040B] transition-colors duration-500" />
      
      {/* 3D Volumetric Rays Container */}
      <div className="absolute inset-0 opacity-80 mix-blend-screen transition-opacity duration-500 overflow-hidden perspective-[1000px]">
        
        {/* Ray 1 (Purple/Indigo) */}
        <div 
          className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] volumetric-ray-1 blur-[60px] opacity-60 mix-blend-screen"
          style={{ transformOrigin: 'center center' }}
        />
        
        {/* Ray 2 (Cyan/Teal) */}
        <div 
          className="absolute top-[0%] left-[-20%] w-[150%] h-[150%] volumetric-ray-2 blur-[80px] opacity-50 mix-blend-screen"
          style={{ transformOrigin: '40% 60%' }}
        />
        
        {/* Central Glow Orb to anchor the rays */}
        <div 
          className="absolute top-[20%] left-[20%] w-[60%] h-[60%] glow-orb blur-[100px] mix-blend-screen"
        />

        {/* 3D Moving Grid Lines */}
        <div 
          className="absolute inset-0 opacity-[0.15] pointer-events-none"
          style={{
            perspective: "800px",
            perspectiveOrigin: "50% 100%",
            maskImage: "linear-gradient(to bottom, transparent 30%, black 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 30%, black 100%)"
          }}
        >
          <div 
            className="absolute inset-[-100%] top-0 bottom-0"
            style={{
              transform: "rotateX(75deg) scale(2)",
              transformOrigin: "bottom center",
              background: `
                linear-gradient(to right, rgba(255,255,255,0.1) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(255,255,255,0.3) 1px, transparent 1px)
              `,
              backgroundSize: "40px 40px",
              animation: "grid-scroll 1.5s linear infinite"
            }}
          />
        </div>
      </div>

      {/* Atmospheric Fog */}
      <div 
        className="absolute bottom-0 left-0 right-0 h-[80vh] mix-blend-screen opacity-50 transition-opacity duration-500"
        style={{
          background: "linear-gradient(to top, rgba(14, 165, 233, 0.15), transparent)",
          maskImage: "radial-gradient(ellipse at bottom, black 50%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(ellipse at bottom, black 50%, transparent 100%)"
        }}
      />
    </div>,
    document.body
  );
};
