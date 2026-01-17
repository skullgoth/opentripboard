import { getPool, closePool } from './connection.js';

async function markMigrationApplied() {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query(
      "INSERT INTO schema_migrations (version) VALUES ($1) ON CONFLICT DO NOTHING",
      ['001_initial_schema']
    );
    console.log('Marked 001_initial_schema as applied');
  } catch (error) {
    console.error('Error marking migration:', error);
  } finally {
    client.release();
    await closePool();
  }
}

markMigrationApplied();
