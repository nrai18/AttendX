import { Request, Response } from "express";
import path from "path";
import fs from "fs";
import { BirthdayService } from "../services/birthday.service";

export class SystemController {
  static async getConfig(req: Request, res: Response) {
    return res.status(200).json({
      appDownloadLink: process.env.APP_DOWNLOAD_LINK || "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk",
      wsUrl: process.env.WS_URL || "wss://attendx-backend-fh6k.onrender.com/ws",
      mlApiUrl: process.env.ML_API_URL || "https://attendx-ml-server.onrender.com",
      googleClientId: process.env.GOOGLE_CLIENT_ID || "729387616931-qlajf1dss2qi1cta5pvc3dos03fh4coi.apps.googleusercontent.com"
    });
  }

  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      appDownloadLink: process.env.APP_DOWNLOAD_LINK || "https://github.com/nrai18/AttendX/releases/latest/download/AttendX.apk",
      latestVersion: "4.3.0",
      title: "Tactile Haptics, Timetable Sync & Performance Fluidity",
      changelog: [
        {
                  "version": "4.3.0",
                  "date": "Oct 14, 2026",
                  "title": "Tactile Haptics, Timetable Sync & Performance Fluidity",
                  "sections": [
                            {
                                      "title": "Tactile Experience & Haptics",
                                      "items": [
                                                {
                                                          "icon": "📳",
                                                          "text": "Universal Haptic Engine: Ultra-low latency pointer-level physical tactile response across all buttons, tabs, links, and actionable controls."
                                                },
                                                {
                                                          "icon": "👆",
                                                          "text": "Gesture Haptics: Tactile physical feedback on swipe gestures across calendar months, attendance agenda days, and bottom sheets."
                                                },
                                                {
                                                          "icon": "📅",
                                                          "text": "Calendar & Time Tactile Response: Crisp selection vibration when picking calendar dates, changing summary times, and updating notification frequencies."
                                                },
                                                {
                                                          "icon": "📊",
                                                          "text": "Timetable & Criteria Haptics: Physical clicks when stepping attendance criteria percentages, swapping schedule slots via drag-and-drop, and deleting subjects or slots."
                                                }
                                      ]
                            },
                            {
                                      "title": "Timetable & Schedule Engine",
                                      "items": [
                                                {
                                                          "icon": "📅",
                                                          "text": "Dual Timetable Display: Surfaced active timetable with 'Active' pill badge above historical archives, displaying exact start dates with pristine version resolution."
                                                },
                                                {
                                                          "icon": "📚",
                                                          "text": "Archived Version Retrofitting: Restored missing Fiber Optic Communication lecture slots to Version 1 with exact room and time normalization."
                                                },
                                                {
                                                          "icon": "🧹",
                                                          "text": "Micro-Version Elimination: Clustered archive creation to prevent single non-structural tweaks from spawning redundant timetable snapshots."
                                                },
                                                {
                                                          "icon": "🎯",
                                                          "text": "Calendar Slot Synchronization: Eliminated duplicate 'Not Marked' entries by atomically re-linking attendance records during timetable modifications."
                                                },
                                                {
                                                          "icon": "🛡️",
                                                          "text": "Ghost & Extra Class Deletion: Fortified manual extra class deletions to purge orphaned attendance records without 500 errors."
                                                }
                                      ]
                            },
                            {
                                      "title": "Voice Assistant & UI Polish",
                                      "items": [
                                                {
                                                          "icon": "🎙️",
                                                          "text": "Hands-Free Voice Loop: Assistant seamlessly listens and responds in a continuous natural conversation without repetitive query repeats."
                                                },
                                                {
                                                          "icon": "🔇",
                                                          "text": "Acoustic Echo Filtering: Hardware ghost-echo cancellation prevents the microphone from capturing device speaker output."
                                                },
                                                {
                                                          "icon": "✨",
                                                          "text": "Cinematic Entrance Animations: visionOS-inspired scale-and-blur transitions on Voice Mode and fluid 60fps attendance mark popups."
                                                },
                                                {
                                                          "icon": "🔄",
                                                          "text": "Timed Undo & Cancel Overhaul: Redesigned timed action buttons with dedicated undo icons, wine-red backgrounds, and zero number ghosting."
                                                },
                                                {
                                                          "icon": "💡",
                                                          "text": "Voice Avatar Auto-Scroll: Voice settings modal auto-scrolls to your active voice avatar when opened."
                                                },
                                                {
                                                          "icon": "🔄",
                                                          "text": "Interactive Dismissal: Added an interactive rotating close button in the Voice Mode overlay."
                                                }
                                      ]
                            },
                            {
                                      "title": "Navigation & Mobile Architecture",
                                      "items": [
                                                {
                                                          "icon": "📍",
                                                          "text": "Hardware Back Scroll Retention: Backing out of Settings subviews precisely restores your exact scroll depth without jumping to top."
                                                },
                                                {
                                                          "icon": "📱",
                                                          "text": "Hardware Back Button Flow: Deterministic back-press routing across auth, timetable, modals, and semester views, minimizing on root."
                                                },
                                                {
                                                          "icon": "📱",
                                                          "text": "Mobile Subject Management: Full multi-line subject title wrapping with always-visible delete triggers on touchscreens."
                                                },
                                                {
                                                          "icon": "🔗",
                                                          "text": "Onboarding Deep-Linking: Directly navigates into Peer Sync inside Settings and into Semester Hub from getting started checklist steps."
                                                },
                                                {
                                                          "icon": "🌐",
                                                          "text": "Cross-Device Onboarding State: Onboarding completion progress is saved to user accounts in PostgreSQL and preserved across all new logins."
                                                }
                                      ]
                            },
                            {
                                      "title": "Core Stability, Database & Notifications",
                                      "items": [
                                                {
                                                          "icon": "🎂",
                                                          "text": "Automated Birthday Engine: Fixed PostgreSQL timezone date extraction so automated birthday greetings and native push alerts dispatch reliably at 8:00 AM."
                                                },
                                                {
                                                          "icon": "🌐",
                                                          "text": "External Cron Webhook: Introduced protected /api/system/cron/birthdays endpoint for external schedulers to ensure zero missed runs."
                                                },
                                                {
                                                          "icon": "⚡",
                                                          "text": "Zero-Overhead Memory Architecture: Replaced large in-memory maps with bounded LRU caches, slashing startup heap allocations by 80MB."
                                                },
                                                {
                                                          "icon": "🔔",
                                                          "text": "Push Notification Hardening: Clean token eviction drops invalid FCM tokens and prevents dead-token loops."
                                                },
                                                {
                                                          "icon": "🔒",
                                                          "text": "Session Refresh Resilience: Hardened the authentication refresh bypass to route native mobile tokens seamlessly without false revocations."
                                                }
                                      ]
                            }
                  ]
        },
{
          "version": "4.2.0",
          "date": "Oct 2, 2026",
          "title": "Continuous Voice & Performance Overhaul",
          "sections": [
            {
              "title": "General Improvements & Bug Fixes",
                            "items": [
                { "icon": "🎙️", "text": "Fixed a UI state freeze where Hands-Free mode wouldn't exit if the hardware mic timed out due to silence." },
                { "icon": "🚀", "text": "Resolved a subtle race condition where Push Notifications wouldn't register on fresh logins." },
                { "icon": "🔐", "text": "Form metadata injected to trigger Password Managers (like Google) reliably on Android WebViews." },
                { "icon": "🐞", "text": "Restored missing Settings/FAQ route and fixed 'Go Back' button visibility on 404 pages." },
                { "icon": "⚙️", "text": "Dynamic version numbering correctly injected into the web dashboard build." },
                { "icon": "🎤", "text": "Completely resolved the Android 11+ rapid microphone cycling bug that could crash the voice system." },
                { "icon": "📱", "text": "Fixed a layout bug causing the Stop Conversation footer to disappear on desktop and small screens." },
                { "icon": "⚡", "text": "Wired cinematic typing animations perfectly to device hardware for exact lip-sync with speech audio." },
                { "icon": "✅", "text": "Cleaned up pending action Yes/No buttons so they unmount instantly after clicking." },
                { "icon": "🕰️", "text": "Resolved timezone edge cases where dates were incorrectly compared against UTC." }
              ]
            },
            {
              "title": "New Features",
              "items": [
                { "icon": "🔔", "text": "Introduced Birthday Push Notifications — the app will now ping your phone at 9:00 AM for friends' birthdays, and 8:00 AM for your own!" },
                { "icon": "📅", "text": "Added support for adding Custom Events directly into the calendar via the Semester Hub!" },
                { "icon": "🎙️", "text": "Upgraded Voice Mode to a truly hands-free continuous loop. The AI now automatically resumes listening after speaking, creating seamless back-and-forth conversations." }
              ]
            },
            {
              "title": "Architecture & Performance",
              "items": [
                { "icon": "🐛", "text": "Massive performance fix: Removed a global CSS transition that was causing severe UI jitter and frame drops when switching tabs across the app." },
                { "icon": "🎙️", "text": "Hardened Voice Mode against audio echoes by injecting a strict 200ms acoustic kill-switch before AI playback begins." }
              ]
            },
            {
              "title": "Visual Enhancements",
              "items": [
                { "icon": "🎨", "text": "Engineered a flawless CSS transition for the Light/Dark mode toggle, enabling smooth cinematic cross-fades globally." },
                { "icon": "🌙", "text": "Fixed dark mode text legibility and cleaned up dropdown categories on the Add Custom Event modal." }
              ]
            },
            {
              "title": "Bug Fixes",
              "items": [
                { "icon": "🛠️", "text": "Fixed Firebase Push Notifications bug where devices occasionally failed to sync FCM tokens on login." },
                { "icon": "📅", "text": "Fixed calendar loop bug where some regular events (like Cultural Fests) failed to dispatch morning push notifications." },
                { "icon": "🎉", "text": "Restricted Holidays now correctly dispatch morning notifications without accidentally erasing your class timetable for the day." }
              ]
            }
          ]
        },
        {
          "version": "4.1.0",
          "date": "Sep 24, 2026",
          "title": "The Architecture Update",
          "sections": [
            {
              "title": "Architecture & Performance",
              "items": [
                { "icon": "🚀", "text": "Completely overhauled the AI Copilot backend, migrating to a high-speed Gemini 3.8-Flash intent router." },
                { "icon": "🧹", "text": "Implemented an automated 14-day cache pruner to prevent infinite storage bloat." }
              ]
            },
            {
              "title": "New Features & Enhancements",
              "items": [
                { "icon": "🎙️", "text": "Fixed Voice Mode stale closures to ensure seamless, hands-free audio interaction." },
                { "icon": "📱", "text": "Corrected the mobile Calendar Agenda view to accurately display dynamic attendance statuses." }
              ]
            },
            {
              "title": "Improvements & Bug Fixes",
              "items": [
                { "icon": "📡", "text": "Fortified the offline sync engine to automatically roll back the UI and notify you if the server rejects an offline mark." },
                { "icon": "🧮", "text": "Fixed a critical offline race condition where network errors would erase the global attendance percentage to zero." },
                { "icon": "🤖", "text": "Prevented the AI Chatbot from freezing when used offline, ensuring it gracefully delivers an offline warning." }
              ]
            }
          ]
        },
        {
                "version": "4.0.0",
                "date": "Sep 21, 2026",
                "sizeMb": 18.2,
                "title": "The Intelligence Update",
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Predictive Insights: AI now predicts future attendance based on your historical patterns."
                                        },
                                        {
                                                "icon": "📱",
                                                "text": "Swipe Gestures: Effortlessly navigate through days on the agenda view using native swipes."
                                        },
                                        {
                                                "icon": "🎨",
                                                "text": "Polished OTA Update screen UI for seamless Light Mode support."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.9.0",
                "date": "Sep 15, 2026",
                "sizeMb": 16.8,
                "title": "Major Features & Polish",
                "sections": [
                        {
                                "title": "Major Features & Polish",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Added immersive full-screen Lottie animations for academic events and achievements."
                                        },
                                        {
                                                "icon": "💾",
                                                "text": "Introduced robust Backup & Restore via .zip export for full local data portability."
                                        }
                                ]
                        },
                        {
                                "title": "Offline & Sync Improvements",
                                "items": [
                                        {
                                                "icon": "🔌",
                                                "text": "Fixed race conditions in optimistic offline sync to prevent stale data overwrites."
                                        },
                                        {
                                                "icon": "⚡",
                                                "text": "Optimized timetable caching engine for instant loading across sessions."
                                        },
                                        {
                                                "icon": "🔔",
                                                "text": "Overhauled Capacitor local notification scheduling to prevent silent failures on mobile."
                                        }
                                ]
                        },
                        {
                                "title": "Bug Fixes",
                                "items": [
                                        {
                                                "icon": "🐛",
                                                "text": "Resolved a global timezone offset bug that was shifting scheduled classes by hours."
                                        },
                                        {
                                                "icon": "🐛",
                                                "text": "Fixed a calendar synchronization bug causing unmarked classes to be hidden from the agenda popover."
                                        },
                                        {
                                                "icon": "🧹",
                                                "text": "Implemented aggressive duplicate sweeping to fix classes occasionally 'snapping back' when unmarked."
                                        },
                                        {
                                                "icon": "🐛",
                                                "text": "Fixed UUID parsing logic preventing attendance records from being properly updated on Postgres."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.8.0",
                "date": "Sep 10, 2026",
                "sizeMb": 31,
                "title": "Quality of Life Update",
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "📅",
                                                "text": "Fixed overlapping extra classes ('00:00') when migrating to a new timetable."
                                        },
                                        {
                                                "icon": "✨",
                                                "text": "Added festive animations for Exams and Practical Labs in the daily agenda."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.7.0",
                "date": "Sep 05, 2026",
                "sizeMb": 31,
                "title": "UI Polish & Theming",
                "sections": [
                        {
                                "title": "What's New (UI Polish & Theming)",
                                "items": [
                                        {
                                                "icon": "🎨",
                                                "text": "Complete Calendar redesign with Orbital Operations Center aesthetic and true dark mode isolation."
                                        },
                                        {
                                                "icon": "✨",
                                                "text": "Restored missing cinematic 'E' to the Subjects hero title and fixed glassmorphism modal backgrounds globally."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "3.5.0",
                "date": "Aug 20, 2026",
                "sizeMb": 30.5,
                "sections": [
                        {
                                "title": "What's New (Security & Offline)",
                                "items": [
                                        {
                                                "icon": "🛡️",
                                                "text": "Zero-Knowledge OTPs: Upgraded internal token hashing to HMAC-SHA256, stopping offline cracking tools instantly."
                                        },
                                        {
                                                "icon": "📶",
                                                "text": "Flawless Offline Mode: Solved the 'disappearing green pill' bug. The app now accurately caches and displays your subjects and logs fully offline."
                                        },
                                        {
                                                "icon": "⏰",
                                                "text": "Precise Scheduling: Fixed an issue where the 'Time before class' offset and Monthly report schedules were being ignored or overridden."
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & UI Polish",
                                "items": [
                                        {
                                                "icon": "🎨",
                                                "text": "Complete UI/UX redesign featuring a pure brutalist aesthetic with NO neon gradients or AI slop."
                                        },
                                        {
                                                "icon": "🚦",
                                                "text": "Forgot Password rate limiter actively throttles spammers to 1 request every 15 minutes."
                                        },
                                        {
                                                "icon": "📝",
                                                "text": "Secured backend console logs to aggressively mask all authentication data."
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.6.2",
                "date": "Aug 10, 2026",
                "sizeMb": 25.4,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "🔒",
                                                "text": "Stateless OTP Security: Gorgeous new 6-digit email flows for resetting passwords safely"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Background AI Wakeup: Instant ML server booting upon app launch for zero-delay chat"
                                        },
                                        {
                                                "icon": "💬",
                                                "text": "Zero-State Chatbot: Complete redesign with conversation history persistence"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.5.1",
                "date": "Aug 05, 2026",
                "sizeMb": 24.8,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Immersive Voice Mode: Full-screen AI voice assistant with continuous conversation orb"
                                        },
                                        {
                                                "icon": "📊",
                                                "text": "Analytics Dashboard: Data-dense charts for weekly/monthly performance and predictions"
                                        },
                                        {
                                                "icon": "🤖",
                                                "text": "Agentic Execution: AI can now directly change your reminder frequencies and settings"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Deep Context: AI natively understands app states, limits, and semester boundaries"
                                        }
                                ]
                        },
                        {
                                "title": "Bug Fixes & UI Polish",
                                "items": [
                                        {
                                                "icon": "🐛",
                                                "text": "Mojibake Fixed: Resolved UTF-8 corruption causing emojis to render improperly"
                                        },
                                        {
                                                "icon": "🎨",
                                                "text": "Sleek AI States: Removed bulky multi-stage loading blocks for minimal typing dots"
                                        },
                                        {
                                                "icon": "🔗",
                                                "text": "Smart Routing: Tapping summary notifications routes straight to the Analytics Dashboard"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.5.0",
                "date": "Aug 01, 2026",
                "sizeMb": 31.4,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "🔌",
                                                "text": "The Offline Engine: Mark attendance offline; auto-syncs when reconnected"
                                        },
                                        {
                                                "icon": "📅",
                                                "text": "Smart Holiday Alarms: Mutes class reminders automatically during exams and holidays"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Intelligent Caching: Calendar and Subject pages load flawlessly without internet"
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & UI Polish",
                                "items": [
                                        {
                                                "icon": "📱",
                                                "text": "Dynamic Notch Support: Headers no longer overlap with your system status bar"
                                        },
                                        {
                                                "icon": "🔙",
                                                "text": "Hardware Navigation: Physical back button gracefully routes through the app"
                                        },
                                        {
                                                "icon": "⚙️",
                                                "text": "Smart Update History: Only shows features currently installed on your phone"
                                        },
                                        {
                                                "icon": "🔔",
                                                "text": "Instant Rescheduling: Adjusting reminder offsets instantly reprograms OS alarms"
                                        }
                                ]
                        },
                        {
                                "title": "Bug Fixes",
                                "items": [
                                        {
                                                "icon": "👻",
                                                "text": "Ghost Data Purge: Eradicated aggressive cache leaks when switching accounts"
                                        },
                                        {
                                                "icon": "📦",
                                                "text": "OTA Engine: Upgraded compression to resolve native 'OTA Download Failed' errors"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.4.6",
                "date": "Jul 25, 2026",
                "sizeMb": 5.1,
                "sections": [
                        {
                                "title": "Offline & Notification Engine",
                                "items": [
                                        {
                                                "icon": "🔌",
                                                "text": "Offline Mutation Queue: Mark attendance offline and auto-sync when reconnected"
                                        },
                                        {
                                                "icon": "📅",
                                                "text": "Smart Holidays: Mutes class reminders automatically during exams, vacations, and holidays"
                                        },
                                        {
                                                "icon": "⚡",
                                                "text": "Instant Rescheduling: Updating your reminder offset now recalculates OS alarms instantly"
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & Fixes",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "Status Bar Fixes: Headers no longer overlap with the notch on Login, Devices, and Settings"
                                        },
                                        {
                                                "icon": "📱",
                                                "text": "Hardware Back Button: Smoothly navigate back to the home screen instead of exiting the app"
                                        },
                                        {
                                                "icon": "🐛",
                                                "text": "Ghost Data Fix: Erased aggressive cache leaking when switching accounts"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.4.5",
                "date": "Jul 20, 2026",
                "sizeMb": 30,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "✨",
                                                "text": "3D Immersive Reports: Gorgeous new visualizations for your weekly and monthly stats"
                                        },
                                        {
                                                "icon": "📧",
                                                "text": "Automated Emails: Stunning new welcome emails and secure password reset emails"
                                        }
                                ]
                        },
                        {
                                "title": "Security & Fixes",
                                "items": [
                                        {
                                                "icon": "🛡️",
                                                "text": "Delete Account: Added a secure, permanent account deletion option in Settings"
                                        },
                                        {
                                                "icon": "🔧",
                                                "text": "Performance: Fixed an infinite polling bug in Linked Devices that choked the server"
                                        },
                                        {
                                                "icon": "📱",
                                                "text": "Smart Notifications: Timetable Alerts and Summary settings now automatically hide based on your frequency choice"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.3.0",
                "date": "Jul 15, 2026",
                "sizeMb": 15.4,
                "sections": [
                        {
                                "title": "What's New",
                                "items": [
                                        {
                                                "icon": "🔗",
                                                "text": "Peer Sync: Securely mirror your timetable or attendance to friends using a 6-digit code"
                                        },
                                        {
                                                "icon": "🤖",
                                                "text": "AI Academic Calendar Import: Upload official calendars and extract holidays directly"
                                        },
                                        {
                                                "icon": "💻",
                                                "text": "Session Management: View and remotely revoke all active devices"
                                        },
                                        {
                                                "icon": "🚀",
                                                "text": "Native App Sharing: Share the AttendX app directly via OS share menu"
                                        }
                                ]
                        },
                        {
                                "title": "Improvements & Fixes",
                                "items": [
                                        {
                                                "icon": "🌓",
                                                "text": "True Light & Dark Mode: High-contrast light mode and sleek dark mode"
                                        },
                                        {
                                                "icon": "🔒",
                                                "text": "Persistent Sessions: You will no longer be randomly logged out"
                                        },
                                        {
                                                "icon": "🧠",
                                                "text": "Smarter AI Parser: Detects stacked electives for granular control"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.2.2",
                "date": "Jul 10, 2026",
                "sizeMb": 1.2,
                "sections": [
                        {
                                "title": "Quality of Life",
                                "items": [
                                        {
                                                "icon": "✉️",
                                                "text": "Email Developer button now opens your native Gmail app directly"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.2.1",
                "date": "Jul 05, 2026",
                "sizeMb": 1.2,
                "sections": [
                        {
                                "title": "Developer Preview",
                                "items": [
                                        {
                                                "icon": "🔔",
                                                "text": "Testing: Real-time Android push notifications enabled"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.2.0",
                "date": "Jul 01, 2026",
                "sizeMb": 4.8,
                "sections": [
                        {
                                "title": "New Features & Fixes",
                                "items": [
                                        {
                                                "icon": "☁️",
                                                "text": "Cloud Storage Engine: Academic calendars are now permanently backed up to the database"
                                        },
                                        {
                                                "icon": "📍",
                                                "text": "Security Upgrade: Active sessions now request your GPS location upon login"
                                        },
                                        {
                                                "icon": "🧹",
                                                "text": "Smart Clean: Added Auto-Terminate preferences to automatically wipe ghost sessions"
                                        },
                                        {
                                                "icon": "📅",
                                                "text": "Calendar Fix: Multi-day exams (Mid-sem, Fests) now seamlessly span across the calendar rings"
                                        },
                                        {
                                                "icon": "⚙️",
                                                "text": "Notification Engine: Prepared the backend foundation for real-time mobile push alerts"
                                        }
                                ]
                        }
                ]
        },
        {
                "version": "2.1.0",
                "date": "Jun 25, 2026",
                "sizeMb": 4.5,
                "sections": [
                        {
                                "title": "Major Improvements",
                                "items": [
                                        {
                                                "icon": "⚡",
                                                "text": "Peer Sync engine overhauled: Full backups now import 50x faster"
                                        },
                                        {
                                                "icon": "🔍",
                                                "text": "Redesigned 'Active Sessions' UI to accurately track devices and locations"
                                        },
                                        {
                                                "icon": "🗑️",
                                                "text": "App resets now safely purge all physical documents to free up space"
                                        },
                                        {
                                                "icon": "💬",
                                                "text": "New Feedback portal to seamlessly report bugs or request features"
                                        },
                                        {
                                                "icon": "🎥",
                                                "text": "Restored fluid Lottie animations on native mobile landing screens"
                                        }
                                ]
                        }
                ]
        }
]
    };

    try {
      const updatePath = path.resolve(process.cwd(), "src/uploads/update.zip");
      if (fs.existsSync(updatePath)) {
        const stats = fs.statSync(updatePath);
        (manifest as any).downloadSizeMb = parseFloat((stats.size / (1024 * 1024)).toFixed(2));
      }
    } catch (e) {
      console.error("Failed to calculate update size", e);
    }

    res.json(manifest);
  }

  static async downloadUpdate(req: Request, res: Response) {
    const updatePath = path.resolve(process.cwd(), "src/uploads/update.zip");
    if (fs.existsSync(updatePath)) {
      res.download(updatePath);
    } else {
      res.status(404).json({ message: "Update package not found" });
    }
  }

  static async triggerBirthdayCron(req: Request, res: Response) {
    try {
      const result = await BirthdayService.ensureBirthdaySentForAll();
      return res.status(200).json({
        success: true,
        message: `Birthday cron executed successfully. ${result.sentCount} greeting(s) sent.`,
        data: result
      });
    } catch (error: any) {
      console.error('[SystemController] Birthday cron error:', error);
      return res.status(500).json({ success: false, error: error.message || 'Failed to execute birthday cron' });
    }
  }
}


