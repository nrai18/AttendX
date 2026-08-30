const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.count();
  const calendarEvents = await prisma.academicCalendarEvent.count();
  
  console.log("Users:", users, "Events:", calendarEvents);
}

main().catch(console.error).finally(() => prisma.$disconnect());
