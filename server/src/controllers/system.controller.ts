import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export class SystemController {
  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      latestVersion: "2.2.2",
      title: "Major Update: Deep Cloud Integration & Notifications",
      changelog: [
        {
          version: "2.2.2",
          sizeMb: 1.2,
          sections: [
            {
              title: "Quality of Life",
              items: [
                { icon: "📧", text: "Email Developer button now opens your native Gmail app directly" }
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
                { icon: "🔔", text: "Testing: Real-time Android push notifications enabled" }
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
                { icon: "☁️", text: "Cloud Storage Engine: Academic calendars are now permanently backed up to the database" },
                { icon: "📍", text: "Security Upgrade: Active sessions now request your GPS location upon login" },
                { icon: "🧹", text: "Smart Clean: Added Auto-Terminate preferences to automatically wipe ghost sessions" },
                { icon: "📅", text: "Calendar Fix: Multi-day exams (Mid-sem, Fests) now seamlessly span across the calendar rings" },
                { icon: "🔔", text: "Notification Engine: Prepared the backend foundation for real-time mobile push alerts" }
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
                { icon: "⚡", text: "Peer Sync engine overhauled: Full backups now import 50x faster" },
                { icon: "📱", text: "Redesigned 'Active Sessions' UI to accurately track devices and locations" },
                { icon: "🛡️", text: "App resets now safely purge all physical documents to free up space" },
                { icon: "💬", text: "New Feedback portal to seamlessly report bugs or request features" },
                { icon: "🎨", text: "Restored fluid Lottie animations on native mobile landing screens" }
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
                { icon: "🚀", text: "Offline-First Support with Instant Load" },
                { icon: "🔔", text: "Daily & Weekly Academic Push Notifications" },
                { icon: "🛠", text: "Google Sign-In Crash Fixes" },
                { icon: "🧮", text: "Predictive Attendance Math & Holidays Fixed" },
                { icon: "📥", text: "Native CSV & JSON Data Export Downloads" }
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
                { icon: "🏷", text: "Linked Devices page renamed to Active sessions for clarity" },
                { icon: "🛡️", text: "Instant session invalidation added to 'Sign out all others' action" },
                { icon: "💻", text: "Accurate OS, Browser, and Geolocation logging for active sessions" },
                { icon: "✅", text: "Redesigned Onboarding checklist that tracks your true real-time setup progress" }
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
                { icon: "🎥", text: "Restored full offline animations (Lottie JSONs) natively to the app" }
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
                { icon: "⏭️", text: "Added 'Not right now' button to skip updates and work uninterrupted" },
                { icon: "🎨", text: "Fixed Landing Page logo visibility and contrast on dark theme" },
                { icon: "🌐", text: "Fixed Google Sign-In redirecting to web browser" }
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
                { icon: "🎨", text: "Fixed Landing Page logo visibility and contrast on dark theme" },
                { icon: "🌐", text: "Fixed Google Sign-In redirecting to web browser" }
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
                { icon: "⚡", text: "Splash screen now gracefully skips on web, preventing duplicate animations" },
                { icon: "📥", text: "Native Google OAuth login now fully supported through Capacitor" }
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
                { icon: "📦", text: "OTA Updates now aggregate changelogs accurately" },
                { icon: "✨", text: "Landing page hero animations replaced with stable pulse effects" },
                { icon: "🔁", text: "Fixed infinite OTA loop in background check" },
                { icon: "🗂️", text: "Z-index issues fixed on settings overlays" }
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
                { icon: "📅", text: "Attendance Logs now properly track past/future dates independent of semester bounds" },
                { icon: "🧹", text: "Unmarked regular classes are now hidden from logs for a cleaner view" },
                { icon: "⭐", text: "Extra classes are properly surfaced in logs even before marking" }
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
