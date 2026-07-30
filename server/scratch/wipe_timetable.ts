import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function wipeTimetable() {
  const user = await prisma.user.findUnique({
    where: { email: 'dev@iiitu.ac.in' }
  });
  if (!user) {
    console.error("User not found");
    return;
  }
  
  const activeSemester = await prisma.semester.findFirst({
    where: { userId: user.id, isActive: true }
  });

  if (!activeSemester) {
    console.error("No active semester found");
    return;
  }
  
  const deleted = await prisma.timetableSlot.deleteMany({
    where: { semesterId: activeSemester.id }
  });

  console.log(`Deleted ${deleted.count} timetable slots.`);
}

wipeTimetable().catch(console.error).finally(() => prisma.$disconnect());
