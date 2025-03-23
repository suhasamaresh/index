// lib/db-validator.ts
import { Pool } from 'pg';

export async function validatePgConnection(creds: {
  host: string;
  user: string;
  password: string;
  database: string;
}) {
  const pool = new Pool(creds);
  try {
    const res = await pool.query('SELECT NOW()');
    return { success: true, timestamp: res.rows[0].now };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  } finally {
    await pool.end();
  }
}