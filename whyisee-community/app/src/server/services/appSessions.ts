import { execute, queryOne } from "@server/db/client";
import {
  appSessionMaxAgeSeconds,
  createUserSession,
  type AuthSession,
  type SessionClient,
} from "@lib/auth";

interface SessionOwnerRow {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  email: string | null;
  role: AuthSession["role"];
  status: AuthSession["status"];
}

export interface AppSessionRequest {
  clientVersion?: string | null;
}

/**
 * 轮换 app token：吊销旧的、发新的。
 *
 * 并发安全靠 UPDATE ... WHERE revoked_at IS NULL RETURNING 这条原子语句：
 * 同一 token 并发刷新时只有一个请求能拿到 RETURNING 行，其余按失效处理。
 * 这里刻意不用事务包住后续 INSERT —— 中途失败只会让用户重登一次，
 * 而"旧 token 已被吊销、新 token 没发出来"是安全的一侧。
 */
export async function rotateAppSession(sessionId: string, input: AppSessionRequest = {}) {
  const now = new Date().toISOString();

  const revoked = await queryOne<{ user_id: number; client: string }>(
    `
    UPDATE sessions
    SET revoked_at = $1
    WHERE id = $2 AND revoked_at IS NULL AND expires_at > $1
    RETURNING user_id, client
    `,
    [now, sessionId],
  );

  if (!revoked) return undefined;

  const user = await queryOne<SessionOwnerRow>(
    `
    SELECT id, username, display_name, avatar_url, email, role, status
    FROM users WHERE id = $1 LIMIT 1
    `,
    [revoked.user_id],
  );

  if (!user || user.status !== "active") return undefined;

  return createUserSession(user, {
    client: (revoked.client as SessionClient) || "app",
    clientVersion: input.clientVersion ?? null,
    ttlSeconds: appSessionMaxAgeSeconds,
  });
}

/** 网页 cookie 登录成功后，把这条会话标记成 app 会话并延长到 90 天 */
export async function promoteSessionToApp(sessionId: string, input: AppSessionRequest = {}) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + appSessionMaxAgeSeconds * 1000).toISOString();

  const updated = await queryOne<{ id: string }>(
    `
    UPDATE sessions
    SET client = 'app',
        client_version = COALESCE($3, client_version),
        expires_at = $2
    WHERE id = $1 AND revoked_at IS NULL AND expires_at > $4
    RETURNING id
    `,
    [sessionId, expiresAt, input.clientVersion ?? null, now.toISOString()],
  );

  return updated ? expiresAt : undefined;
}

/** 退出所有 app 会话（以后设置页要用） */
export async function revokeAllAppSessions(userId: number) {
  await execute("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND client = 'app' AND revoked_at IS NULL", [
    new Date().toISOString(),
    userId,
  ]);
}
