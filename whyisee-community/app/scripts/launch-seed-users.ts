import { closeDb, withTransaction } from "../src/server/db/client.ts";
import { getDatabaseLabel } from "../src/server/db/config.ts";
import { seedLaunchUsers } from "./launch-user-seeder.ts";

const result = await withTransaction((client) => seedLaunchUsers(client));

console.log(`Launch users seeded: ${getDatabaseLabel()} · users=${result.users}`);

await closeDb();
