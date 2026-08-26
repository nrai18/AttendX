import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export class SystemController {
  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      latestVersion: "1.1.2",
      title: "Logs Fix & OTA Engine",
      changelog: [
        {
          version: "1.1.2",
          sizeMb: 0.1,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "📅", text: "Attendance Logs now properly track past/future dates independent of semester bounds" },
                { icon: "👁️", text: "Unmarked regular classes are now hidden from logs for a cleaner view" },
                { icon: "➕", text: "Extra classes are properly surfaced in logs even before marking" }
              ]
            }
          ]
        },
        {
          version: "1.1.1",
          sizeMb: 0.1,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "🛠️", text: "Added live Capacitor OTA engine" },
                { icon: "📱", text: "Implemented device fingerprinting for modals" },
                { icon: "🔌", text: "Fixed ghost node process holding port 3000" }
              ]
            }
          ]
        },
        {
          version: "1.1.0",
          sizeMb: 2.4,
          sections: [
            {
              title: "New Features",
              items: [
                { icon: "✨", text: "Brand new cumulative OTA Update system" },
                { icon: "🔒", text: "Added AES-256 encrypted support logs" }
              ]
            }
          ]
        }
      ]
    };
    res.json(manifest);
  }

  static async downloadUpdate(req: Request, res: Response) {
    // __dirname is server/dist when bundled via tsup
    const updatePath = path.join(__dirname, "../uploads/update.zip");
    if (fs.existsSync(updatePath)) {
      res.download(updatePath);
    } else {
      res.status(404).json({ message: "Update package not found" });
    }
  }
}

export const getUpdates = async (req: Request, res: Response) => {
  const changelog = [
    {
      version: "1.1.1",
      date: "Aug 26, 2026",
      sizeMb: 2.1,
      title: "Performance & UI Polish",
      sections: [
        {
          title: "Speed and Animations",
          items: [
            {
              icon: "?",
              text: "Added structural Skeleton loading animations to all main pages for instant perceptual loading.",
            },
            {
              icon: "??",
              text: "Replaced the generic spinning circles with native-feeling pulse layouts.",
            },
          ],
        },
        {
          title: "Under the Hood",
          items: [
            {
              icon: "??",
              text: "Resolved a backend UUID module crash affecting session generation.",
            },
            {
              icon: "??",
              text: "Improved notification mock previews on the web dashboard.",
            },
          ],
        },
      ],
    },
    {
      version: "1.1.0",
      date: "Aug 26, 2026",
      sizeMb: 14.2,
      title: "Welcome to AttendX 1.1",
      sections: [
        {
          title: "Mobile Polish & Notifications",
          items: [
            {
              icon: "??",
              text: "App layout is now strictly locked to portrait mode for a consistent mobile experience.",
            },
            {
              icon: "??",
              text: "Added extensive Notification Settings (Class Reminders, DND, Holidays, Birthdays).",
            },
            {
              icon: "??",
              text: "Native pinned overlay added for when Do Not Disturb is active during classes.",
            },
          ],
        },
        {
          title: "General Improvements and Bug Fixes",
          items: [
            {
              icon: "?",
              text: "Removed obsolete Assignments features to declutter the interface.",
            },
            {
              icon: "??",
              text: "Added a dedicated Error 404 page for missing routes.",
            },
            {
              icon: "??",
              text: "Added a brand new Support & Feedback section to report bugs directly.",
            },
            {
              icon: "??",
              text: "System logs attached to support tickets are now securely encrypted (.bin).",
            },
          ],
        },
      ],
    },
    {
      version: "1.0.0",
      date: "Aug 20, 2026",
      sizeMb: 45.5,
      title: "Initial Release",
      sections: [
        {
          title: "Core Features",
          items: [
            {
              icon: "??",
              text: "Launched AttendX with core Timetable and Attendance tracking.",
            },
            { icon: "??", text: "Added Peer-to-Peer local sync." },
          ],
        },
      ],
    },
  ];

  res.json({
    latestVersion: changelog[0].version,
    changelog,
  });
};
