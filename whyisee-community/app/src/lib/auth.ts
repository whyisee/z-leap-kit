import type { APIContext } from "astro";
import { randomBytes } from "node:crypto";
import { queryOne, execute } from "@server/db/client";
import { verifyPassword } from "@lib/password";

export const authCookieName = "whyisee_session";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export interface AuthSession {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  role: "admin" | "moderator" | "member" | "new_user";
  status: "active" | "pending" | "suspended" | "banned";
  sessionId: string;
}

export function getSessionMaxAgeSeconds() {
  return sessionMaxAgeSeconds;
}

export function getAuthCookieOptions(defaultSecure: boolean) {
  return {
    httpOnly: true,
    maxAge: getSessionMaxAgeSeconds(),
    path: "/",
    sameSite: "lax" as const,
    secure: shouldUseSecureAuthCookie(defaultSecure),
  };
}

export function shouldUseSecureAuthCookie(defaultSecure: boolean) {
  const value = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();

  if (value === "0" || value === "false" || value === "no") {
    return false;
  }

  if (value === "1" || value === "true" || value === "yes") {
    return true;
  }

  return defaultSecure;
}

export async function authenticateUser(identifier: string, password: string): Promise<AuthSession | undefined> {
  const user = await queryOne<UserAuthRow>(
    `
    SELECT id, username, display_name, avatar_url, email, role, status, password_hash
    FROM users
    WHERE lower(username) = lower($1) OR lower(email) = lower($1)
    LIMIT 1
    `,
    [identifier.trim()],
  );

  if (!user || user.status !== "active") {
    return undefined;
  }

  const valid = await verifyPassword(password, user.password_hash);

  if (!valid) {
    return undefined;
  }

  await execute("UPDATE users SET last_login_at = $1, last_seen_at = $1 WHERE id = $2", [new Date().toISOString(), user.id]);

  return createUserSession(user);
}

export async function createUserSession(user: UserSessionSource): Promise<AuthSession> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + sessionMaxAgeSeconds * 1000).toISOString();
  const sessionId = randomBytes(32).toString("base64url");

  await execute(
    `
    INSERT INTO sessions (id, user_id, expires_at, created_at, last_seen_at)
    VALUES ($1, $2, $3, $4, $4)
    `,
    [sessionId, user.id, expiresAt, now.toISOString()],
  );

  return mapSession(user, sessionId);
}

export async function getSessionFromAstro(astro: Pick<APIContext, "cookies">): Promise<AuthSession | undefined> {
  return readSessionId(astro.cookies.get(authCookieName)?.value);
}

export async function readSessionId(sessionId: string | undefined): Promise<AuthSession | undefined> {
  if (!sessionId) {
    return undefined;
  }

  const row = await queryOne<UserSessionRow>(
    `
    SELECT
      sessions.id AS session_id,
      users.id,
      users.username,
      users.display_name,
      users.avatar_url,
      users.email,
      users.role,
      users.status
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = $1
      AND sessions.revoked_at IS NULL
      AND sessions.expires_at > $2
      AND users.status = 'active'
    LIMIT 1
    `,
    [sessionId, new Date().toISOString()],
  );

  if (!row) {
    return undefined;
  }

  await execute("UPDATE sessions SET last_seen_at = $1 WHERE id = $2", [new Date().toISOString(), sessionId]);

  return mapSession(row, row.session_id);
}

export async function revokeSession(sessionId: string | undefined) {
  if (!sessionId) {
    return;
  }

  await execute("UPDATE sessions SET revoked_at = $1 WHERE id = $2", [new Date().toISOString(), sessionId]);
}

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback = "/") {
  const target = String(value || fallback);

  if (!target.startsWith("/") || target.startsWith("//")) {
    return fallback;
  }

  return target;
}

export function isAdmin(session: AuthSession | undefined) {
  return session?.role === "admin";
}

function mapSession(user: UserSessionSource, sessionId: string): AuthSession {
  return {
    userId: user.id,
    username: user.username,
    displayName: user.display_name,
    email: user.email,
    avatarUrl: user.avatar_url ?? null,
    role: user.role,
    status: user.status,
    sessionId,
  };
}

interface UserSessionSource {
  id: number;
  username: string;
  display_name: string;
  avatar_url?: string | null;
  email: string | null;
  role: AuthSession["role"];
  status: AuthSession["status"];
}

interface UserAuthRow extends UserSessionSource {
  password_hash: string | null;
}

interface UserSessionRow extends UserSessionSource {
  session_id: string;
}
