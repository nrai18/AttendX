import React from "react";

export interface ClassroomBannerTheme {
  id: string;
  name: string;
  badge: string;
  accentColor: string;
  renderIllustration: () => React.ReactNode;
}

export const CLASSROOM_BANNERS: ClassroomBannerTheme[] = [
  {
    id: "honors_circuits",
    name: "Engineering & Honors",
    badge: "ECE & TECH",
    accentColor: "#f59e0b",
    renderIllustration: () => (
      <svg
        className="absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 240"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="honors-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a222d" />
            <stop offset="60%" stopColor="#141a23" />
            <stop offset="100%" stopColor="#0c1017" />
          </linearGradient>
          <linearGradient id="gold-medal-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#fde047" />
            <stop offset="45%" stopColor="#eab308" />
            <stop offset="100%" stopColor="#a16207" />
          </linearGradient>
          <linearGradient id="diploma-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#e2e8f0" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>
          <linearGradient id="scrim-honors" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0c1017" stopOpacity="0.94" />
            <stop offset="45%" stopColor="#0c1017" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#0c1017" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0c1017" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Base Background */}
        <rect width="600" height="240" fill="url(#honors-bg)" />

        {/* Ambient Geometry (Right Side) */}
        <circle cx="490" cy="110" r="105" fill="#1e293b" fillOpacity="0.35" />
        <rect x="420" y="25" width="160" height="190" rx="18" fill="#1e293b" fillOpacity="0.2" transform="rotate(8 500 120)" />

        {/* Academic Diploma Roll with Red Ribbon */}
        <g transform="translate(485, 45) rotate(-18)">
          <rect x="0" y="0" width="110" height="34" rx="6" fill="url(#diploma-grad)" />
          <path d="M0,0 Q6,17 0,34 Q-6,17 0,0" fill="#cbd5e1" />
          <path d="M110,0 Q116,17 110,34 Q104,17 110,0" fill="#94a3b8" />
          {/* Crimson Tie */}
          <rect x="44" y="-2" width="16" height="38" rx="2" fill="#ef4444" />
          <path d="M48,34 C44,52 38,62 34,70 C46,65 52,60 56,48 Z" fill="#dc2626" />
          <path d="M54,34 C58,54 66,64 74,72 C64,66 59,58 56,48 Z" fill="#b91c1c" />
        </g>

        {/* Gold Achievement Medal */}
        <g transform="translate(435, 70)">
          {/* Hanging Cream/Slate Ribbons */}
          <polygon points="5,-60 25,-60 18,15 0,15" fill="#f8fafc" fillOpacity="0.9" />
          <polygon points="25,-60 45,-60 40,15 22,15" fill="#cbd5e1" fillOpacity="0.8" />
          
          {/* Medal Outer Rim */}
          <circle cx="22" cy="22" r="32" fill="url(#gold-medal-grad)" filter="drop-shadow(0 4px 12px rgba(0,0,0,0.5))" />
          <circle cx="22" cy="22" r="26" fill="#ca8a04" stroke="#fef08a" strokeWidth="1.5" strokeDasharray="3 2" />
          
          {/* Center Star */}
          <polygon
            points="22,11 25.5,18 33,19 27.5,24.5 29,32 22,28 15,32 16.5,24.5 11,19 18.5,18"
            fill="#fef08a"
          />
        </g>

        {/* Floating Confetti Stars & Dots */}
        <circle cx="360" cy="65" r="4" fill="#fbbf24" fillOpacity="0.8" />
        <circle cx="390" cy="165" r="5" fill="#cbd5e1" fillOpacity="0.6" />
        <circle cx="565" cy="40" r="3.5" fill="#f59e0b" fillOpacity="0.85" />
        <circle cx="545" cy="185" r="4.5" fill="#fef08a" fillOpacity="0.75" />
        <path d="M375,115 L379,122 L386,122 L381,126 L383,133 L375,129 L367,133 L369,126 L364,122 L371,122 Z" fill="#f59e0b" fillOpacity="0.75" transform="scale(0.8) translate(70, 10)" />

        {/* Left Legibility Gradient Scrim */}
        <rect width="440" height="240" fill="url(#scrim-honors)" />
      </svg>
    ),
  },
  {
    id: "creative_studio",
    name: "Creative Studio & Design",
    badge: "STUDIO & LAB",
    accentColor: "#f97316",
    renderIllustration: () => (
      <svg
        className="absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 240"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="studio-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e2430" />
            <stop offset="55%" stopColor="#171c26" />
            <stop offset="100%" stopColor="#0e1117" />
          </linearGradient>
          <linearGradient id="paint-tube-body" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64748b" />
            <stop offset="100%" stopColor="#334155" />
          </linearGradient>
          <linearGradient id="acrylic-orange" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#fb923c" />
            <stop offset="50%" stopColor="#f97316" />
            <stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
          <linearGradient id="scrim-studio" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0e1117" stopOpacity="0.94" />
            <stop offset="45%" stopColor="#0e1117" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#0e1117" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0e1117" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Base Background */}
        <rect width="600" height="240" fill="url(#studio-bg)" />

        {/* Drafting Board Geometry */}
        <rect x="440" y="40" width="130" height="160" rx="12" fill="#1e293b" fillOpacity="0.3" transform="rotate(12 505 120)" />

        {/* Paint Tube (Horizontal / Diagonal) */}
        <g transform="translate(420, 115) rotate(-6)">
          {/* Main Metal Tube */}
          <rect x="0" y="0" width="95" height="34" rx="4" fill="url(#paint-tube-body)" />
          {/* Orange Color Swatch Band */}
          <rect x="18" y="0" width="56" height="34" fill="url(#acrylic-orange)" />
          {/* Tube Ridges & Crimped End */}
          <rect x="88" y="-2" width="9" height="38" rx="2" fill="#1e293b" />
          {/* Nozzle Neck & Cap */}
          <polygon points="0,7 -8,11 -8,23 0,27" fill="#475569" />
          <rect x="-16" y="9" width="8" height="16" rx="2" fill="#1e293b" />
        </g>

        {/* Fine Art Paintbrush */}
        <g transform="translate(425, 140) rotate(32)">
          {/* Wooden Handle */}
          <polygon points="0,5 95,1 95,9 0,5" fill="#f87171" fillOpacity="0.9" />
          {/* Silver Ferrule */}
          <rect x="-16" y="2" width="16" height="6" rx="1" fill="#cbd5e1" />
          {/* Bristles with Coral Dip */}
          <path d="M-16,2 C-26,2 -30,5 -30,5 C-30,5 -26,8 -16,8 Z" fill="#fb7185" />
        </g>

        {/* Painter's Palette Drops & Geometric Markers */}
        <circle cx="370" cy="85" r="5" fill="#f43f5e" fillOpacity="0.85" />
        <circle cx="550" cy="55" r="4.5" fill="#38bdf8" fillOpacity="0.8" />
        <circle cx="395" cy="180" r="4" fill="#fb923c" fillOpacity="0.8" />
        <rect x="360" y="140" width="18" height="3" rx="1.5" fill="#94a3b8" fillOpacity="0.5" />
        <rect x="360" y="148" width="12" height="3" rx="1.5" fill="#94a3b8" fillOpacity="0.5" />

        {/* Left Legibility Gradient Scrim */}
        <rect width="440" height="240" fill="url(#scrim-studio)" />
      </svg>
    ),
  },
  {
    id: "ai_computing",
    name: "Artificial Intelligence & Computing",
    badge: "AI & SOFTWARE",
    accentColor: "#06b6d4",
    renderIllustration: () => (
      <svg
        className="absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 240"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ai-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0f1f2e" />
            <stop offset="60%" stopColor="#091420" />
            <stop offset="100%" stopColor="#040910" />
          </linearGradient>
          <linearGradient id="chip-glow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
          <linearGradient id="scrim-ai" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#040910" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#040910" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#040910" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#040910" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Base Background */}
        <rect width="600" height="240" fill="url(#ai-bg)" />

        {/* Circuit Tracks in Background */}
        <path d="M380,40 L440,40 L470,80 L520,80" stroke="#0284c7" strokeWidth="1.5" strokeOpacity="0.35" fill="none" />
        <path d="M410,200 L460,200 L490,160 L560,160" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.3" fill="none" />
        <circle cx="520" cy="80" r="3" fill="#38bdf8" fillOpacity="0.6" />
        <circle cx="560" cy="160" r="3" fill="#06b6d4" fillOpacity="0.6" />

        {/* Central Neural Processor / Microchip */}
        <g transform="translate(460, 75)">
          {/* Chip Body */}
          <rect x="0" y="0" width="70" height="70" rx="14" fill="#0c1e33" stroke="#0284c7" strokeWidth="2" />
          {/* Internal Die Core */}
          <rect x="15" y="15" width="40" height="40" rx="8" fill="url(#chip-glow)" fillOpacity="0.85" />
          <path d="M25,25 L45,45 M45,25 L25,45" stroke="#f0f9ff" strokeWidth="2" strokeLinecap="round" />

          {/* Golden Pin Array */}
          <rect x="-8" y="15" width="8" height="4" fill="#38bdf8" />
          <rect x="-8" y="27" width="8" height="4" fill="#38bdf8" />
          <rect x="-8" y="39" width="8" height="4" fill="#38bdf8" />
          <rect x="-8" y="51" width="8" height="4" fill="#38bdf8" />

          <rect x="70" y="15" width="8" height="4" fill="#38bdf8" />
          <rect x="70" y="27" width="8" height="4" fill="#38bdf8" />
          <rect x="70" y="39" width="8" height="4" fill="#38bdf8" />
          <rect x="70" y="51" width="8" height="4" fill="#38bdf8" />
        </g>

        {/* Neural Nodes & Synapses */}
        <g transform="translate(390, 85)">
          <circle cx="20" cy="30" r="7" fill="#10b981" fillOpacity="0.8" />
          <circle cx="150" cy="10" r="6" fill="#38bdf8" fillOpacity="0.8" />
          <circle cx="160" cy="80" r="7" fill="#06b6d4" fillOpacity="0.8" />
          <line x1="26" y1="30" x2="65" y2="20" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.4" strokeDasharray="3 3" />
          <line x1="135" y1="20" x2="145" y2="15" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.4" />
          <line x1="135" y1="50" x2="155" y2="75" stroke="#06b6d4" strokeWidth="1.5" strokeOpacity="0.4" />
        </g>

        {/* Monospace Code Brackets */}
        <text x="375" y="160" fill="#38bdf8" fillOpacity="0.4" fontFamily="monospace" fontSize="24" fontWeight="bold">{"{ ; }"}</text>

        {/* Left Legibility Gradient Scrim */}
        <rect width="440" height="240" fill="url(#scrim-ai)" />
      </svg>
    ),
  },
  {
    id: "science_physics",
    name: "Science, Lab & Mathematics",
    badge: "SCIENCE & PHYSICS",
    accentColor: "#10b981",
    renderIllustration: () => (
      <svg
        className="absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 240"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="science-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#152422" />
            <stop offset="60%" stopColor="#0d1716" />
            <stop offset="100%" stopColor="#060d0c" />
          </linearGradient>
          <linearGradient id="flask-liquid" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#34d399" />
            <stop offset="100%" stopColor="#059669" />
          </linearGradient>
          <linearGradient id="scrim-sci" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#060d0c" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#060d0c" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#060d0c" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#060d0c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Base Background */}
        <rect width="600" height="240" fill="url(#science-bg)" />

        {/* Bohr Atomic Orbitals (Center Right) */}
        <g transform="translate(500, 115)">
          <ellipse cx="0" cy="0" rx="65" ry="24" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4" transform="rotate(-30)" />
          <ellipse cx="0" cy="0" rx="65" ry="24" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.4" transform="rotate(30)" />
          <ellipse cx="0" cy="0" rx="65" ry="24" stroke="#a7f3d0" strokeWidth="1.5" strokeOpacity="0.4" transform="rotate(90)" />
          {/* Nucleus */}
          <circle cx="0" cy="0" r="7" fill="#34d399" />
          {/* Orbiting Electrons */}
          <circle cx="48" cy="-24" r="3.5" fill="#38bdf8" />
          <circle cx="-45" cy="-22" r="3.5" fill="#fde047" />
        </g>

        {/* Laboratory Erlenmeyer Flask */}
        <g transform="translate(400, 75)">
          {/* Flask Body Outline */}
          <path d="M25,0 L35,0 L35,28 L58,75 C62,82 56,90 48,90 L12,90 C4,90 -2,82 2,75 L25,28 Z" fill="#064e3b" fillOpacity="0.4" stroke="#34d399" strokeWidth="2" />
          {/* Liquid Inside */}
          <path d="M9,72 L51,72 C55,80 50,88 44,88 L16,88 C10,88 5,80 9,72 Z" fill="url(#flask-liquid)" />
          {/* Flask Lip */}
          <rect x="22" y="-4" width="16" height="5" rx="2.5" fill="#34d399" />
          {/* Bubbles */}
          <circle cx="30" cy="55" r="2.5" fill="#a7f3d0" />
          <circle cx="36" cy="42" r="2" fill="#a7f3d0" />
        </g>

        {/* Mathematical Sine Grid Wave */}
        <path d="M350,170 Q380,140 410,170 T470,170 T530,170 T590,170" fill="none" stroke="#6ee7b7" strokeWidth="1.5" strokeOpacity="0.35" />

        {/* Left Legibility Gradient Scrim */}
        <rect width="440" height="240" fill="url(#scrim-sci)" />
      </svg>
    ),
  },
  {
    id: "library_humanities",
    name: "Library, Architecture & Humanities",
    badge: "ACADEMIC & CORE",
    accentColor: "#a855f7",
    renderIllustration: () => (
      <svg
        className="absolute inset-0 w-full h-full object-cover"
        viewBox="0 0 600 240"
        preserveAspectRatio="xMaxYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="library-bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#241424" />
            <stop offset="60%" stopColor="#180d18" />
            <stop offset="100%" stopColor="#0c060c" />
          </linearGradient>
          <linearGradient id="book-spine" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#9333ea" />
          </linearGradient>
          <linearGradient id="scrim-lib" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#0c060c" stopOpacity="0.95" />
            <stop offset="45%" stopColor="#0c060c" stopOpacity="0.75" />
            <stop offset="75%" stopColor="#0c060c" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#0c060c" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Base Background */}
        <rect width="600" height="240" fill="url(#library-bg)" />

        {/* Classical Column Arch Silhouette */}
        <g opacity="0.25" transform="translate(500, 30)">
          <rect x="0" y="0" width="55" height="12" rx="2" fill="#e9d5ff" />
          <rect x="10" y="12" width="12" height="130" fill="#e9d5ff" />
          <rect x="33" y="12" width="12" height="130" fill="#e9d5ff" />
          <rect x="0" y="142" width="55" height="14" rx="2" fill="#e9d5ff" />
        </g>

        {/* Stack of Classic Academic Textbooks */}
        <g transform="translate(420, 110)">
          {/* Book 1 (Bottom) */}
          <rect x="0" y="32" width="95" height="18" rx="3" fill="#6b21a8" stroke="#a855f7" strokeWidth="1" />
          <line x1="8" y1="36" x2="8" y2="46" stroke="#f3e8ff" strokeWidth="1.5" />

          {/* Book 2 (Middle) */}
          <rect x="8" y="14" width="85" height="18" rx="3" fill="url(#book-spine)" />
          <line x1="16" y1="18" x2="16" y2="28" stroke="#faf5ff" strokeWidth="1.5" />

          {/* Book 3 (Top - Angled) */}
          <g transform="rotate(-8 15 0)">
            <rect x="15" y="-2" width="80" height="16" rx="3" fill="#c084fc" />
            <line x1="22" y1="2" x2="22" y2="10" stroke="#f3e8ff" strokeWidth="1.5" />
          </g>
        </g>

        {/* Golden Calligraphy Quill / Fountain Pen */}
        <g transform="translate(415, 65) rotate(42)">
          <rect x="0" y="0" width="85" height="4" rx="2" fill="#e9d5ff" />
          <polygon points="0,0 -12,2 0,4" fill="#fbbf24" />
        </g>

        {/* Floating Starlight Particles */}
        <circle cx="380" cy="55" r="4.5" fill="#c084fc" fillOpacity="0.8" />
        <circle cx="560" cy="180" r="3.5" fill="#f472b6" fillOpacity="0.8" />

        {/* Left Legibility Gradient Scrim */}
        <rect width="440" height="240" fill="url(#scrim-lib)" />
      </svg>
    ),
  },
];

/**
 * Intelligent Keyword & Deterministic Hash Classifier
 * Matches subject strings to the most thematic Google Classroom banner!
 */
export const getClassroomBannerTheme = (
  classroomIdOrName: string,
  department?: string,
  section?: string
): ClassroomBannerTheme => {
  const combined = `${classroomIdOrName} ${department || ""} ${section || ""}`.toLowerCase();

  // 1. Engineering / Honors / Circuits / ECE / DCN / Hardware / Signals
  if (
    /\b(ece|dcn|ecpe|circuit|digital|signal|communication|telecom|hardware|vlsi|embedded|iot|antenna|linear)\b/i.test(
      combined
    )
  ) {
    return CLASSROOM_BANNERS[0]; // honors_circuits
  }

  // 2. Creative Studio / Design / Mechanical / Workshop / Graphics
  if (
    /\b(design|art|creative|workshop|cad|drawing|graphics|mechanical|civil|studio|proto|ui|ux)\b/i.test(
      combined
    )
  ) {
    return CLASSROOM_BANNERS[1]; // creative_studio
  }

  // 3. AI / Computer Science / IT / Coding / Data / Algorithms / Web
  if (
    /\b(ai|artificial|cs|cse|it|software|code|data|algorithm|dbms|cloud|cyber|network|ml|python|java|web)\b/i.test(
      combined
    )
  ) {
    return CLASSROOM_BANNERS[2]; // ai_computing
  }

  // 4. Lab / Physics / Math / Chemistry / Science / Calculus
  if (
    /\b(math|calculus|physics|chem|chemistry|science|lab|experiment|statistics|discrete|quantum)\b/i.test(
      combined
    )
  ) {
    return CLASSROOM_BANNERS[3]; // science_physics
  }

  // 5. Humanities / Library / English / Law / Management / Economics / General
  if (
    /\b(english|humanities|law|management|economics|lib|library|ethics|history|comm|seminar)\b/i.test(
      combined
    )
  ) {
    return CLASSROOM_BANNERS[4]; // library_humanities
  }

  // Deterministic String Hash Fallback for Arbitrary / Custom Section Names (e.g. ",m,m")
  let hash = 0;
  for (let i = 0; i < classroomIdOrName.length; i++) {
    hash = (hash << 5) - hash + classroomIdOrName.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % CLASSROOM_BANNERS.length;
  return CLASSROOM_BANNERS[idx];
};
