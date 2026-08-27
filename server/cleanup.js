const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const { PrismaClient } = require('@prisma/client');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const orphaned = await prisma.attendance.findMany({
    where: {
      timetableSlotId: null,
      overrideId: null,
      status: 'off'
    }
  });
  console.log('Orphaned without slot/override:', orphaned.length);
  
  if (orphaned.length > 0) {
    console.log('Deleting...');
    await prisma.attendance.deleteMany({
      where: { id: { in: orphaned.map(o => o.id) } }
    });
  }

  const allOverrides = await prisma.timetableOverride.findMany();
  const overrideIds = allOverrides.map(o => o.id);
  const orphanedByOverride = await prisma.attendance.findMany({
    where: {
      overrideId: { not: null, notIn: overrideIds }
    }
  });
  console.log('Orphaned by missing override:', orphanedByOverride.length);
  
  if (orphanedByOverride.length > 0) {
    console.log('Deleting...');
    await prisma.attendance.deleteMany({
      where: { id: { in: orphanedByOverride.map(o => o.id) } }
    });
  }
}
main().finally(() => prisma.$disconnect());
