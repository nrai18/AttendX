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
    } else {
      console.warn('[Firebase] Warning: firebase-admin.json not found and FIREBASE_ADMIN_JSON env var not set. Push notifications disabled.');
    }
  }
} catch (error) {
  console.error('[Firebase] Failed to initialize Admin SDK:', error);
}

export const isFirebaseInitialized = getApps().length > 0;
