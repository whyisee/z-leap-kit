import { closeDb, withTransaction } from "../src/server/db/client.ts";
import { getDatabaseLabel } from "../src/server/db/config.ts";
import { seedLaunchContent } from "./launch-content-seeder.ts";
import { seedLaunchUsers } from "./launch-user-seeder.ts";

const result = await withTransaction(async (client) => {
  const users = await seedLaunchUsers(client);
  const content = await seedLaunchContent(client);

  return { users, content };
});

console.log(
  `Launch content seeded: ${getDatabaseLabel()} · users=${result.users.users} · topics=${result.content.topics} · replies=${result.content.replies} · pinned=${result.content.pinned} · featured=${result.content.featured}`,
);

await closeDb();
