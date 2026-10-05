import 'dotenv/config';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { prisma } from './src/lib/prisma.ts';

async function main() {
  let title = '';
  let body = '';
  let imageUrl = undefined;
  let route = undefined;
  let target = undefined;

  for (let i = 2; i < process.argv.length; i++) {
    if (process.argv[i] === '--image') {
      imageUrl = process.argv[++i];
    } else if (process.argv[i] === '--route') {
      route = process.argv[++i];
    } else if (process.argv[i] === '--target') {
      target = process.argv[++i];
    } else if (!title) {
      title = process.argv[i];
    } else if (!body) {
      body = process.argv[i];
    }
  }

  if (!title || !body) {
    console.error("Usage: npx tsx broadcast.ts \"<Title>\" \"<Body>\" [--image <url>] [--route <path>] [--target <condition>]");
    process.exit(1);
  }

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

  let userCondition: any = {};
  if (target === 'has-birthday') userCondition = { birthday: { not: null } };
  else if (target === 'no-birthday') userCondition = { birthday: null };
  else if (target === 'has-password') userCondition = { passwordHash: { not: null } };
  else if (target === 'no-password') userCondition = { passwordHash: null };

  const sessions = await prisma.refreshToken.findMany({
    where: { 
      fcmToken: { not: null },
      ...(target ? { user: userCondition } : {})
    },
    select: { fcmToken: true }
  });

  const rawTokens = sessions.map(s => s.fcmToken as string).filter(t => t.trim() !== '');
  const tokens = Array.from(new Set(rawTokens));

  if (tokens.length === 0) {
    console.log(`No users found matching target condition.`);
    process.exit(0);
  }

  console.log(`Broadcasting to ${tokens.length} devices...`);

  const BATCH_SIZE = 500;
  let successCount = 0;
  let failureCount = 0;

  for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
    const batch = tokens.slice(i, i + BATCH_SIZE);
    
    const payload: any = {
      tokens: batch,
      notification: { title, body },
      android: { notification: {} },
      apns: { payload: { aps: { mutableContent: 1 } }, fcmOptions: {} },
      data: {}
    };

    if (imageUrl) {
      payload.notification.imageUrl = imageUrl;
      payload.android.notification.imageUrl = imageUrl;
      payload.apns.fcmOptions.imageUrl = imageUrl;
    }
    if (route) payload.data.route = route;

    const response = await getMessaging().sendEachForMulticast(payload);
    
    successCount += response.successCount;
    failureCount += response.failureCount;
  }

  console.log(`\n🎉 Broadcast complete! Success: ${successCount}`);
  process.exit(0);
}

main();
