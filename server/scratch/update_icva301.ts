import 'dotenv/config';
import { prisma } from '../src/lib/prisma';

async function updateSubject() {
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user found");
    return;
  }
  
  const updated = await prisma.subject.updateMany({
    where: { 
      userId: user.id,
      code: "ICVA301"
    },
    data: {
      name: "Professional Ethics"
    }
  });

  console.log(`Updated ${updated.count} subject(s).`);
}

updateSubject().catch(console.error).finally(() => prisma.$disconnect());
