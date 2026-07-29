import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding AttendX database...");

  // 1. Create or find default user (Ajack)
  const passwordHash = await bcrypt.hash("password123", 10);
  const user = await prisma.user.upsert({
    where: { email: "ajack@attendx.app" },
    update: {},
    create: {
      email: "ajack@attendx.app",
      name: "Ajack Sharma",
      passwordHash,
      rollNumber: "22105012",
      department: "Electronics & Communication Engineering",
      batch: "2024-2028",
      targetAttendance: 75,
      role: "student",
    },
  });
  console.log(`👤 Created user: ${user.name} (${user.email})`);

  // 2. Create active semester
  const semester = await prisma.semester.create({
    data: {
      userId: user.id,
      name: "Semester 5 (Fall 2026)",
      startDate: new Date("2026-07-20"),
      endDate: new Date("2026-12-15"),
      isActive: true,
    },
  });
  console.log(`📅 Created semester: ${semester.name}`);

  // 3. Create subjects with room numbers, faculty, and colors
  const subjectsData = [
    { name: "Digital Electronics", code: "ECSE303", faculty: "SAK", colorHex: "#8b5cf6" },
    { name: "Digital Communication", code: "ECMC301", faculty: "GUK", colorHex: "#3b82f6" },
    { name: "Computer Vision", code: "ICVA301", faculty: "MAC", colorHex: "#10b981" },
    { name: "Fiber Optic", code: "ECSE304", faculty: "AKW", colorHex: "#f59e0b" },
    { name: "Professional Ethics", code: "SCMS301", faculty: "NIG", colorHex: "#ec4899" },
    { name: "Communication & Soft Skills", code: "SEMS301", faculty: "SHC", colorHex: "#6366f1" },
  ];

  const subjects: Record<string, string> = {};
  for (const s of subjectsData) {
    const created = await prisma.subject.create({
      data: {
        semesterId: semester.id,
        userId: user.id,
        name: s.name,
        code: s.code,
        faculty: s.faculty,
        colorHex: s.colorHex,
        credits: 4,
      },
    });
    subjects[s.code] = created.id;
  }
  console.log(`📚 Created ${Object.keys(subjects).length} subjects`);

  // 4. Create IIIT Una Timetable Slots (Mon-Fri)
  // Day of week: 0 = Mon, 1 = Tue, 2 = Wed, 3 = Thu, 4 = Fri
  const slotsData = [
    // Monday
    { day: 0, code: "ECSE303", start: "09:00", end: "09:50", room: "Room 125" },
    { day: 0, code: "ECMC301", start: "09:50", end: "10:40", room: "Room 326" },
    { day: 0, code: "ECSE304", start: "14:00", end: "15:40", room: "Lab 5", type: "practical" as const },
    { day: 0, code: "SCMS301", start: "16:30", end: "17:20", room: "Room 228" },

    // Tuesday
    { day: 1, code: "ICVA301", start: "09:00", end: "09:50", room: "Room 226" },
    { day: 1, code: "ECSE303", start: "09:50", end: "10:40", room: "Room 226" },
    { day: 1, code: "ECSE304", start: "11:00", end: "12:40", room: "Lab 104", type: "practical" as const },
    { day: 1, code: "SEMS301", start: "15:40", end: "16:30", room: "Room 133" },
    { day: 1, code: "SCMS301", start: "16:30", end: "17:20", room: "Room 228" },

    // Wednesday
    { day: 2, code: "ECSE304", start: "09:50", end: "10:40", room: "Room 125" },
    { day: 2, code: "ICVA301", start: "11:00", end: "12:40", room: "Lab 5", type: "practical" as const },
    { day: 2, code: "ECSE303", start: "14:00", end: "15:40", room: "Lab 104", type: "practical" as const },
    { day: 2, code: "ECMC301", start: "15:40", end: "16:30", room: "Room 329" },

    // Thursday
    { day: 3, code: "ECSE303", start: "09:00", end: "09:50", room: "Room 125" },
    { day: 3, code: "ECSE304", start: "09:50", end: "10:40", room: "Room 325" },
    { day: 3, code: "SEMS301", start: "11:50", end: "12:40", room: "Room 133" },
    { day: 3, code: "ECMC301", start: "14:00", end: "15:40", room: "Lab 104", type: "practical" as const },

    // Friday
    { day: 4, code: "ECSE303", start: "09:00", end: "09:50", room: "Room 326" },
    { day: 4, code: "ECMC301", start: "09:50", end: "10:40", room: "Room 126" },
    { day: 4, code: "ECSE303", start: "14:00", end: "14:50", room: "Room 126" },
    { day: 4, code: "ICVA301", start: "16:30", end: "17:20", room: "Room 329" },
  ];

  for (const slot of slotsData) {
    if (subjects[slot.code]) {
      await prisma.timetableSlot.create({
        data: {
          semesterId: semester.id,
          subjectId: subjects[slot.code],
          dayOfWeek: slot.day,
          startTime: slot.start,
          endTime: slot.end,
          room: slot.room,
          slotType: slot.type || "lecture",
        },
      });
    }
  }
  console.log(`⏰ Seeded ${slotsData.length} timetable slots matching IIIT Una layout`);

  console.log("✅ Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
