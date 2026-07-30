import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function seed() {
  const user = await prisma.user.findFirst();

  if (!user) {
    console.error("User not found");
    return;
  }

  let semester = await prisma.semester.findFirst({
    where: { userId: user.id, isActive: true }
  });

  if (!semester) {
    console.log("No active semester found. Creating one...");
    semester = await prisma.semester.create({
      data: {
        userId: user.id,
        name: "Semester 5 (IT)",
        startDate: new Date("2026-07-01"),
        endDate: new Date("2026-12-31"),
        isActive: true
      }
    });
  }

  // Clear existing slots for this semester to avoid duplicates
  await prisma.attendance.updateMany({
    where: { userId: user.id, timetableSlotId: { not: null } },
    data: { timetableSlotId: null }
  });
  await prisma.timetableSlot.deleteMany({
    where: { semesterId: semester.id }
  });

  // Ensure subjects exist
  const subjectsData = [
    { code: "ITMC301", name: "Operating Systems", type: "lecture", colorHex: "#3b82f6" },
    { code: "ITMC301_LAB", name: "Operating Systems Lab", type: "practical", colorHex: "#2563eb" },
    { code: "ITMC302", name: "Web Technologies", type: "lecture", colorHex: "#10b981" },
    { code: "ICAE301_LAB", name: "Professional Communication and Soft Skills Lab", type: "practical", colorHex: "#8b5cf6" },
    { code: "ICVA301", name: "Computer Vision", type: "lecture", colorHex: "#ec4899" },
    { code: "SCMS301", name: "Artificial Intelligence", type: "lecture", colorHex: "#f59e0b" },
    { code: "ITSE304", name: "Fiber Optic Communication", type: "lecture", colorHex: "#06b6d4" },
    { code: "ITSE304_LAB", name: "Fiber Optic Communication Lab", type: "practical", colorHex: "#0891b2" },
  ];

  const subjects = {};
  for (const s of subjectsData) {
    let sub = await prisma.subject.findFirst({
      where: { userId: user.id, semesterId: semester.id, code: s.code }
    });
    if (!sub) {
      sub = await prisma.subject.create({
        data: {
          userId: user.id,
          semesterId: semester.id,
          code: s.code,
          name: s.name,
          colorHex: s.colorHex,
          credits: s.type === "practical" ? 1 : 3
        }
      });
    } else if (sub.name !== s.name) {
      sub = await prisma.subject.update({
        where: { id: sub.id },
        data: { name: s.name }
      });
    }
    subjects[s.code] = sub;
  }

  // Define slots for G2 + AI + Fiber Optics
  // Monday = 0, Tuesday = 1, Wednesday = 2, Thursday = 3, Friday = 4
  const slotsData = [
    // Monday
    { code: "ITMC301", day: 0, start: "09:50", end: "10:40", room: "227", type: "lecture" },
    { code: "ICAE301_LAB", day: 0, start: "11:00", end: "12:40", room: "5", type: "practical" },
    { code: "ITSE304", day: 0, start: "14:00", end: "14:50", room: "228", type: "lecture" },
    { code: "ITMC301_LAB", day: 0, start: "14:50", end: "16:30", room: "203", type: "practical" },
    { code: "SCMS301", day: 0, start: "16:30", end: "17:20", room: "228", type: "lecture" },
    // Tuesday
    { code: "ITMC301", day: 1, start: "09:50", end: "10:40", room: "227", type: "lecture" },
    { code: "ITSE304_LAB", day: 1, start: "14:00", end: "15:40", room: "204", type: "practical" },
    { code: "SCMS301", day: 1, start: "16:30", end: "17:20", room: "228", type: "lecture" },
    // Wednesday
    { code: "ITMC302", day: 2, start: "09:00", end: "09:50", room: "228", type: "lecture" },
    { code: "ITMC301", day: 2, start: "09:50", end: "10:40", room: "228", type: "lecture" },
    { code: "ICVA301", day: 2, start: "15:40", end: "16:30", room: "226", type: "lecture" },
    { code: "SCMS301", day: 2, start: "16:30", end: "17:20", room: "227", type: "lecture" },
    // Thursday
    { code: "ITSE304", day: 3, start: "09:00", end: "09:50", room: "228", type: "lecture" },
    { code: "ITMC302", day: 3, start: "09:50", end: "10:40", room: "228", type: "lecture" },
    { code: "ICAE301_LAB", day: 3, start: "14:00", end: "15:40", room: "5", type: "practical" },
    { code: "ICVA301", day: 3, start: "15:40", end: "16:30", room: "231", type: "lecture" },
    // Friday
    { code: "ITSE304", day: 4, start: "09:00", end: "09:50", room: "227", type: "lecture" },
    { code: "ITMC302", day: 4, start: "09:50", end: "10:40", room: "227", type: "lecture" },
    { code: "ICVA301", day: 4, start: "16:30", end: "17:20", room: "325", type: "lecture" },
  ];

  for (const s of slotsData) {
    const sub = subjects[s.code];
    await prisma.timetableSlot.create({
      data: {
        semesterId: semester.id,
        subjectId: sub.id,
        dayOfWeek: s.day,
        startTime: s.start,
        endTime: s.end,
        room: s.room,
        slotType: s.type
      }
    });
  }

  console.log("Timetable seeded successfully for G2 + AI + Fiber Optics");
}

seed().catch(console.error).finally(() => prisma.$disconnect());
