// T028: Database migration runner script
import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getPool, closePool } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

// Advisory lock key for migrations (arbitrary unique number)
const MIGRATION_LOCK_KEY = 123456789;

/**
 * Create migrations tracking table if it doesn't exist
 */
async function createMigrationsTable() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    )
  `);

  console.log('Migrations tracking table ready');
}

/**
 * Get list of applied migrations
 * @returns {Promise<string[]>} Array of applied migration versions
 */
async function getAppliedMigrations() {
  const pool = getPool();

  const result = await pool.query(
    'SELECT version FROM schema_migrations ORDER BY version'
  );

  return result.rows.map((row) => row.version);
}

/**
 * Get list of migration files from migrations directory
 * @returns {Promise<string[]>} Array of migration file names
 */
async function getMigrationFiles() {
  try {
    const files = await fs.readdir(MIGRATIONS_DIR);
    return files
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.warn('Migrations directory not found:', MIGRATIONS_DIR);
      return [];
    }
    throw error;
  }
}

/**
 * Apply a single migration
 * @param {string} filename - Migration file name
 */
async function applyMigration(filename) {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const migrationPath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(migrationPath, 'utf8');

    console.log(`Applying migration: ${filename}`);

    // Execute migration SQL
    await client.query(sql);

    // Record migration as applied
    const version = filename.replace('.sql', '');
    await client.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [version]
    );

    await client.query('COMMIT');

    console.log(`Migration applied successfully: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Failed to apply migration: ${filename}`, error.message);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations (without closing pool - for use during server startup)
 * Uses PostgreSQL advisory lock to prevent race conditions with concurrent processes
 * @returns {Promise<void>}
 */
export async function runPendingMigrations() {
  const pool = getPool();
  const client = await pool.connect();

  try {
    // Try to acquire advisory lock (non-blocking)
    const lockResult = await client.query(
      'SELECT pg_try_advisory_lock($1) as acquired',
      [MIGRATION_LOCK_KEY]
    );

    const lockAcquired = lockResult.rows[0].acquired;

    if (!lockAcquired) {
      console.log('Another process is running migrations, skipping...');
      return;
    }

    try {
      console.log('Checking database schema...');

      await createMigrationsTable();

      const appliedMigrations = await getAppliedMigrations();
      const migrationFiles = await getMigrationFiles();

      const pendingMigrations = migrationFiles.filter(
        (file) => !appliedMigrations.includes(file.replace('.sql', ''))
      );

      if (pendingMigrations.length === 0) {
        console.log('Database schema is up to date.');
        return;
      }

      console.log(`Applying ${pendingMigrations.length} pending migration(s)...`);

      for (const migration of pendingMigrations) {
        await applyMigration(migration);
      }

      console.log('Database migrations completed successfully');
    } finally {
      // Release advisory lock
      await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_KEY]);
    }
  } finally {
    client.release();
  }
}

/**
 * Run all pending migrations (CLI version - closes pool when done)
 */
async function runMigrations() {
  try {
    await runPendingMigrations();
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

/**
 * Check migration status
 */
async function checkStatus() {
  try {
    await createMigrationsTable();

    const appliedMigrations = await getAppliedMigrations();
    const migrationFiles = await getMigrationFiles();

    console.log('\n=== Migration Status ===\n');
    console.log(`Total migration files: ${migrationFiles.length}`);
    console.log(`Applied migrations: ${appliedMigrations.length}`);

    const pendingMigrations = migrationFiles.filter(
      (file) => !appliedMigrations.includes(file.replace('.sql', ''))
    );

    if (pendingMigrations.length > 0) {
      console.log(`\nPending migrations (${pendingMigrations.length}):`);
      pendingMigrations.forEach((file) => console.log(`  - ${file}`));
    } else {
      console.log('\nAll migrations are up to date ✓');
    }

    console.log('\nApplied migrations:');
    appliedMigrations.forEach((version) => console.log(`  ✓ ${version}`));
  } catch (error) {
    console.error('Failed to check migration status:', error.message);
    process.exit(1);
  } finally {
    await closePool();
  }
}

// CLI interface - only run when this file is executed directly
const isMainModule = process.argv[1]?.endsWith('migrate.js');

if (isMainModule) {
  const command = process.argv[2];

  if (command === 'status') {
    checkStatus();
  } else if (!command || command === 'run') {
    runMigrations();
  } else {
    console.error('Unknown command. Usage: node migrate.js [run|status]');
    process.exit(1);
  }
}
