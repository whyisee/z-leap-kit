import { closeDb, execute, queryOne } from "../src/server/db/client.ts";
import { getDatabaseLabel } from "../src/server/db/config.ts";
import { hashPassword } from "../src/lib/password.ts";
import { launchCategories, launchTags } from "./launch-taxonomy.ts";

const now = new Date().toISOString();

const admin = {
  username: process.env.WHYISEE_ADMIN_USERNAME || "whyisee",
  displayName: "whyisee",
  email: "admin@whyisee.xyz",
  password: process.env.WHYISEE_ADMIN_PASSWORD || "whyisee",
};
const adminPasswordHash = await hashPassword(admin.password);

await execute(
  `
  INSERT INTO users (username, display_name, email, password_hash, role, is_bot, status, bio, email_verified_at, created_at, updated_at)
  VALUES ($1, $2, $3, $4, 'admin', FALSE, 'active', 'whyisee.xyz 站长', $5, $5, $5)
  ON CONFLICT(username) DO UPDATE SET
    display_name = excluded.display_name,
    email = excluded.email,
    password_hash = excluded.password_hash,
    role = 'admin',
    is_bot = FALSE,
    status = 'active',
    email_verified_at = excluded.email_verified_at,
    updated_at = excluded.updated_at
  `,
  [admin.username, admin.displayName, admin.email, adminPasswordHash, now],
);

const botUsers = [
  ["ai", "AI 助手", "通用社区助手，可以总结讨论、整理观点和回答明确问题。"],
  ["seo", "SEO 助手", "帮助优化标题、摘要、关键词和标签。"],
  ["writer", "写作助手", "帮助扩写、润色、去 AI 味和整理表达。"],
  ["mod", "审核助手", "辅助管理员判断广告、低质内容和审核风险。"],
] as const;

for (const bot of botUsers) {
  await execute(
    `
    INSERT INTO users (username, display_name, email, password_hash, role, is_bot, status, bio, email_verified_at, created_at, updated_at)
    VALUES ($1, $2, NULL, NULL, 'member', TRUE, 'active', $3, $4, $4, $4)
    ON CONFLICT(username) DO UPDATE SET
      display_name = excluded.display_name,
      is_bot = TRUE,
      status = 'active',
      bio = excluded.bio,
      updated_at = excluded.updated_at
    `,
    [bot[0], bot[1], bot[2], now],
  );
}

for (const category of launchCategories) {
  await execute(
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
  await execute(
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

const adminId = (await queryOne<{ id: number }>("SELECT id FROM users WHERE username = $1", [admin.username]))?.id;

if (!adminId) {
  throw new Error(`Missing admin user: ${admin.username}`);
}

await execute(
  `
  INSERT INTO invitations (code, role, max_uses, use_count, created_by, created_at)
  VALUES ($1, 'member', 100, 0, $2, $3)
  ON CONFLICT(code) DO UPDATE SET
    role = excluded.role,
    max_uses = excluded.max_uses,
    disabled_at = NULL
  `,
  [process.env.WHYISEE_DEFAULT_INVITE_CODE || "whyisee-invite", adminId, now],
);

console.log(
  `Seed finished: ${getDatabaseLabel()} · categories=${launchCategories.length} · tags=${launchTags.length} · demoTopics=0`,
);

await closeDb();
