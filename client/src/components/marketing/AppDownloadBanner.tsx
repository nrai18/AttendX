import React, { useMemo } from 'react';
// @ts-ignore
import qrcode from 'qrcode-generator';
import { ATTENDX_MARK_ICON } from './attendxMark';

interface AppDownloadBannerProps {
  downloadUrl: string;
  version?: string;
  onWebClick?: () => void;
}

export const AppDownloadBanner: React.FC<AppDownloadBannerProps> = ({
  downloadUrl,
  version = 'v4.3.0',
  onWebClick,
}) => {
  // Generate vector path for the QR code mathematically locked to the SVG canvas
  const qrPath = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(downloadUrl || 'https://attendx.tech');
      qr.make();
      const count = qr.getModuleCount();
      const qrSize = 168;
      const modSize = qrSize / count;
      let d = '';
      for (let r = 0; r < count; r++) {
        for (let c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            const x = Number((c * modSize).toFixed(2));
            const y = Number((r * modSize).toFixed(2));
            const w = Number((modSize + 0.05).toFixed(2));
            const h = Number((modSize + 0.05).toFixed(2));
            d += `M${x},${y}h${w}v${h}h-${w}z `;
          }
        }
      }
      return d;
    } catch (e) {
      console.error('Failed to generate QR vector path:', e);
      return '';
    }
  }, [downloadUrl]);

  return (
    <div className="relative w-full aspect-[680/520] sm:aspect-[2.15/1] rounded-xl overflow-hidden bg-[#0c0d12] border border-white/[0.06] select-none">
      {/* MOBILE SVG CANVAS (< 640px) - Large, Legible, Zero Overlap */}
      <svg
        viewBox="0 0 680 520"
        className="w-full h-full block sm:hidden"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="canvasDarkBgMob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a0b10" />
            <stop offset="100%" stopColor="#10121a" />
          </linearGradient>
          <linearGradient id="ringGradMob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>
          <linearGradient id="bannerGradMob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#13151f" />
            <stop offset="100%" stopColor="#181b26" />
          </linearGradient>
          <linearGradient id="titaniumSideMob" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="40%" stopColor="#cbd5e1" />
            <stop offset="80%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="screenGlareMob" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>
          <filter id="shadowPhoneMob" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="-8" dy="18" stdDeviation="20" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Backdrop */}
        <rect width="680" height="520" fill="url(#canvasDarkBgMob)" />

        {/* Main Card Body */}
        <rect x="20" y="24" width="640" height="472" rx="34" fill="url(#bannerGradMob)" stroke="#232838" strokeWidth="1.5" />

        {/* Ambient Ring Glow */}
        <circle cx="155" cy="260" r="165" fill="#6366f1" opacity="0.15" filter="blur(45px)" />

        {/* Gradient Torus Ring (Back Half) */}
        <g transform="translate(155, 260)">
          <circle cx="0" cy="0" r="130" fill="none" stroke="url(#ringGradMob)" strokeWidth="25" strokeLinecap="round" />
        </g>

        {/* 3D Angled Smartphone */}
        <g transform="translate(150, 260) rotate(-8) scale(0.82)" filter="url(#shadowPhoneMob)">
          <path d="M -126 -210 L -112 -225 L -112 225 L -126 210 Z" fill="url(#titaniumSideMob)" />
          <rect x="-127" y="-90" width="4" height="36" rx="2" fill="#475569" />
          <rect x="-127" y="-40" width="4" height="36" rx="2" fill="#475569" />
          <rect x="-112" y="-228" width="224" height="456" rx="40" fill="#1c1f2b" stroke="#33384a" strokeWidth="3" />
          <rect x="-109" y="-225" width="218" height="450" rx="37" fill="#0d0f14" />
          <rect x="-104" y="-220" width="208" height="440" rx="32" fill="#050608" />
          <rect x="-35" y="-208" width="70" height="20" rx="10" fill="#000000" stroke="#161922" strokeWidth="1.5" />
          <circle cx="20" cy="-198" r="4.5" fill="#0b1329" stroke="#1e293b" strokeWidth="1" />
          <text x="-65" y="-193" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11" fontWeight="700" fill="#94a3b8" textAnchor="middle">9:41</text>
          <g transform="translate(52, -202)">
            <rect width="18" height="9" rx="3" fill="none" stroke="#94a3b8" strokeWidth="1" />
            <rect x="2" y="2" width="11" height="5" rx="1.5" fill="#38bdf8" />
          </g>
          <g transform="translate(0, -60)">
            <circle cx="0" cy="0" r="50" fill="#38bdf8" opacity="0.22" filter="blur(20px)" />
            <image href={ATTENDX_MARK_ICON} x="-36" y="-36" width="72" height="44" preserveAspectRatio="xMidYMid meet" />
            <text x="0" y="30" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="18" fontWeight="900" fill="#ffffff" textAnchor="middle" letterSpacing="1.5">
              Attend<tspan fill="#38bdf8">X</tspan>
            </text>
            <text x="0" y="46" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="8.5" fontWeight="700" fill="#38bdf8" textAnchor="middle" letterSpacing="2.5">
              SMART ATTENDANCE
            </text>
          </g>
          <g transform="translate(-86, 36)">
            <rect width="172" height="136" rx="18" fill="#10131b" stroke="#232838" strokeWidth="1.5" />
            <rect x="12" y="12" width="76" height="20" rx="10" fill="#22c55e" fillOpacity="0.18" />
            <circle cx="22" cy="22" r="3.5" fill="#4ade80" />
            <text x="52" y="25.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9" fontWeight="800" fill="#4ade80" textAnchor="middle">
              SAFE • 86%
            </text>
            <text x="12" y="54" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="14" fontWeight="900" fill="#ffffff">
              3 Classes to Bunk
            </text>
            <text x="12" y="70" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9.5" fontWeight="600" fill="#64748b">
              Semester Target: 75%
            </text>
            <rect x="12" y="84" width="148" height="6" rx="3" fill="#1e2433" />
            <rect x="12" y="84" width="128" height="6" rx="3" fill="#38bdf8" />
            <rect x="12" y="100" width="148" height="24" rx="8" fill="#171b26" />
            <text x="22" y="115.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9" fontWeight="700" fill="#94a3b8">
              CS301 • 10:00 AM
            </text>
            <text x="146" y="115.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9" fontWeight="800" fill="#38bdf8" textAnchor="end">
              PRESENT
            </text>
          </g>
          <path d="M -104 -220 L 70 -220 L -104 120 Z" fill="url(#screenGlareMob)" pointerEvents="none" />
          <rect x="-38" y="204" width="76" height="4" rx="2" fill="#ffffff" opacity="0.35" />
        </g>

        {/* Front Accent Ring Arc */}
        <g transform="translate(155, 260)">
          <path d="M 0 130 A 130 130 0 0 0 127 25" fill="none" stroke="url(#ringGradMob)" strokeWidth="25" strokeLinecap="round" />
        </g>

        {/* Right Column Typography & Actions (Safely Clear of Ring at x=320) */}
        <g transform="translate(320, 82)">
          <text fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="22" fontWeight="700" fill="#cbd5e1" letterSpacing="0.5">
            Download the
          </text>
          <text y="52" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="54" fontWeight="900" fill="#ffffff" letterSpacing="0.8">
            APP NOW!
          </text>
          <text y="82" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="15.5" fontWeight="600" fill="#94a3b8">
            Timetable tracking &amp; bunk prediction
          </text>

          {/* Interactive Vector Buttons */}
          <g transform="translate(0, 102)">
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="AttendX.apk"
              className="cursor-pointer group"
            >
              <rect
                x="0"
                y="0"
                width="152"
                height="40"
                rx="20"
                fill="#172033"
                stroke="#38bdf8"
                strokeOpacity="0.5"
                strokeWidth="1.8"
              />
              <text
                x="76"
                y="25"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="13"
                fontWeight="800"
                fill="#38bdf8"
                textAnchor="middle"
                letterSpacing="0.4"
              >
                ✦ ANDROID APK
              </text>
            </a>

            <a
              href="https://attendx.tech"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (window.location.hostname.includes('attendx.tech') || window.location.hostname === 'localhost') {
                  e.preventDefault();
                  if (onWebClick) onWebClick();
                }
              }}
              className="cursor-pointer group"
            >
              <rect
                x="162"
                y="0"
                width="156"
                height="40"
                rx="20"
                fill="#1e1833"
                stroke="#c084fc"
                strokeOpacity="0.5"
                strokeWidth="1.8"
              />
              <text
                x="240"
                y="25"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="13"
                fontWeight="800"
                fill="#c084fc"
                textAnchor="middle"
                letterSpacing="0.4"
              >
                ✦ ATTENDX.TECH
              </text>
            </a>
          </g>
        </g>

        {/* Bottom-Right Scannable QR Card */}
        <g transform="translate(320, 250)">
          <rect width="318" height="206" rx="22" fill="#ffffff" />
          <g transform="translate(16, 19)">
            <path d={qrPath} fill="#000000" />
          </g>
          <rect x="198" y="34" width="104" height="24" rx="12" fill="#0f172a" />
          <text x="250" y="50" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="10" fontWeight="800" fill="#38bdf8" textAnchor="middle" letterSpacing="0.6">
            ANDROID 11+
          </text>
          <text x="198" y="88" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="17" fontWeight="900" fill="#0f172a">
            SCAN QR
          </text>
          <text x="198" y="110" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="17" fontWeight="900" fill="#0f172a">
            FOR APK
          </text>
          <text x="198" y="138" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11.5" fontWeight="700" fill="#64748b">
            Direct Sideload
          </text>
          <text x="198" y="158" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11.5" fontWeight="800" fill="#10b981">
            OTA Auto-Sync
          </text>
        </g>
      </svg>

      {/* DESKTOP SVG CANVAS (>= 640px) - 100% Unified SVG Vector Canvas */}
      <svg
        viewBox="55 75 1170 490"
        className="w-full h-full hidden sm:block"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="canvasDarkBg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0a0b10" />
            <stop offset="100%" stopColor="#10121a" />
          </linearGradient>

          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#a855f7" />
          </linearGradient>

          <linearGradient id="bannerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#13151f" />
            <stop offset="100%" stopColor="#181b26" />
          </linearGradient>

          <linearGradient id="titaniumSide" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#94a3b8" />
            <stop offset="40%" stopColor="#cbd5e1" />
            <stop offset="80%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>

          <linearGradient id="screenGlare" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.12" />
            <stop offset="35%" stopColor="#ffffff" stopOpacity="0.04" />
            <stop offset="70%" stopColor="#ffffff" stopOpacity="0.0" />
          </linearGradient>

          <filter id="shadowPhone" x="-20%" y="-10%" width="140%" height="130%">
            <feDropShadow dx="-10" dy="24" stdDeviation="28" floodColor="#000000" floodOpacity="0.6" />
          </filter>
        </defs>

        {/* Minimalist Backdrop */}
        <rect width="1280" height="640" fill="url(#canvasDarkBg)" />

        {/* Ambient Ring Glow */}
        <circle cx="225" cy="320" r="210" fill="#6366f1" opacity="0.14" filter="blur(60px)" />

        {/* Main Pill Banner Body - Plain, Seamless */}
        <rect x="190" y="155" width="1005" height="330" rx="44" fill="url(#bannerGrad)" />

        {/* Gradient Torus Ring (Back Half) */}
        <g transform="translate(225, 320)">
          <circle cx="0" cy="0" r="158" fill="none" stroke="url(#ringGrad)" strokeWidth="32" strokeLinecap="round" />
        </g>

        {/* 3D Angled Smartphone */}
        <g transform="translate(215, 318) rotate(-9) scale(0.94)" filter="url(#shadowPhone)">
          {/* Titanium Left Bevel Edge */}
          <path d="M -126 -210 L -112 -225 L -112 225 L -126 210 Z" fill="url(#titaniumSide)" />
          {/* Volume Buttons */}
          <rect x="-127" y="-90" width="4" height="36" rx="2" fill="#475569" />
          <rect x="-127" y="-40" width="4" height="36" rx="2" fill="#475569" />

          {/* Phone Frame */}
          <rect x="-112" y="-228" width="224" height="456" rx="40" fill="#1c1f2b" stroke="#33384a" strokeWidth="3" />
          <rect x="-109" y="-225" width="218" height="450" rx="37" fill="#0d0f14" />

          {/* OLED Screen */}
          <rect x="-104" y="-220" width="208" height="440" rx="32" fill="#050608" />

          {/* Dynamic Island */}
          <rect x="-35" y="-208" width="70" height="20" rx="10" fill="#000000" stroke="#161922" strokeWidth="1.5" />
          <circle cx="20" cy="-198" r="4.5" fill="#0b1329" stroke="#1e293b" strokeWidth="1" />

          {/* Status Bar */}
          <text x="-65" y="-193" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="11" fontWeight="700" fill="#94a3b8" textAnchor="middle">9:41</text>
          <g transform="translate(52, -202)">
            <rect width="18" height="9" rx="3" fill="none" stroke="#94a3b8" strokeWidth="1" />
            <rect x="2" y="2" width="11" height="5" rx="1.5" fill="#38bdf8" />
          </g>

          {/* Phone Screen: AttendX Brand Lockup (Upper Section) */}
          <g transform="translate(0, -60)">
            <circle cx="0" cy="0" r="50" fill="#38bdf8" opacity="0.22" filter="blur(20px)" />
            <image href={ATTENDX_MARK_ICON} x="-36" y="-36" width="72" height="44" preserveAspectRatio="xMidYMid meet" />
            <text x="0" y="30" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="18" fontWeight="900" fill="#ffffff" textAnchor="middle" letterSpacing="1.5">
              Attend<tspan fill="#38bdf8">X</tspan>
            </text>
            <text x="0" y="46" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="8.5" fontWeight="700" fill="#38bdf8" textAnchor="middle" letterSpacing="2.5">
              SMART ATTENDANCE
            </text>
          </g>


          {/* Phone Screen: Live Attendance Card Widget (Lower Section) */}
          <g transform="translate(-86, 36)">
            <rect width="172" height="136" rx="18" fill="#10131b" stroke="#232838" strokeWidth="1.5" />
            {/* Safe Status Pill */}
            <rect x="12" y="12" width="76" height="20" rx="10" fill="#22c55e" fillOpacity="0.18" />
            <circle cx="22" cy="22" r="3.5" fill="#4ade80" />
            <text x="52" y="25.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9" fontWeight="800" fill="#4ade80" textAnchor="middle">
              SAFE • 86%
            </text>

            <text x="12" y="54" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="14" fontWeight="900" fill="#ffffff">
              3 Classes to Bunk
            </text>
            <text x="12" y="70" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9.5" fontWeight="600" fill="#64748b">
              Semester Target: 75%
            </text>

            {/* Mini Progress Bar */}
            <rect x="12" y="84" width="148" height="6" rx="3" fill="#1e2433" />
            <rect x="12" y="84" width="128" height="6" rx="3" fill="#38bdf8" />

            {/* Today Class Slot */}
            <rect x="12" y="100" width="148" height="24" rx="8" fill="#171b26" />
            <text x="22" y="115.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9" fontWeight="700" fill="#94a3b8">
              CS301 • 10:00 AM
            </text>
            <text x="146" y="115.5" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="9" fontWeight="800" fill="#38bdf8" textAnchor="end">
              PRESENT
            </text>
          </g>

          {/* Glass Reflection Glare */}
          <path d="M -104 -220 L 70 -220 L -104 120 Z" fill="url(#screenGlare)" pointerEvents="none" />

          {/* Bottom Home Indicator */}
          <rect x="-38" y="204" width="76" height="4" rx="2" fill="#ffffff" opacity="0.35" />
        </g>

        {/* Front Accent Ring Arc */}
        <g transform="translate(225, 320)">
          <path d="M 0 158 A 158 158 0 0 0 154 31" fill="none" stroke="url(#ringGrad)" strokeWidth="32" strokeLinecap="round" />
        </g>

        {/* Center Typography Block */}
        <g transform="translate(432, 222)">
          <text fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="26" fontWeight="700" fill="#cbd5e1" letterSpacing="0.5">
            Download the
          </text>
          <text y="62" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="66" fontWeight="900" fill="#ffffff" letterSpacing="1">
            APP NOW!
          </text>
          <text y="100" fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" fontSize="17.5" fontWeight="600" fill="#94a3b8" letterSpacing="0.3">
            Effortless timetable tracking &amp; intelligent prediction
          </text>

          {/* Interactive Vector Buttons (Locked to SVG Space, Zero Zoom Drift, Zero Overlap) */}
          <g transform="translate(0, 122)">
            {/* ✦ ANDROID APK Vector Action */}
            <a
              href={downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              download="AttendX.apk"
              className="cursor-pointer group"
            >
              <rect
                x="0"
                y="0"
                width="182"
                height="44"
                rx="22"
                fill="#172033"
                stroke="#38bdf8"
                strokeOpacity="0.45"
                strokeWidth="1.8"
                className="group-hover:fill-[#1e2942] group-hover:stroke-[#38bdf8] transition-colors"
              />
              <text
                x="91"
                y="27"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="14.5"
                fontWeight="800"
                fill="#38bdf8"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                ✦ ANDROID APK
              </text>
            </a>

            {/* ✦ ATTENDX.TECH (Web App) Vector Action */}
            <a
              href="https://attendx.tech"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                if (window.location.hostname.includes('attendx.tech') || window.location.hostname === 'localhost') {
                  e.preventDefault();
                  if (onWebClick) onWebClick();
                }
              }}
              className="cursor-pointer group"
            >
              <rect
                x="196"
                y="0"
                width="192"
                height="44"
                rx="22"
                fill="#1e1833"
                stroke="#c084fc"
                strokeOpacity="0.45"
                strokeWidth="1.8"
                className="group-hover:fill-[#271f42] group-hover:stroke-[#c084fc] transition-colors"
              />
              <text
                x="292"
                y="27"
                fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
                fontSize="14.5"
                fontWeight="800"
                fill="#c084fc"
                textAnchor="middle"
                letterSpacing="0.5"
              >
                ✦ ATTENDX.TECH
              </text>
            </a>
          </g>
        </g>

        {/* Right Scannable QR White Card Frame (Mathematically Locked to SVG Canvas) */}
        <g transform="translate(915, 196)">
          {/* Card Base */}
          <rect width="244" height="248" rx="26" fill="#ffffff" />

          {/* Vector QR Code Path - 100% Locked, Zero Zoom Drift */}
          <g transform="translate(38, 18)">
            <path d={qrPath} fill="#000000" />
          </g>

          {/* Scan callout text at bottom */}
          <text
            x="122"
            y="222"
            fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
            fontSize="13"
            fontWeight="800"
            fill="#334155"
            textAnchor="middle"
            letterSpacing="1"
          >
            SCAN TO DOWNLOAD
          </text>
        </g>
      </svg>
    </div>
  );
};
