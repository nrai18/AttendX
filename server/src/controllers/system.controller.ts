import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export class SystemController {
  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      latestVersion: "2.4.1",
      title: "The Sync & Themes Update",
            changelog: [
        {
          version: "2.4.1",
          sizeMb: 30.17,
          sections: [
            {
              title: "What's New",
              items: [
                { icon: "\u2728", text: "3D Immersive Reports: Gorgeous new visualizations for your weekly and monthly stats" },
                { icon: "\uD83D\uDCE7", text: "Automated Emails: Stunning new welcome emails and secure password reset emails" }
              ]
            },
            {
              title: "Security & Fixes",
              items: [
                { icon: "\uD83D\uDEE1\uFE0F", text: "Delete Account: Added a secure, permanent account deletion option in Settings" },
                { icon: "\uD83D\uDD27", text: "Performance: Fixed an infinite polling bug in Linked Devices that choked the server" },
                { icon: "\uD83D\uDCF1", text: "Smart Notifications: Timetable Alerts and Summary settings now automatically hide based on your frequency choice" }
              ]
            }
          ]
        },
{
          version: "2.3.0",
          sizeMb: 15.4,
          sections: [
            {
              title: "What's New",
              items: [
                { icon: "🔄", text: "Peer Sync: Securely mirror your timetable or attendance to friends using a 6-digit code" },
                { icon: "📅", text: "AI Academic Calendar Import: Upload official calendars and extract holidays directly" },
                { icon: "📱", text: "Session Management: View and remotely revoke all active devices" },
                { icon: "📤", text: "Native App Sharing: Share the AttendX app directly via OS share menu" }
              ]
            },
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "🌗", text: "True Light & Dark Mode: High-contrast light mode and sleek dark mode" },
                { icon: "🔐", text: "Persistent Sessions: You will no longer be randomly logged out" },
                { icon: "🤖", text: "Smarter AI Parser: Detects stacked electives for granular control" }
              ]
            }
          ]
        },
        {
          version: "2.2.2",
          sizeMb: 1.2,
          sections: [
            {
              title: "Quality of Life",
              items: [
                { icon: "ðŸ“§", text: "Email Developer button now opens your native Gmail app directly" }
              ]
            }
          ]
        },
                {
          version: "2.2.1",
          sizeMb: 1.2,
          sections: [
            {
              title: "Developer Preview",
              items: [
                { icon: "ðŸ””", text: "Testing: Real-time Android push notifications enabled" }
              ]
            }
          ]
        },
                {
          version: "2.2.0",
          sizeMb: 4.8,
          sections: [
            {
              title: "New Features & Fixes",
              items: [
                { icon: "â˜ï¸", text: "Cloud Storage Engine: Academic calendars are now permanently backed up to the database" },
                { icon: "ðŸ“", text: "Security Upgrade: Active sessions now request your GPS location upon login" },
                { icon: "ðŸ§¹", text: "Smart Clean: Added Auto-Terminate preferences to automatically wipe ghost sessions" },
                { icon: "ðŸ“…", text: "Calendar Fix: Multi-day exams (Mid-sem, Fests) now seamlessly span across the calendar rings" },
                { icon: "ðŸ””", text: "Notification Engine: Prepared the backend foundation for real-time mobile push alerts" }
              ]
            }
          ]
        },
        {
          version: "2.1.0",
          sizeMb: 4.5,
          sections: [
            {
              title: "Major Improvements",
              items: [
                { icon: "âš¡", text: "Peer Sync engine overhauled: Full backups now import 50x faster" },
                { icon: "ðŸ“±", text: "Redesigned 'Active Sessions' UI to accurately track devices and locations" },
                { icon: "ðŸ›¡ï¸", text: "App resets now safely purge all physical documents to free up space" },
                { icon: "ðŸ’¬", text: "New Feedback portal to seamlessly report bugs or request features" },
                { icon: "ðŸŽ¨", text: "Restored fluid Lottie animations on native mobile landing screens" }
              ]
            }
          ]
        },
        {
          version: "2.0.0",
          sizeMb: 0.5,
          sections: [
            {
              title: "Major Improvements",
              items: [
                { icon: "ðŸš€", text: "Offline-First Support with Instant Load" },
                { icon: "ðŸ””", text: "Daily & Weekly Academic Push Notifications" },
                { icon: "ðŸ› ", text: "Google Sign-In Crash Fixes" },
                { icon: "ðŸ§®", text: "Predictive Attendance Math & Holidays Fixed" },
                { icon: "ðŸ“¥", text: "Native CSV & JSON Data Export Downloads" }
              ]
            }
          ]
        },
        {
          version: "1.3.11",
          sizeMb: 0.1,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "ðŸ·", text: "Linked Devices page renamed to Active sessions for clarity" },
                { icon: "ðŸ›¡ï¸", text: "Instant session invalidation added to 'Sign out all others' action" },
                { icon: "ðŸ’»", text: "Accurate OS, Browser, and Geolocation logging for active sessions" },
                { icon: "âœ…", text: "Redesigned Onboarding checklist that tracks your true real-time setup progress" }
              ]
            }
          ]
        },
        {
          version: "1.3.10",
          sizeMb: 30.1,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "ðŸŽ¥", text: "Restored full offline animations (Lottie JSONs) natively to the app" }
              ]
            }
          ]
        },
        {
          version: "1.3.3",
          sizeMb: 4.2,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "â­ï¸", text: "Added 'Not right now' button to skip updates and work uninterrupted" },
                { icon: "ðŸŽ¨", text: "Fixed Landing Page logo visibility and contrast on dark theme" },
                { icon: "ðŸŒ", text: "Fixed Google Sign-In redirecting to web browser" }
              ]
            }
          ]
        },
        {
          version: "1.3.2",
          sizeMb: 4.2,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "ðŸŽ¨", text: "Fixed Landing Page logo visibility and contrast on dark theme" },
                { icon: "ðŸŒ", text: "Fixed Google Sign-In redirecting to web browser" }
              ]
            }
          ]
        },
        {
          version: "1.3.1",
          sizeMb: 0.2,
          sections: [
            {
              title: "Native Enhancements",
              items: [
                { icon: "âš¡", text: "Splash screen now gracefully skips on web, preventing duplicate animations" },
                { icon: "ðŸ“¥", text: "Native Google OAuth login now fully supported through Capacitor" }
              ]
            }
          ]
        },
        {
          version: "1.3.0",
          sizeMb: 12.5,
          sections: [
            {
              title: "New Features & OTA Improvements",
              items: [
                { icon: "ðŸ“¦", text: "OTA Updates now aggregate changelogs accurately" },
                { icon: "âœ¨", text: "Landing page hero animations replaced with stable pulse effects" },
                { icon: "ðŸ”", text: "Fixed infinite OTA loop in background check" },
                { icon: "ðŸ—‚ï¸", text: "Z-index issues fixed on settings overlays" }
              ]
            }
          ]
        },
        {
          version: "1.1.2",
          sizeMb: 0.1,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "ðŸ“…", text: "Attendance Logs now properly track past/future dates independent of semester bounds" },
                { icon: "ðŸ§¹", text: "Unmarked regular classes are now hidden from logs for a cleaner view" },
                { icon: "â­", text: "Extra classes are properly surfaced in logs even before marking" }
              ]
            }
          ]
        }
      ]
    };

    try {
      const updatePath = path.join(__dirname, "../uploads/update.zip");
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
    const updatePath = path.join(__dirname, "../uploads/update.zip");
    if (fs.existsSync(updatePath)) {
      res.download(updatePath);
    } else {
      res.status(404).json({ message: "Update package not found" });
    }
  }
}

