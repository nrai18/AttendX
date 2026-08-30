const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    include: {
      courses: {
        include: {
          timetable: true
        }
      }
    }
  });

  const calendarEvents = await prisma.academicCalendarEvent.findMany();
  
  console.log(JSON.stringify({ users, calendarEvents }, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
