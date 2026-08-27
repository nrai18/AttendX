import { Request, Response } from "express";
import path from "path";
import fs from "fs";

export class SystemController {
  static async getUpdateManifest(req: Request, res: Response) {
    const manifest = {
      latestVersion: "1.3.8",
      title: "UI Polish & Bug Fixes",
      changelog: [
        {
          version: "1.3.8",
          sizeMb: 30.1,
          sections: [
            {
              title: "Improvements & Fixes",
              items: [
                { icon: "✨", text: "Restored full offline animations (Lottie JSONs) natively to the app" }
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
                { icon: "✨", text: "Fixed Landing Page logo visibility and contrast on dark theme" },
                { icon: "🔧", text: "Fixed Google Sign-In redirecting to web browser" }
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
                { icon: "✨", text: "Fixed Landing Page logo visibility and contrast on dark theme" },
                { icon: "🔧", text: "Fixed Google Sign-In redirecting to web browser" }
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
                { icon: "📱", text: "Splash screen now gracefully skips on web, preventing duplicate animations" },
                { icon: "🔐", text: "Native Google OAuth login now fully supported through Capacitor" }
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
                { icon: "🖼️", text: "Landing page hero animations replaced with stable pulse effects" },
                { icon: "🐛", text: "Fixed infinite OTA loop in background check" },
                { icon: "🚀", text: "Z-index issues fixed on settings overlays" }
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
                { icon: "👁️", text: "Unmarked regular classes are now hidden from logs for a cleaner view" },
                { icon: "➕", text: "Extra classes are properly surfaced in logs even before marking" }
              ]
            }
          ]
        }
      ]
    };
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
