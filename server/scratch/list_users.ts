import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function listUsers() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.map(u => ({ id: u.id, email: u.email })));
  
  const semesters = await prisma.semester.findMany();
  console.log("Semesters:", semesters.map(s => ({ id: s.id, name: s.name, userId: s.userId, isActive: s.isActive })));

  const slots = await prisma.timetableSlot.findMany();
  console.log("Total Slots:", slots.length);
}

listUsers().catch(console.error).finally(() => prisma.$disconnect());
