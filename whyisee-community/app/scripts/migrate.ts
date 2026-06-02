import { closeDb, getDb, getDatabasePath } from "../src/server/db/client.ts";
import { schemaSql } from "../src/server/db/schema.ts";

const db = getDb();

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(schemaSql);

console.log(`Migration finished: ${getDatabasePath()}`);

closeDb();
