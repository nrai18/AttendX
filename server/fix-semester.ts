import "dotenv/config";
import { prisma } from "./src/lib/prisma";

async function main() {
  const userId = "17f9cada-df50-4219-b2e6-d715b525b137";
  
  // Deactivate the empty one
  await prisma.semester.update({
    where: { id: "91a30893-4028-4d26-a487-856734d5c9fb" },
    data: { isActive: false }
  });
  
  // Activate the one with subjects
  await prisma.semester.update({
    where: { id: "dfa9bb15-f677-43b6-bc03-86d9c0334fd5" },
    data: { isActive: true }
  });
  
  console.log("Semester fixed!");
}

main().catch(console.error).finally(() => process.exit(0));
