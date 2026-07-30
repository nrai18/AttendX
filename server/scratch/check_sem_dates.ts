import { prisma } from "../src/lib/prisma";

async function main() {
  const sems = await prisma.semester.findMany({ where: { isActive: true } });
  console.log(JSON.stringify(sems, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
