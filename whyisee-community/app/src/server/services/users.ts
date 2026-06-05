import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "@lib/password";
import type { AuthSession } from "@lib/auth";
import { createUserSession } from "@lib/auth";
import { query, queryOne, withTransaction } from "@server/db/client";
import type { Topic } from "@lib/types";
import { listTopics } from "./topics";

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: AuthSession["role"];
  status: AuthSession["status"];
  bio: string;
  websiteUrl: string | null;
  githubUrl: string | null;
  locale: string;
  createdAt: string;
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  email: string | null;
  role: AuthSession["role"];
  status: AuthSession["status"];
  bio: string;
  website_url: string | null;
  github_url: string | null;
  locale: string;
  created_at: string;
}

export async function getUserById(id: number): Promise<PublicUser | undefined> {
  const row = await queryOne<UserRow>(userSelectSql + " WHERE id = $1 LIMIT 1", [id]);
  return row ? mapUser(row) : undefined;
}

export async function getUserByUsername(username: string): Promise<PublicUser | undefined> {
  const row = await queryOne<UserRow>(userSelectSql + " WHERE lower(username) = lower($1) LIMIT 1", [username]);
  return row ? mapUser(row) : undefined;
}

export async function listUserTopics(
  userId: number,
  lang?: import("@lib/i18n").Lang,
  includeDrafts = false,
): Promise<Topic[]> {
  return listTopics({ authorId: userId, limit: 50, lang, includeDrafts });
}

export async function createUserWithInvitation(input: {
  username: string;
  email: string;
  password: string;
  inviteCode: string;
}) {
  const username = normalizeUsername(input.username);
  const email = input.email.trim().toLowerCase();
  const inviteCode = input.inviteCode.trim();

  if (!username || username.length < 3) {
    throw new Error("Username must be at least 3 characters.");
  }

  if (!email.includes("@")) {
    throw new Error("Email is required.");
  }

  if (input.password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!inviteCode) {
    throw new Error("Invitation code is required.");
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (client) => {
    const invitation = await client.query<{
      id: number;
      email: string | null;
      role: AuthSession["role"];
      max_uses: number;
      use_count: number;
      expires_at: string | null;
      disabled_at: string | null;
    }>(
      `
      SELECT id, email, role, max_uses, use_count, expires_at, disabled_at
      FROM invitations
      WHERE code = $1
      LIMIT 1
      FOR UPDATE
      `,
      [inviteCode],
    );
    const invite = invitation.rows[0];

    if (!invite || invite.disabled_at || invite.use_count >= invite.max_uses || (invite.expires_at && invite.expires_at < now)) {
      throw new Error("Invalid invitation code.");
    }

    if (invite.email && invite.email.toLowerCase() !== email) {
      throw new Error("Invalid invitation email.");
    }

    const result = await client.query<{
      id: number;
      username: string;
      display_name: string;
      email: string | null;
      role: AuthSession["role"];
      status: AuthSession["status"];
    }>(
      `
      INSERT INTO users (
        username, display_name, email, password_hash, role, status, bio,
        email_verified_at, locale, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, 'active', '', $6, 'zh', $6, $6)
      RETURNING id, username, display_name, email, role, status
      `,
      [username, username, email, passwordHash, invite.role, now],
    );

    await client.query("UPDATE invitations SET use_count = use_count + 1 WHERE id = $1", [invite.id]);

    const user = result.rows[0];

    if (!user) {
      throw new Error("Failed to create user.");
    }

    return user;
  });

  return createUserSession(user);
}

export async function updateUserProfile(
  userId: number,
  input: {
    displayName: string;
    bio: string;
    websiteUrl: string;
    githubUrl: string;
    locale: string;
  },
) {
  await query(
    `
    UPDATE users
    SET display_name = $1,
        bio = $2,
        website_url = NULLIF($3, ''),
        github_url = NULLIF($4, ''),
        locale = $5,
        updated_at = $6
    WHERE id = $7
    `,
    [
      input.displayName.trim() || "whyisee user",
      input.bio.trim(),
      input.websiteUrl.trim(),
      input.githubUrl.trim(),
      input.locale === "en" ? "en" : "zh",
      new Date().toISOString(),
      userId,
    ],
  );
}

export async function changeUserPassword(userId: number, currentPassword: string, nextPassword: string) {
  if (nextPassword.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const row = await queryOne<{ password_hash: string | null }>("SELECT password_hash FROM users WHERE id = $1 LIMIT 1", [
    userId,
  ]);

  if (!row?.password_hash) {
    throw new Error("User does not have a password.");
  }

  const valid = await verifyPassword(currentPassword, row.password_hash);

  if (!valid) {
    throw new Error("Current password is incorrect.");
  }

  const passwordHash = await hashPassword(nextPassword);
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    await client.query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [passwordHash, now, userId]);
    await client.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL", [now, userId]);
  });
}

export async function createPasswordResetToken(identifier: string) {
  const user = await queryOne<{ id: number; email: string | null }>(
    "SELECT id, email FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($1) LIMIT 1",
    [identifier.trim()],
  );

  if (!user) {
    return undefined;
  }

  const now = new Date();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000).toISOString();

  await query(
    `
    INSERT INTO password_reset_tokens (user_id, token, expires_at, created_at)
    VALUES ($1, $2, $3, $4)
    `,
    [user.id, token, expiresAt, now.toISOString()],
  );

  return {
    token,
    userId: user.id,
    email: user.email,
  };
}

export async function resetPassword(token: string, password: string) {
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const row = await queryOne<{ id: number; user_id: number }>(
    `
    SELECT id, user_id
    FROM password_reset_tokens
    WHERE token = $1 AND used_at IS NULL AND expires_at > $2
    LIMIT 1
    `,
    [token, new Date().toISOString()],
  );

  if (!row) {
    throw new Error("Invalid reset token.");
  }

  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    await client.query("UPDATE users SET password_hash = $1, updated_at = $2 WHERE id = $3", [passwordHash, now, row.user_id]);
    await client.query("UPDATE password_reset_tokens SET used_at = $1 WHERE id = $2", [now, row.id]);
    await client.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at IS NULL", [now, row.user_id]);
  });
}

const userSelectSql = `
SELECT id, username, display_name, email, role, status, bio, website_url, github_url, locale, created_at
FROM users
`;

function mapUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    bio: row.bio,
    websiteUrl: row.website_url,
    githubUrl: row.github_url,
    locale: row.locale,
    createdAt: row.created_at,
  };
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}
