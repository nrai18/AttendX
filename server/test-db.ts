import "dotenv/config";
import { prisma } from "./src/lib/prisma";

async function main() {
  const u = await prisma.user.findFirst({where: {email: 'dev@iiitu.ac.in'}, include: {semesters: {include: {subjects: true}}}});
  console.log("Dev user:", JSON.stringify(u, null, 2));
}

main().catch(console.error).finally(() => process.exit(0));
