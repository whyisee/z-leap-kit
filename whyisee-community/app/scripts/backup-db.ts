import { mkdirSync } from "node:fs";
import path from "node:path";
import { getDb, getDatabasePath, closeDb } from "../src/server/db/client.ts";

const db = getDb();
const source = getDatabasePath();
const backupDir = process.env.WHYISEE_BACKUP_DIR || path.resolve(process.cwd(), "backups");
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const target = path.join(backupDir, `whyisee-${stamp}.sqlite`);

mkdirSync(backupDir, { recursive: true });
await db.backup(target);

console.log(`Backup finished: ${source} -> ${target}`);

closeDb();
