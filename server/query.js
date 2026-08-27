const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const att = await prisma.attendance.findMany({ include: { subject: true } });
  console.log(JSON.stringify(att.filter(a => new Date(a.date).toISOString().includes('2026-11-09')), null, 2));
}
main().finally(() => prisma.$disconnect());
