export interface ChangelogVersion {
  version: string;
  date: string;
  size?: string;
  title?: string;
  sections: {
    title: string;
    items: {
      icon: string;
      text: string;
    }[];
  }[];
  notes?: string;
}

export const APP_CHANGELOG: ChangelogVersion[] = [
  {
    version: "2.3.0",
    date: "Sep 01, 2026",
    size: "15.4 MB",
    title: "The Sync & Themes Update",
    sections: [
      {
        title: "What's New",
        items: [
          {
            icon: "🔄",
            text: "Peer Sync (Schedule Mirroring): Securely transfer your timetable, calendar, or attendance history to friends using a 6-digit code with Sync Previews.",
          },
          {
            icon: "📅",
            text: "AI Academic Calendar Import: Upload your university's official calendar and extract holidays directly into your matrix view.",
          },
          {
            icon: "📱",
            text: "Session Management: View and remotely revoke all active devices logged into your account from Settings.",
          },
          {
            icon: "📤",
            text: "Native App Sharing: Share the AttendX app directly via WhatsApp, Telegram, or email using the native OS share menu.",
          },
        ],
      },
      {
        title: "Improvements & Fixes",
        items: [
          {
            icon: "🌗",
            text: "True Light & Dark Mode: We've completely rebuilt our design system for high-contrast Light Mode and sleek Dark Mode.",
          },
          {
            icon: "🔐",
            text: "Persistent Sessions: You will no longer be randomly logged out. Sessions securely persist for 30 days.",
          },
          {
            icon: "🤖",
            text: "Smarter AI Timetable Parser: Flawlessly detects stacked electives for granular import control.",
          },
          {
            icon: "🐛",
            text: "Bug fixes: Resolved infinite loading spinners, Sync Preview bugs, and duplicate ghost sessions.",
          },
        ],
      },
    ]
  },
  {
    version: "1.1.1",
    date: "Aug 26, 2026",
    size: "2.1 MB",
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
          }
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
          }
        ],
      }
    ]
  },
  {
    version: "1.1.0",
    date: "Aug 26, 2026",
    size: "14.2 MB",
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
    notes: "Your device may run slightly warmer while syncing the new notification profiles. This is normal.",
  },
  {
    version: "1.0.0",
    date: "Aug 20, 2026",
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

export const CURRENT_VERSION = APP_CHANGELOG[0].version;


