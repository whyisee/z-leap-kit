import { closeDb, withTransaction } from "../src/server/db/client.ts";
import { getDatabaseLabel } from "../src/server/db/config.ts";
import { seedLaunchInteractions } from "./launch-interaction-seeder.ts";

const result = await withTransaction((client) => seedLaunchInteractions(client));

console.log(
  `Launch interactions seeded: ${getDatabaseLabel()} · topicLikes=${result.topicLikes} · postLikes=${result.postLikes} · bookmarks=${result.bookmarks} · follows=${result.follows} · pageViews=${result.pageViews}`,
);

await closeDb();
