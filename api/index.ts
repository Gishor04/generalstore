import { initDB } from '../server/db.js';
import app from '../server.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

// Cache the DB init promise so it only runs once per cold start
let dbInitPromise: Promise<void> | null = null;

function getDbInitPromise() {
  if (!dbInitPromise) {
    dbInitPromise = initDB().catch((err) => {
      // Reset so next request retries
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    await getDbInitPromise();
  } catch (err: any) {
    console.error('DB initialization failed:', err.message);
    res.status(500).json({
      error: 'Database connection failed',
      message: err.message,
    });
    return;
  }

  // Let Express handle the request
  return new Promise((resolve) => {
    app(req as any, res as any, () => resolve(undefined));
  });
}
