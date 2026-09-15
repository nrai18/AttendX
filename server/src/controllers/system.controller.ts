import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export class SystemController {
  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      latestVersion: process.env.LATEST_APP_VERSION || "3.7",
      title: "The UI Polish & Theming Update",
      changelog: [
        {
          version: "3.7",
          date: "2026-09-13",
          sizeMb: 31.0,
          sections: [
            {
              title: "What's New (UI Polish & Theming)",
              items: [
                { icon: "🎨", text: "Complete Calendar redesign with Orbital Operations Center aesthetic and true dark mode isolation." },
                { icon: "✨", text: "Restored missing cinematic 'E' to the Subjects hero title and fixed glassmorphism modal backgrounds globally." }
              ]
            }
          ]
        },
        {
          version: "3.5",
          date: "2026-09-10",
          sizeMb: 30.2,
          sections: [
            {
              title: "What's New (Security & Offline)",
              items: [
                { icon: "🛡️", text: "Zero-Knowledge OTPs: Upgraded internal token hashing to HMAC-SHA256, stopping offline cracking tools instantly." },
                { icon: "📶", text: "Flawless Offline Mode: Solved the 'disappearing green pill' bug. The app now accurately caches and displays your subjects and logs fully offline." },
                { icon: "⏰", text: "Precise Scheduling: Fixed an issue where the 'Time before class' offset and Monthly report schedules were being ignored or overridden." }
              ]
            },
            {
              title: "Improvements & UI Polish",
              items: [
                { icon: "🎨", text: "Complete UI/UX redesign featuring a pure brutalist aesthetic with NO neon gradients or AI slop." },
                { icon: "🚦", text: "Forgot Password rate limiter actively throttles spammers to 1 request every 15 minutes." },
                { icon: "📝", text: "Secured backend console logs to aggressively mask all authentication data." }
              ]
            }
          ],
          mandatory: true
        },
        {
          version: "2.6.2",
          sizeMb: 5.2,
          sections: [
            {
              title: "What's New",
              items: [
                { icon: "🔒", text: "Stateless OTP Security: Gorgeous new 6-digit email flows for resetting passwords safely" },
                { icon: "🧠", text: "Background AI Wakeup: Instant ML server booting upon app launch for zero-delay chat" },
                { icon: "💬", text: "Zero-State Chatbot: Complete redesign with conversation history persistence" }
              ]
            }
          ]
        },
        {
          version: "2.5.1",
          sizeMb: 4.8,
          sections: [
            {
              title: "What's New",
              items: [
                { icon: "✨", text: "Immersive Voice Mode: Full-screen AI voice assistant with continuous conversation orb" },
                { icon: "📊", text: "Analytics Dashboard: Data-dense charts for weekly/monthly performance and predictions" },
                { icon: "🤖", text: "Agentic Execution: AI can now directly change your reminder frequencies and settings" },
                { icon: "🧠", text: "Deep Context: AI natively understands app states, limits, and semester boundaries" }
              ]
            },
            {
              title: "Bug Fixes & UI Polish",
              items: [
                { icon: "🐛", text: "Mojibake Fixed: Resolved UTF-8 corruption causing emojis to render improperly" },
                { icon: "🎨", text: "Sleek AI States: Removed bulky multi-stage loading blocks for minimal typing dots" },
                { icon: "🔗", text: "Smart Routing: Tapping summary notifications routes straight to the Analytics Dashboard" }
              ]
            }
          ]
        },
        {
          version: "2.5.0",
          sizeMb: 31.4,
          sections: [
            {
              title: "What's New",
              items: [
                { icon: "🔌", text: "The Offline Engine: Mark attendance offline; auto-syncs when reconnected" },
                { icon: "📅", text: "Smart Holiday Alarms: Mutes class reminders automatically during exams and holidays" },
                { icon: "🧠", text: "Intelligent Caching: Calendar and Subject pages load flawlessly without internet" }
              ]
            },
            {
              title: "Improvements & UI Polish",
              items: [
                { icon: "📱", text: "Dynamic Notch Support: Headers no longer overlap with your system status bar" },
                { icon: "🔙", text: "Hardware Navigation: Physical back button gracefully routes through the app" },
                { icon: "⚙️", text: "Smart Update History: Only shows features currently installed on your phone" },
                { icon: "🔔", text: "Instant Rescheduling: Adjusting reminder offsets instantly reprograms OS alarms" }
              ]
            },
            {
              title: "Bug Fixes",
              items: [
                { icon: "👻", text: "Ghost Data Purge: Eradicated aggressive cache leaks when switching accounts" },
                { icon: "📦", text: "OTA Engine: Upgraded compression to resolve native 'OTA Download Failed' errors" }
              ]
            }
          ]
        },
        {
          version: "2.4.6",
          sizeMb: 5.1,
          sections: [
            {
              title: "Offline & Notification Engine",
              items: [
                { icon: "🔌", text: "Offline Mutation Queue: Mark attendance offline and auto-sync when reconnected" },
                { icon: "📅", text: "Smart Holidays: Mutes class reminders automatically during exams, vacations, and holidays" },
                { icon: "⚡", text: "Instant Rescheduling: Updating your reminder offset now recalculates OS alarms instantly" }
              ]
            },
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "✨", text: "Status Bar Fixes: Headers no longer overlap with the notch on Login, Devices, and Settings" },
                { icon: "📱", text: "Hardware Back Button: Smoothly navigate back to the home screen instead of exiting the app" },
                { icon: "🐛", text: "Ghost Data Fix: Erased aggressive cache leaking when switching accounts" }
              ]
            }
          ]
        },
        {
          version: "2.4.5",
          sizeMb: 30.02,
          sections: [
            {
              title: "What's New",
              items: [
                { icon: "✨", text: "3D Immersive Reports: Gorgeous new visualizations for your weekly and monthly stats" },
                { icon: "📧", text: "Automated Emails: Stunning new welcome emails and secure password reset emails" }
              ]
            },
            {
              title: "Security & Fixes",
              items: [
                { icon: "🛡️", text: "Delete Account: Added a secure, permanent account deletion option in Settings" },
                { icon: "🔧", text: "Performance: Fixed an infinite polling bug in Linked Devices that choked the server" },
                { icon: "📱", text: "Smart Notifications: Timetable Alerts and Summary settings now automatically hide based on your frequency choice" }
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
                { icon: "🔗", text: "Peer Sync: Securely mirror your timetable or attendance to friends using a 6-digit code" },
                { icon: "🤖", text: "AI Academic Calendar Import: Upload official calendars and extract holidays directly" },
                { icon: "💻", text: "Session Management: View and remotely revoke all active devices" },
                { icon: "🚀", text: "Native App Sharing: Share the AttendX app directly via OS share menu" }
              ]
            },
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "🌓", text: "True Light & Dark Mode: High-contrast light mode and sleek dark mode" },
                { icon: "🔒", text: "Persistent Sessions: You will no longer be randomly logged out" },
                { icon: "🧠", text: "Smarter AI Parser: Detects stacked electives for granular control" }
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
                { icon: "✉️", text: "Email Developer button now opens your native Gmail app directly" }
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
                { icon: "⚙️", text: "Notification Engine: Prepared the backend foundation for real-time mobile push alerts" }
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
                { icon: "🔍", text: "Redesigned 'Active Sessions' UI to accurately track devices and locations" },
                { icon: "🗑️", text: "App resets now safely purge all physical documents to free up space" },
                { icon: "💬", text: "New Feedback portal to seamlessly report bugs or request features" },
                { icon: "🎥", text: "Restored fluid Lottie animations on native mobile landing screens" }
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
}


