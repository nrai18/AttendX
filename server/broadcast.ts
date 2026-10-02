import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import dotenv from 'dotenv';
import { prisma } from './src/lib/prisma.ts';

dotenv.config();

async function main() {
  const title = process.argv[2];
  const body = process.argv[3];

  if (!title || !body) {
    console.error("Usage: npx tsx broadcast.ts \"<Title>\" \"<Body>\"");
    process.exit(1);
  }

  // Uses your local .env production keys
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  if (!privateKey) {
    console.error("Missing FIREBASE_PRIVATE_KEY in .env");
    process.exit(1);
  }

  if (getApps().length === 0) {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
  }

  console.log('Fetching active sessions from production DB...');
  const sessions = await prisma.refreshToken.findMany({
    where: { fcmToken: { not: null } },
    select: { fcmToken: true }
  });

  const rawTokens = sessions.map(s => s.fcmToken as string).filter(t => t.trim() !== '');
  const tokens = Array.from(new Set(rawTokens));

  if (tokens.length === 0) {
    console.log("No users with FCM tokens found.");
    process.exit(0);
  }

  console.log(`Broadcasting to ${tokens.length} devices...`);

  const BATCH_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    const response = await getMessaging().sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
    });
    
    successCount += response.successCount;
    failureCount += response.failureCount;

    const failedTokens: string[] = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success && resp.error) {
        if (resp.error.code === 'messaging/invalid-registration-token' || resp.error.code === 'messaging/registration-token-not-registered') {
          failedTokens.push(batch[idx]);
        }
      }
    });

    if (failedTokens.length > 0) {
      await prisma.refreshToken.updateMany({
        where: { fcmToken: { in: failedTokens } },
        data: { fcmToken: null }
      });
      console.log(`Cleaned ${failedTokens.length} dead FCM tokens from the database.`);
    }
  }

  console.log(`\n✅ Broadcast complete!`);
  console.log(`Success: ${successCount}`);
  console.log(`Failed (dead tokens): ${failureCount}`);
  process.exit(0);
}

main();
