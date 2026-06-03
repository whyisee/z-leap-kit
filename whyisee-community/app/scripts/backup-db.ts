import { mkdirSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { getDatabaseConfig } from "../src/server/db/config.ts";

const config = getDatabaseConfig();
const backupDir = process.env.WHYISEE_BACKUP_DIR || path.resolve(process.cwd(), "backups");
const pgDumpBin = process.env.PG_DUMP_BIN || "pg_dump";
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `whyisee-${stamp}.sql`);

mkdirSync(backupDir, { recursive: true });

const result = spawnSync(
  pgDumpBin,
  [
    "--host",
    config.host,
    "--port",
    String(config.port),
    "--username",
    config.user,
    "--dbname",
    config.database,
    "--schema",
    config.schema,
    "--file",
    target,
    "--format",
    "plain",
    "--no-owner",
  ],
  {
    env: {
      ...process.env,
      PGPASSWORD: config.password,
    },
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  throw new Error(`${pgDumpBin} failed with exit code ${result.status ?? "unknown"}`);
}

console.log(`Backup finished: ${config.host}:${config.port}/${config.database}.${config.schema} -> ${target}`);
