import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const activeSem = await prisma.semester.findFirst({ where: { isActive: true } });
  if (!activeSem) return console.log("No active semester");
  console.log("activeSem userId:", activeSem.userId);

  const atts = await prisma.attendance.findMany({ 
    where: { date: { gte: new Date('2026-08-15'), lte: new Date('2026-08-25') } },
    orderBy: { createdAt: 'desc' } 
  });
  if (atts.length > 0) {
    console.log("First attendance userId:", atts[0].userId);
  } else {
    console.log("No attendances found at all");
  }

  const slotsSun = await prisma.timetableSlot.findMany({ where: { dayOfWeek: 6 } });
  console.log("Sun slots:", slotsSun.length);
  
  const userId = '17f9cada-df50-4219-b2e6-d715b525b137';
  
  // mock req and res
  const req = { query: { month: '2026-08' }, user: { userId } } as any;
  let jsonResponse = null;
  const res = { 
    status: function(code: number) { return this; },
    json: function(data: any) { jsonResponse = data; return this; }
  } as any;
  
  const { AttendanceController } = require('./src/controllers/attendance.controller');
  await AttendanceController.getMonthlyCalendar(req, res);
  
  require('fs').writeFileSync('calendar_dump.json', JSON.stringify(jsonResponse, null, 2));
  console.log("Dumped to calendar_dump.json");
}

main().catch(console.error);
