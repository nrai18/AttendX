import { initializeApp, cert, getApps } from 'firebase-admin/app';
import path from 'path';
import fs from 'fs';

// Initialize Firebase Admin SDK
try {
  const serviceAccountPath = path.resolve(process.cwd(), 'firebase-admin.json');
  
  if (getApps().length === 0) {
    if (process.env.FIREBASE_ADMIN_JSON) {
      // 1. Support Render Environment Variable (Raw JSON string)
      const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_JSON);
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[Firebase] Admin SDK initialized from FIREBASE_ADMIN_JSON environment variable.');
    } else if (fs.existsSync(serviceAccountPath)) {
      // 2. Support Local File (or Render Secret File)
      const serviceAccount = require(serviceAccountPath);
      initializeApp({
        credential: cert(serviceAccount)
      });
      console.log('[Firebase] Admin SDK initialized successfully from firebase-admin.json file.');
    } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      // 3. Support Granular Env Vars (Local/Vercel standard fallback)
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
        })
      });
      console.log('[Firebase] Admin SDK initialized from granular FIREBASE_* environment variables.');
    } else {
      console.warn('[Firebase] Warning: No Firebase credentials found (JSON or granular vars). Push notifications disabled.');
    }
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Admin SDK:', error);
}

export const isFirebaseInitialized = getApps().length > 0;
