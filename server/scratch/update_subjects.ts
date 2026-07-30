import { config } from 'dotenv';
config(); // load .env file

import { prisma } from '../src/lib/prisma';
import { SUBJECT_DICTIONARY } from '../src/utils/subjectDictionary';

async function main() {
  const subjects = await prisma.subject.findMany();
  let updatedCount = 0;

  for (const subject of subjects) {
    if (subject.code) {
      // Handle the fact that some subjects might have a '_LAB' suffix in code
      const baseCode = subject.code.replace('_LAB', '');
      const dictInfo = SUBJECT_DICTIONARY[baseCode];
      
      if (dictInfo) {
        let expectedName = dictInfo.title;
        if (subject.code.endsWith('_LAB')) {
          expectedName = `${dictInfo.title} Lab`;
        }

        const expectedCredits = dictInfo.credits || subject.credits;

        if (subject.name !== expectedName || subject.credits !== expectedCredits) {
          console.log(`Updating subject ${subject.code}: ${subject.name} -> ${expectedName}`);
          await prisma.subject.update({
            where: { id: subject.id },
            data: { 
              name: expectedName,
              credits: expectedCredits
            }
          });
          updatedCount++;
        }
      }
    }
  }
  console.log(`Successfully updated ${updatedCount} subjects.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
