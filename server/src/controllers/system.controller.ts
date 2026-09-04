import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export class SystemController {
  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      latestVersion: "2.4.6",
      title: "The Sync & Themes Update",
            changelog: [
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
          version: "2.3.0",
          sizeMb: 5.0,
          sections: [
            {
              title: "Major Updates",
              items: [
                { icon: "📱", text: "Session Management: View and remotely revoke all active devices" },
                { icon: "🚀", text: "Native App Sharing: Share the AttendX app directly via OS share menu" }
              ]
            }
          ]
        }
      ]    };

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


