import { Request, Response } from "express";

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
