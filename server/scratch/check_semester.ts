import { prisma } from '../src/lib/prisma';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  const users = await prisma.user.findMany();
  console.log("Users:", users.length);
  const semesters = await prisma.semester.findMany();
  console.log("Semesters:", semesters);
}
main().catch(console.error).finally(() => process.exit(0));
