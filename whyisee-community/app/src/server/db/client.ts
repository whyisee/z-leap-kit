import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

let db: Database.Database | undefined;

export function getDatabasePath() {
  return process.env.WHYISEE_DB_PATH || path.resolve(process.cwd(), "data/whyisee.sqlite");
}

export function getDb() {
  if (!db) {
    const databasePath = getDatabasePath();
    mkdirSync(path.dirname(databasePath), { recursive: true });
    db = new Database(databasePath);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
  }

  return db;
}

export function closeDb() {
  db?.close();
  db = undefined;
}
