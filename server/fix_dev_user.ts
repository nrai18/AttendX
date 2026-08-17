import 'dotenv/config';
import { prisma } from './src/lib/prisma';
import bcrypt from 'bcryptjs';

async function main() {
  const passwordHash = await bcrypt.hash("password", 10);
  
  const user = await prisma.user.findFirst({ where: { email: "dev@iiitu.ac.in" } });
  
  if (user) {
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });
    console.log("Successfully updated dev@iiitu.ac.in with password 'password'");
  } else {
    await prisma.user.create({
      data: {
        email: "dev@iiitu.ac.in",
        name: "Developer",
        role: "admin",
        passwordHash
      }
    });
    console.log("Successfully created dev@iiitu.ac.in with password 'password'");
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
