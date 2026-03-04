// T027: Database connection pool module
import pg from 'pg';

const { Pool } = pg;

let pool = null;

const debugPool = process.env.DEBUG_POOL === 'true';

function parsePoolConfig() {
  return {
    min: parseInt(process.env.PG_POOL_MIN, 10) || 2,
    max: parseInt(process.env.PG_POOL_MAX, 10) || 20,
    idleTimeoutMillis: parseInt(process.env.PG_POOL_IDLE_TIMEOUT_MS, 10) || 30000,
    connectionTimeoutMillis: parseInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS, 10) || 5000,
  };
}

/**
 * Get or create the database connection pool
 * @returns {pg.Pool} PostgreSQL connection pool
 */
export function getPool() {
  if (!pool) {
    const databaseUrl = process.env.DATABASE_URL;

    if (!databaseUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }

    const poolConfig = parsePoolConfig();

    pool = new Pool({
      connectionString: databaseUrl,
      ...poolConfig,
    });

    if (debugPool) {
      console.log('Pool config:', poolConfig);
    }

    // Handle pool errors
    pool.on('error', (err) => {
      console.error('Unexpected error on idle database client', err);
      process.exit(-1);
    });

    // Log successful connection
    pool.query('SELECT NOW()', (err) => {
      if (err) {
        console.error('Failed to connect to database:', err.message);
        process.exit(-1);
      }
      console.log('Database connection pool established');
      if (debugPool) {
        console.log('Pool statistics:', {
          totalCount: pool.totalCount,
          idleCount: pool.idleCount,
          waitingCount: pool.waitingCount,
        });
      }
    });
  }

  return pool;
}

/**
 * Execute a query with the connection pool
 * @param {string} text - SQL query text
 * @param {Array} params - Query parameters
 * @returns {Promise<pg.QueryResult>} Query result
 */
export async function query(text, params) {
  const start = Date.now();
  const pool = getPool();

  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;

    // Log slow queries (> 100ms)
    if (duration > 100) {
      console.warn('Slow query detected:', {
        text,
        duration: `${duration}ms`,
        rows: result.rowCount,
      });
    }

    return result;
  } catch (error) {
    console.error('Database query error:', {
      text,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transactions
 * @returns {Promise<pg.PoolClient>} Database client
 */
export async function getClient() {
  const pool = getPool();
  return pool.connect();
}

/**
 * Close the database connection pool
 * @returns {Promise<void>}
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('Database connection pool closed');
  }
}

/**
 * Test database connection
 * @returns {Promise<boolean>} True if connection successful
 */
export async function testConnection() {
  try {
    const result = await query('SELECT NOW() as now, version() as version');
    console.log('Database connection test successful:', {
      time: result.rows[0].now,
      version: result.rows[0].version.split(' ')[0] + ' ' + result.rows[0].version.split(' ')[1],
    });
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error.message);
    return false;
  }
}
