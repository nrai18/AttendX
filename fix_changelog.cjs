const fs = require("fs");
const file = "client/src/components/settings/ChangelogModal.tsx";
let content = fs.readFileSync(file, "utf8");

const newReleases = `const RELEASES: Release[] = [
  {
    version: "1.3.4",
    date: "August 2026",
    notes: [
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Restored full offline animations (Lottie JSONs) natively to the app",
          "Fixed massive 285MB download size bug."
        ]
      }
    ]
  },
  {
    version: "1.3.3",
    date: "August 2026",
    notes: [
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Added \"Not right now\" button to skip updates and work uninterrupted.",
          "Fixed Landing Page logo visibility and contrast on dark theme.",
          "Fixed Google Sign-In redirecting to web browser."
        ]
      }
    ]
  },
  {
    version: "1.3.1",
    date: "August 2026",
    notes: [
      {
        category: "Native Enhancements",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "Splash screen now gracefully skips on web, preventing duplicate animations.",
          "Native Google OAuth login now fully supported through Capacitor."
        ]
      }
    ]
  },
  {
    version: "1.3.0",
    date: "August 2026",
    notes: [
      {
        category: "New Features & OTA Improvements",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "OTA Updates now aggregate changelogs accurately.",
          "Landing page hero animations replaced with stable pulse effects.",
          "Fixed infinite OTA loop in background check.",
          "Z-index issues fixed on settings overlays."
        ]
      }
    ]
  },
  {
    version: "1.2.0",
    date: "August 2026",
    notes: [
      {
        category: "New Features",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "Added automated 10-minute push notifications before every class.",
          "Added one-tap Mute action directly from lock screen notifications."
        ]
      },
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Completely revamped native push notification engine."
        ]
      }
    ]
  },
  {
    version: "1.1.2",
    date: "August 2026",
    notes: [
      {
        category: "New Features",
        icon: <Sparkles className="w-4 h-4 text-emerald-500" />,
        items: [
          "Brand new cumulative OTA Update system.",
          "Added AES-256 encrypted support logs."
        ]
      },
      {
        category: "Improvements & Fixes",
        icon: <Wrench className="w-4 h-4 text-blue-500" />,
        items: [
          "Added live Capacitor OTA engine.",
          "Implemented device fingerprinting for modals.",
          "Fixed ghost node process holding port 3000."
        ]
      }
    ]
  }
];`;

content = content.replace(/const RELEASES: Release\[\] = \[[\s\S]*?\];/, newReleases);
fs.writeFileSync(file, content);
