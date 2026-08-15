import { prisma } from "./src/lib/prisma";

async function clean() {
  const res = await prisma.timetableOverride.deleteMany({
    where: { subjectId: null },
  });
  console.log("Deleted null subject overrides:", res.count);
}

clean().catch(console.error);
