import { randomBytes } from "node:crypto";
import { isTreeHoleCategorySlug } from "@lib/anonymous";
import { hashPassword, verifyPassword } from "@lib/password";
import type { AuthSession } from "@lib/auth";
import { createUserSession } from "@lib/auth";
import type { Lang } from "@lib/i18n";
import { query, queryOne, withTransaction } from "@server/db/client";
import type { Topic } from "@lib/types";
import { listTopics } from "./topics";
import { refreshUserReputation } from "./reputation";

export type SignupField = "username" | "email" | "password" | "inviteCode";

export type SignupErrorCode =
  | "username_required"
  | "username_format"
  | "username_taken"
  | "email_required"
  | "email_format"
  | "email_taken"
  | "password_required"
  | "password_short"
  | "invite_required"
  | "invite_invalid"
  | "invite_email_mismatch"
  | "signup_failed";

export interface SignupValidationIssue {
  field: SignupField;
  code: SignupErrorCode;
}

export class SignupValidationError extends Error {
  issue: SignupValidationIssue;

  constructor(issue: SignupValidationIssue) {
    super(issue.code);
    this.name = "SignupValidationError";
    this.issue = issue;
  }
}

interface InvitationRow {
  id: number;
  email: string | null;
  role: AuthSession["role"];
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  disabled_at: string | null;
}

const signupIssueMessages: Record<Lang, Record<SignupErrorCode, string>> = {
  zh: {
    username_required: "先填一个用户名。",
    username_format: "用户名需要 3-32 位，只能包含字母、数字、下划线或短横线。",
    username_taken: "这个用户名已经被使用了，换一个试试。",
    email_required: "先填邮箱，后面找回密码也会用到。",
    email_format: "邮箱格式不太对，检查一下 @ 和域名。",
    email_taken: "这个邮箱已经注册过了，可以直接去登录。",
    password_required: "先设置密码。",
    password_short: "密码至少需要 8 位。",
    invite_required: "需要填写邀请码才能注册。",
    invite_invalid: "这个邀请码不可用，可能已过期、停用或使用次数已满。",
    invite_email_mismatch: "这个邀请码绑定了指定邮箱，请使用对应邮箱注册。",
    signup_failed: "注册失败，请稍后再试。",
  },
  en: {
    username_required: "Enter a username first.",
    username_format: "Username must be 3-32 characters: letters, numbers, underscore, or hyphen.",
    username_taken: "This username is already taken. Try another one.",
    email_required: "Enter an email first. It is also used for password recovery.",
    email_format: "Email format looks wrong. Check the @ and domain.",
    email_taken: "This email is already registered. You can log in instead.",
    password_required: "Set a password first.",
    password_short: "Password must be at least 8 characters.",
    invite_required: "An invitation code is required.",
    invite_invalid: "This invitation code is unavailable, expired, disabled, or fully used.",
    invite_email_mismatch: "This invitation code is bound to a specific email address.",
    signup_failed: "Sign up failed. Please try again later.",
  },
};

export function getSignupIssueMessage(issue: SignupValidationIssue | SignupErrorCode, lang: Lang) {
  const code = typeof issue === "string" ? issue : issue.code;
  return signupIssueMessages[lang][code] || signupIssueMessages[lang].signup_failed;
}

export interface PublicUser {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
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
  avatar_url: string | null;
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
  const topics = await listTopics({ authorId: userId, limit: 50, lang, includeDrafts });

  return includeDrafts ? topics : topics.filter((topic) => !isTreeHoleCategorySlug(topic.category.slug));
}

export async function validateSignupInput(
  input: {
    username?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
  },
  options: {
    fields?: SignupField[];
  } = {},
) {
  const fields = new Set<SignupField>(options.fields || ["username", "email", "password", "inviteCode"]);
  const issues: SignupValidationIssue[] = [];
  const rawUsername = String(input.username || "").trim();
  const username = normalizeUsername(rawUsername);
  const email = String(input.email || "").trim().toLowerCase();
  const password = String(input.password || "");
  const inviteCode = String(input.inviteCode || "").trim();

  if (fields.has("username")) {
    if (!rawUsername) {
      issues.push(makeSignupIssue("username", "username_required"));
    } else if (!isValidUsernameInput(rawUsername) || username.length < 3 || username.length > 32) {
      issues.push(makeSignupIssue("username", "username_format"));
    } else {
      const existing = await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE lower(username) = lower($1) LIMIT 1",
        [username],
      );

      if (existing) {
        issues.push(makeSignupIssue("username", "username_taken"));
      }
    }
  }

  if (fields.has("email")) {
    if (!email) {
      issues.push(makeSignupIssue("email", "email_required"));
    } else if (!isValidEmailInput(email)) {
      issues.push(makeSignupIssue("email", "email_format"));
    } else {
      const existing = await queryOne<{ id: number }>(
        "SELECT id FROM users WHERE lower(email) = lower($1) LIMIT 1",
        [email],
      );

      if (existing) {
        issues.push(makeSignupIssue("email", "email_taken"));
      }
    }
  }

  if (fields.has("password")) {
    if (!password) {
      issues.push(makeSignupIssue("password", "password_required"));
    } else if (password.length < 8) {
      issues.push(makeSignupIssue("password", "password_short"));
    }
  }

  if (fields.has("inviteCode")) {
    if (!inviteCode) {
      issues.push(makeSignupIssue("inviteCode", "invite_required"));
    } else {
      const invite = await queryOne<InvitationRow>(
        `
        SELECT id, email, role, max_uses, use_count, expires_at, disabled_at
        FROM invitations
        WHERE code = $1
        LIMIT 1
        `,
        [inviteCode],
      );
      const inviteIssue = getInvitationIssue(invite, email, new Date().toISOString());

      if (inviteIssue) {
        issues.push(inviteIssue);
      }
    }
  }

  return issues;
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
  const issues = await validateSignupInput(input);

  if (issues[0]) {
    throw new SignupValidationError(issues[0]);
  }

  const now = new Date().toISOString();
  const passwordHash = await hashPassword(input.password);

  const user = await withTransaction(async (client) => {
    const invitation = await client.query<InvitationRow>(
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
    const inviteIssue = getInvitationIssue(invite, email, now);

    if (inviteIssue) {
      throw new SignupValidationError(inviteIssue);
    }

    let result;

    try {
      result = await client.query<{
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
    } catch (error) {
      throw toSignupUniqueError(error);
    }

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
    avatarUrl: string;
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
        avatar_url = $2,
        bio = $3,
        website_url = NULLIF($4, ''),
        github_url = NULLIF($5, ''),
        locale = $6,
        updated_at = $7
    WHERE id = $8
    `,
    [
      input.displayName.trim() || "whyisee user",
      normalizeAvatarUrl(input.avatarUrl),
      input.bio.trim(),
      input.websiteUrl.trim(),
      input.githubUrl.trim(),
      input.locale === "en" ? "en" : "zh",
      new Date().toISOString(),
      userId,
    ],
  );

  await refreshUserReputation(userId);
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
SELECT id, username, display_name, avatar_url, email, role, status, bio, website_url, github_url, locale, created_at
FROM users
`;

function mapUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
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

function makeSignupIssue(field: SignupField, code: SignupErrorCode): SignupValidationIssue {
  return { field, code };
}

function getInvitationIssue(invite: InvitationRow | undefined, email: string, now: string): SignupValidationIssue | undefined {
  if (!invite || invite.disabled_at || invite.use_count >= invite.max_uses || (invite.expires_at && invite.expires_at < now)) {
    return makeSignupIssue("inviteCode", "invite_invalid");
  }

  if (invite.email && (!email || invite.email.toLowerCase() !== email)) {
    return makeSignupIssue("inviteCode", "invite_email_mismatch");
  }

  return undefined;
}

function isValidUsernameInput(value: string) {
  return /^[a-zA-Z0-9_-]+$/.test(value);
}

function isValidEmailInput(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function toSignupUniqueError(error: unknown) {
  if (typeof error === "object" && error && "code" in error && error.code === "23505") {
    const detail = "detail" in error && typeof error.detail === "string" ? error.detail : "";

    if (detail.includes("username")) {
      return new SignupValidationError(makeSignupIssue("username", "username_taken"));
    }

    if (detail.includes("email")) {
      return new SignupValidationError(makeSignupIssue("email", "email_taken"));
    }
  }

  return error;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 32);
}

function normalizeAvatarUrl(value: string) {
  const avatarUrl = value.trim();

  if (!avatarUrl) {
    return null;
  }

  if (avatarUrl.length > 6000) {
    throw new Error("Avatar URL is too long.");
  }

  if (
    avatarUrl.startsWith("/uploads/") ||
    avatarUrl.startsWith("data:image/svg+xml")
  ) {
    return avatarUrl;
  }

  throw new Error("Invalid avatar URL.");
}
