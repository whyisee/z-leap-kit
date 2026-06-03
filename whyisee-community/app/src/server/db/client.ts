import pg from "pg";
import type { Pool as PoolType, PoolClient, QueryResultRow } from "pg";
import { getDatabaseConfig, getDbSchema, getSafeIdentifier, quoteIdentifier } from "./config.ts";

const { Pool } = pg;

let pool: PoolType | undefined;

export function getPool() {
  if (!pool) {
    const config = getDatabaseConfig();
    const schema = getSafeIdentifier(config.schema);

    pool = new Pool({
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      options: `-c search_path=${schema},public`,
    });
  }

  return pool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  const result = await getPool().query<T>(sql, values);
  return result.rows;
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(sql: string, values: unknown[] = []) {
  const rows = await query<T>(sql, values);
  return rows[0];
}

export async function execute(sql: string, values: unknown[] = []) {
  await getPool().query(sql, values);
}

export async function withTransaction<T>(handler: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect();

  try {
    await client.query("BEGIN");
    const result = await handler(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function ensureSchema() {
  const schema = quoteIdentifier(getDbSchema());
  await getPool().query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
}

export async function closeDb() {
  await pool?.end();
  pool = undefined;
}
