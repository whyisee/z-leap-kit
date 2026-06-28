import pg from "pg";
import { env } from "./env";

export const pool = new pg.Pool({
  host: env.dbHost,
  port: env.dbPort,
  database: env.dbName,
  user: env.dbUser,
  password: env.dbPassword,
  max: 8,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export function q(name: string) {
  return `"${env.dbSchema}"."${name}"`;
}

export async function withTransaction<T>(handler: (client: pg.PoolClient) => Promise<T>) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`set local search_path to "${env.dbSchema}"`);
    const result = await handler(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}
