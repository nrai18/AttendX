import { prisma } from './src/lib/prisma';
async function run() {
  const evts = await prisma.event.findMany();
  console.log("EVENTS:");
  console.log(JSON.stringify(evts, null, 2));

  const sems = await prisma.semester.findMany();
  console.log("SEMESTERS:");
  console.log(JSON.stringify(sems, null, 2));
}
run().catch(console.error).finally(() => prisma.$disconnect());
