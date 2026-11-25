import { Release } from "../components/settings/ChangelogModal";

export const OFFLINE_CHANGELOG: Release[] = [
  {
    version: "4.5.0",
    date: "Nov 25, 2026",
    sections: [
      {
        title: "Semester Replay, Auto-DND & Smart Transitions",
        items: [
          {
            icon: "🎞️",
            text: "Semester Wrap & Dynamic Story Replay: BitChord-inspired Replay with dynamic per-data slides, WYSIWYG Card Theme PNG sharing, procedural Web Audio engine, and Settings Account entry.",
          },
          {
            icon: "🔕",
            text: "Zero-Launch Background DND & Instant Notification Routing: Class reminders mute silently without opening the app when DND access is granted, and notification taps route immediately.",
          },
          {
            icon: "🎓",
            text: "Date-Aware Milestones & Backend Calendars: Tracks Teaching -> Exams -> Labs -> Vacation dynamically across calendar navigation with auto-transition prompts and editable 2026–2028 calendars.",
          },
          {
            icon: "🔄",
            text: "Canonical Attendance Sync & Light/Dark Contrast Parity: Syncs TopBar, Forecast, and Subjects immediately on login and isolates Light Mode overrides from dark Replay & Transition surfaces.",
          },
          {
            icon: "🍎",
            text: "iOS Session Fix, Exam Briefings & Feedback Diagnostics: Resolves iOS Chrome macOS tagging, switches post-teaching notifications to exam prep, and bundles self-hosted fonts offline.",
          },
        ],
      },
    ],
  },
  {
    version: "4.4.2",
    date: "Nov 20, 2026",
    sections: [
      {
        title: "Voice Mode Overhaul, ElevenLabs Streaming & Context Intelligence",
        items: [
          {
            icon: "🎨",
            text: "Light & Dark Mode Parity + Native Status Bar Sync: Portaled Voice Mode into document.body with theme-safe styling, synced Android status bar icon polarity on Light/Dark switches, upgraded the Voice Orb for visibility on both themes, and rebuilt the Voice Picker sheet with fixed header/footer framing so cards are never clipped.",
          },
          {
            icon: "⚙️",
            text: "Aligned Bottom Pill Controls: Fixed Settings gear icon overflow on compact screens by truncating Ask AttendX... cleanly inside the rounded bottom pill.",
          },
          {
            icon: "🔊",
            text: "ElevenLabs Streaming Restored on Android: Switched from unauthenticated audio URLs to authenticated POST /ai/tts with automatic JWT refresh, lossless native CapacitorHttp binary handling, tap-gesture audio unlock, and buffered MP3 Content-Length headers, plus a live Voice & Engine badge in the top bar.",
          },
          {
            icon: "✨",
            text: "Pure-White Spoken Text & Exact Cursor Sync: Synchronized word highlights directly to real audio playback time (and native onRangeStart on fallback) with punctuation weighting and full pure-white spoken words in Dark Mode (deep slate in Light Mode).",
          },
          {
            icon: "🎙️",
            text: "Continuous Microphone Stability: Removed partial-speech breakout cancellations, added silent 350ms Android speech recognizer recovery across short pauses within a 45s activity window, and prevented brief focus switches from closing Voice Mode.",
          },
          {
            icon: "🧠",
            text: "Deeper Copilot Context Awareness: Added full weekly timetable, today/tomorrow schedules, extra classes, assignments, active subject context, and recent attendance logs (with remarks) to Tier 3 AI prompts alongside multi-turn and active-subject pronoun follow-ups.",
          },
        ],
      },
    ],
  },
  {
    version: "4.4.1",
    date: "Nov 20, 2026",
    sections: [
      {
        title: "Classroom Polls, Deep-Link Stability & System Hardening",
        items: [
          {
            icon: "📊",
            text: "Classroom Polls (Stream Bars): Added Yes/No, Single-Answer, and Multiple-Answer polls inside Classrooms with live voter avatar stacks, vote counts, percentages, and Light/Dark mode contrast parity.",
          },
          {
            icon: "⏱️",
            text: "Urgent Pinned Deadlines & Stop Controls: Pin polls urgently at the top of the stream with live 1-second closing countdowns, automatic lock & result reveal on expiry, early Stop Poll controls for the author or CR Admin, optional hidden results until closed, and optional vote-lock mode.",
          },
          {
            icon: "👥",
            text: "Full Voter Stats & Silent Live Sync: Everyone in the classroom can inspect Poll Details (turnout meter, option filters, name/roll-number search, timestamps) backed by silent background polling with zero error toasts on network drops.",
          },
          {
            icon: "🔁",
            text: "Classroom Invite Deep-Link Loop Fix: Fixed the infinite classroom reopen loop when opening an invite link (?join=CODE) for an already-joined hub and prevented cold-start race popups.",
          },
          {
            icon: "🔐",
            text: "Passcode Vault & Permission Modal Fixes: Prevented stale mid-use re-locks, enforced Passcode Lock during offline cold starts, blocked hardware Back leaks behind the lock screen, and stopped the Permission Modal from auto-closing during optional DND unlock.",
          },
          {
            icon: "🛡️",
            text: "Backend Security & Android Plugin Hardening: Hardened session revocation ownership, assignment IDOR & document download containment, fail-closed APK signature validation with same-version amended support, Android 12–15 RingerForegroundService crash guards, UTC FCM timestamps, and sanitized APK download links.",
          },
        ],
      },
    ],
  },
  {
    version: "4.4.0",
    date: "Nov 17, 2026",
    sections: [
      {
        title: "AttendX Vault, Frosted Glass UI & Responsive Overhaul",
        items: [
          {
            icon: "🔐",
            text: "Passcode Lock & AttendX Vault: Added a salted SHA-256 4-digit PIN barrier under Account Settings (Slot 03) with cold-start protection, configurable auto-lock timings, and one-tap TopBar quick-lock.",
          },
          {
            icon: "👆",
            text: "Native Android Fingerprint Unlock: Integrated BiometricPrompt hardware authentication with optical setup flow and instant one-touch unlock.",
          },
          {
            icon: "🎵",
            text: "Web Audio Session & Keypad Chimes: Synthesized C-Major login chimes, descending lock sweeps, and crisp keypad glass clicks with zero asset bloat.",
          },
          {
            icon: "🪟",
            text: "Unified Frosted Glass UI: Centered floating frosted-glass modals on mobile and desktop in both Light and Dark modes across Update Prompts, Linked Devices, Edit Profile, and Add Extra Class.",
          },
          {
            icon: "⚡",
            text: "Instant Post-Login Attendance & Auto-Update Hygiene: Fixed initial 0.00% delay after sign-in, enabled automatic foreground-resume update detection, and removed manual update clutter from Settings.",
          },
          {
            icon: "📱",
            text: "Mobile & Tablet Layout Fixes: Fixed Today action bars and 5-button Extra Class rows on narrow phones, Settings criteria stacking, Landing Page tablet navigation, and Classrooms Hub tablet cards.",
          },
        ],
      },
    ],
  },
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
