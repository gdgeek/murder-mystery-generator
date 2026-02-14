/**
 * Auto-migration runner.
 * Tracks executed migrations in a `_migrations` table and runs pending ones on startup.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { pool } from './mysql';

const MIGRATIONS_DIR = resolve(__dirname, 'migrations');

export async function runMigrations(): Promise<void> {
  const conn = await pool.getConnection();
  try {
    // Ensure migrations tracking table exists
    await conn.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get already-executed migrations
    const [rows] = await conn.query('SELECT name FROM _migrations ORDER BY name');
    const executed = new Set((rows as Array<{ name: string }>).map(r => r.name));

    // Read migration files sorted by name
    const files = readdirSync(MIGRATIONS_DIR)
      .filter(f => f.endsWith('.sql'))
      .sort();

    let count = 0;
    for (const file of files) {
      if (executed.has(file)) continue;

      const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf-8');
      console.log(`[migrator] Running ${file}...`);

      // Split by semicolons to handle multi-statement migrations
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of statements) {
        await conn.query(stmt);
      }

      await conn.query('INSERT INTO _migrations (name) VALUES (?)', [file]);
      count++;
      console.log(`[migrator] ✓ ${file}`);
    }

    if (count === 0) {
      console.log('[migrator] All migrations up to date.');
    } else {
      console.log(`[migrator] Ran ${count} migration(s).`);
    }
  } finally {
    conn.release();
  }
}
