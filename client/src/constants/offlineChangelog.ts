import { Release } from "../components/settings/ChangelogModal";

export const OFFLINE_CHANGELOG: Release[] = [
  {
    version: "4.3.1",
    date: "Nov 14, 2026",
    sections: [
      {
        title: "Interactive Firmware Diagnostics Center & In-App Native APK Updater",
        items: [
          {
            icon: "⚡",
            text: "Interactive System Firmware & Diagnostics Tile: Real-time GitHub Releases API ping latency monitor, PackageInstaller (REQUEST_INSTALL_PACKAGES) permission inspector, and FileProvider storage sandbox validation in Settings.",
          },
          {
            icon: "📲",
            text: "Native In-App APK Updater Engine: Background APK streaming with SHA-256 verification and Android PackageInstaller handoff, plus 24h snooze options.",
          },
          {
            icon: "📅",
            text: "Timezone-Harmonized Calendar Sync: Resolved 1-day IST (+5:30) vs UTC midnight date evaluation drift, ensuring classes marked Off immediately update calendar dots without stale Absent badges.",
          },
          {
            icon: "🔔",
            text: "FCM Push Action Routing: Tapping update notifications in the Android notification tray routes directly into the NativeUpdateSheet overlay with 0ms delay.",
          },
        ],
      },
    ],
  },
  {
    version: "4.3.0",
    date: "Oct 28, 2026",
    sections: [
      {
        title: "Micro-Physics Delight Animations, Native DND Unmute & System Hardening",
        items: [
          {
            icon: "🤖",
            text: "Copilot Fast-Path Category Disambiguation & Past-Event Awareness: Decoupled midsem, endsem, break, exam, and holiday intent matchers so exam queries never falsely fall back to unrelated public holidays.",
          },
          {
            icon: "📅",
            text: "Calendar & Today Offline Attendance State Sync: Fixed discrepancy where marking classes as Off on Today's Schedule showed as Missed on the Calendar.",
          },
          {
            icon: "🔄",
            text: "Timezone-Harmonized Calendar Cache & Instant Invalidation: Added immediate Redis cache invalidation on attendance mutations so calendar overviews update synchronously.",
          },
          {
            icon: "📎",
            text: "Classroom Announcement Attachments & Compression: Integrated document and image attachments in section broadcast feeds with paperclip selector and client-side Canvas compression.",
          },
          {
            icon: "🔕",
            text: "Native Android 14+ Pinned Mute Foreground Service: Implemented dedicated RingerForegroundService keeping the app process active during lectures with non-swipeable notification.",
          },
          {
            icon: "📱",
            text: "Multi-Class Interactive 4x2 Home Screen Widget: Multi-class agenda view displaying up to 3 classes simultaneously with room numbers, times, countdowns, and direct 1-tap attendance marking.",
          },
        ],
      },
    ],
  },
  {
    version: "4.2.0",
    date: "Oct 15, 2026",
    sections: [
      {
        title: "Dynamic HUD, Haptic Audio Synthesizers & Offline Caching",
        items: [
          {
            icon: "✨",
            text: "Dynamic Island HUD: Floating status pill with real-time feedback for sync, marks, and downloads.",
          },
          {
            icon: "🎵",
            text: "Web Audio Synthesizers: Zero-latency tactile sound effects for swipes, clicks, and celebrations.",
          },
          {
            icon: "💾",
            text: "Offline-First Data Storage: Complete local caching for subjects, timetables, and calendars.",
          },
        ],
      },
    ],
  },
  {
    version: "4.1.0",
    date: "Sep 28, 2026",
    sections: [
      {
        title: "Predictive Attendance & What-If Bunk Calculator",
        items: [
          {
            icon: "📊",
            text: "What-If Simulator: Interactive slider to model future absences and forecast semester compliance.",
          },
          {
            icon: "🎯",
            text: "75% Ordinance Engine: Strict attendance tracking aligned with IIITU academic guidelines.",
          },
        ],
      },
    ],
  },
];
