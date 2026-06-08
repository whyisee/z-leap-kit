import { closeDb, withTransaction } from "../src/server/db/client.ts";
import { getDatabaseLabel } from "../src/server/db/config.ts";
import { seedLaunchContent } from "./launch-content-seeder.ts";
import { seedLaunchInteractions } from "./launch-interaction-seeder.ts";
import { seedLaunchUsers } from "./launch-user-seeder.ts";
import { launchCategories, launchTags } from "./launch-taxonomy.ts";

const now = new Date().toISOString();

const result = await withTransaction(async (client) => {
  const cleanupStatements = [
    "DELETE FROM content_run_items",
    "DELETE FROM content_runs",
    "DELETE FROM content_review_results",
    "DELETE FROM bot_jobs",
    "DELETE FROM bot_task_runs",
    "UPDATE bot_tasks SET locked_at = NULL, last_run_at = NULL, last_status = NULL, next_run_at = $1",
    "DELETE FROM notifications",
    "DELETE FROM mentions",
    "DELETE FROM reports",
    "DELETE FROM email_logs",
    "DELETE FROM page_views",
    "DELETE FROM user_contribution_events",
    "DELETE FROM user_reputation",
    "DELETE FROM uploaded_files",
    "DELETE FROM reactions",
    "DELETE FROM bookmarks",
    "DELETE FROM follows",
    "DELETE FROM user_blocks",
    "DELETE FROM topic_tags",
    "DELETE FROM posts",
    "DELETE FROM topics",
    "DELETE FROM tags",
    "DELETE FROM categories",
  ];

  for (const statement of cleanupStatements) {
    await client.query(statement, statement.includes("$1") ? [now] : []);
  }

  for (const category of launchCategories) {
    await client.query(
      `
      INSERT INTO categories (name, slug, description, color, sort_order, is_public, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, TRUE, $6, $6)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        color = excluded.color,
        sort_order = excluded.sort_order,
        is_public = TRUE,
        updated_at = excluded.updated_at
      `,
      [category.name, category.slug, category.description, category.color, category.sortOrder, now],
    );
  }

  for (const tag of launchTags) {
    await client.query(
      `
      INSERT INTO tags (name, slug, description, created_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT(slug) DO UPDATE SET
        name = excluded.name,
        description = excluded.description
      `,
      [tag.name, tag.slug, tag.description, now],
    );
  }

  const users = await seedLaunchUsers(client, { now });
  const content = await seedLaunchContent(client, { now });
  const interactions = await seedLaunchInteractions(client, { now });

  return { users, content, interactions };
});

console.log(
  `Launch reset finished: ${getDatabaseLabel()} · users=${result.users.users} · categories=${launchCategories.length} · tags=${launchTags.length} · topics=${result.content.topics} · replies=${result.content.replies} · topicLikes=${result.interactions.topicLikes} · bookmarks=${result.interactions.bookmarks} · follows=${result.interactions.follows} · pageViews=${result.interactions.pageViews}`,
);

await closeDb();
