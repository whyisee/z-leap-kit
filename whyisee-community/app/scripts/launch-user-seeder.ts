import type { PoolClient } from "pg";
import { launchUsers } from "./launch-users.ts";

export interface LaunchUserSeedResult {
  users: number;
}

export async function seedLaunchUsers(client: PoolClient, options: { now?: string } = {}): Promise<LaunchUserSeedResult> {
  const now = options.now || new Date().toISOString();

  for (const user of launchUsers) {
    await client.query(
      `
      INSERT INTO users (
        username, display_name, email, password_hash, avatar_url, role, is_bot, status,
        bio, website_url, github_url, email_verified_at, locale, timezone, created_at, updated_at
      )
      VALUES ($1, $2, NULL, NULL, $3, 'member', FALSE, 'active', $4, NULL, NULL, NULL, 'zh', 'Asia/Shanghai', $5, $5)
      ON CONFLICT(username) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        avatar_url = EXCLUDED.avatar_url,
        role = CASE WHEN users.role IN ('admin', 'moderator') THEN users.role ELSE 'member' END,
        is_bot = FALSE,
        status = 'active',
        bio = EXCLUDED.bio,
        locale = COALESCE(NULLIF(users.locale, ''), 'zh'),
        timezone = COALESCE(NULLIF(users.timezone, ''), 'Asia/Shanghai'),
        updated_at = EXCLUDED.updated_at
      `,
      [user.username, user.displayName, user.avatarUrl, user.bio, now],
    );
  }

  return { users: launchUsers.length };
}
