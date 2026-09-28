import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { ArrowLeft, Home } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] space-y-2 text-center px-4 select-none">
      
      {/* 404 Text */}
      <div className="flex items-center justify-center gap-2 mb-[-20px] z-10">
        <h1 className="text-[120px] md:text-[150px] leading-none font-black tracking-tighter text-[#eab308] -rotate-6 drop-shadow-lg">4</h1>
        <h1 className="text-[120px] md:text-[150px] leading-none font-black tracking-tighter text-[#eab308] rotate-2 drop-shadow-lg">0</h1>
        <h1 className="text-[120px] md:text-[150px] leading-none font-black tracking-tighter text-[#eab308] -rotate-3 drop-shadow-lg">4</h1>
      </div>

      {/* The Hole and Character SVG */}
      <div className="relative w-72 h-32 md:w-96 md:h-40 z-0">
        <svg viewBox="0 0 256 128" className="w-full h-full drop-shadow-2xl" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* The Abyss (Inside the hole) */}
          <ellipse cx="128" cy="64" rx="100" ry="24" fill="#000000" />
          
          {/* Character Head */}
          {/* Red Hair */}
          <circle cx="128" cy="48" r="14" fill="#dc2626" />
          <circle cx="116" cy="53" r="10" fill="#dc2626" />
          <circle cx="140" cy="53" r="10" fill="#dc2626" />
          {/* Blue Beanie */}
          <path d="M104 70 C 104 40, 152 40, 152 70" fill="#1e3a8a" />
          <path d="M104 70 L 152 70" stroke="#1e3a8a" strokeWidth="4" />
          
          {/* The Front Edge of the Hole */}
          <path d="M28 64 C 28 95, 228 95, 228 64" className="stroke-slate-900 dark:stroke-white" strokeWidth="6" strokeLinecap="round" />
          {/* Fill inside the rim */}
          <path d="M28 64 C 28 95, 228 95, 228 64 C 228 85, 28 85, 28 64 Z" className="fill-slate-100 dark:fill-[#262626]" />
          
          {/* Hands grabbing the edge */}
          {/* Left hand */}
          <rect x="90" y="80" width="12" height="20" rx="6" fill="#a16207" transform="rotate(-25 90 80)" />
          {/* Right hand */}
          <rect x="150" y="75" width="12" height="20" rx="6" fill="#a16207" transform="rotate(25 150 75)" />
        </svg>
      </div>

      <div className="mt-8 space-y-3 z-10 relative">
        <h2 className="text-3xl font-bold tracking-tight text-foreground">Page Not Found</h2>
        <p className="text-muted-foreground max-w-md pb-6 text-lg">
          We couldn't find the page you were looking for. It might have been moved, deleted, or perhaps it never existed.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Button onClick={() => navigate(-1)} variant="outline" className="rounded-xl h-11 px-6 font-semibold">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={() => navigate('/today')} className="rounded-xl h-11 px-6 font-semibold">
            <Home className="w-4 h-4 mr-2" />
            Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
};