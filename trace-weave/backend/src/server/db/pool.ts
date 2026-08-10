import pg from "pg";
import { config } from "../config";

const { Pool } = pg;

export const pool = new Pool({
  host: config.DB_HOST,
  port: config.DB_PORT,
  database: config.DB_NAME,
  user: config.DB_USER,
  password: config.DB_PASSWORD,
  max: config.DB_POOL_MAX,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 30_000,
  options: `-c search_path=${config.DB_SCHEMA},public`,
});

pool.on("error", (error) => {
  console.error("Unexpected PostgreSQL pool error", error);
});

export async function closePool(): Promise<void> {
  await pool.end();
}

