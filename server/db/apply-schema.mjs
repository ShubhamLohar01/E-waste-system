/**
 * Apply server/db/schema.sql to the database (idempotent — create-if-not-exists).
 * Use this to add new tables without re-running the JSON data migration.
 *
 * Run from project root:  node server/db/apply-schema.mjs
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function main() {
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'));
    console.log('✅ schema.sql applied');
  } catch (e) {
    console.error('❌ apply-schema failed:', e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main();
