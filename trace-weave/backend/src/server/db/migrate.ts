import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config, quoteIdentifier } from "../config";
import { closePool, pool } from "./pool";

const schema = quoteIdentifier(config.DB_SCHEMA);

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS ${schema}.schema_migrations (
        version text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const migrationDirectory = resolve(process.cwd(), "migrations");
    const migrationFiles = (await readdir(migrationDirectory))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();

    for (const file of migrationFiles) {
      const sqlTemplate = await readFile(resolve(migrationDirectory, file), "utf8");
      const checksum = createHash("sha256").update(sqlTemplate).digest("hex");
      const existing = await client.query<{ checksum: string }>(
        `SELECT checksum FROM ${schema}.schema_migrations WHERE version = $1`,
        [file],
      );

      if (existing.rowCount) {
        if (existing.rows[0].checksum !== checksum) {
          throw new Error(`Migration ${file} changed after it was applied`);
        }

        continue;
      }

      const sql = sqlTemplate.replaceAll("{{schema}}", schema);
      await client.query("BEGIN");

      try {
        await client.query(sql);
        await client.query(
          `INSERT INTO ${schema}.schema_migrations (version, checksum) VALUES ($1, $2)`,
          [file, checksum],
        );
        await client.query("COMMIT");
        console.info(`Applied migration ${file}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }
  } finally {
    client.release();
  }
}

migrate()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);

