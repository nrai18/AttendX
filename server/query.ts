import { prisma } from "./src/lib/prisma";

async function query() {
  const users = await prisma.user.findMany({ select: { id: true, targetAttendance: true } });
  console.log("Users:", users);

  const subjects = await prisma.subject.findMany({ select: { id: true, name: true, targetAttendance: true } });
  console.log("Subjects:", subjects);
}

query().catch(console.error);
