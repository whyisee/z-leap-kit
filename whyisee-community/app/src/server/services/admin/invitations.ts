import { randomBytes } from "node:crypto";
import { execute, query } from "@server/db/client";

export interface AdminInvitationRow {
  id: number;
  code: string;
  email: string | null;
  role: string;
  maxUses: number;
  useCount: number;
  expiresAt: string | null;
  createdBy: number | null;
  createdByUsername: string | null;
  createdAt: string;
  disabledAt: string | null;
}

export async function listAdminInvitations(): Promise<AdminInvitationRow[]> {
  const rows = await query<{
    id: number;
    code: string;
    email: string | null;
    role: string;
    max_uses: number;
    use_count: number;
    expires_at: string | null;
    created_by: number | null;
    created_by_username: string | null;
    created_at: string;
    disabled_at: string | null;
  }>(
    `
    SELECT
      invitations.id,
      invitations.code,
      invitations.email,
      invitations.role,
      invitations.max_uses,
      invitations.use_count,
      invitations.expires_at,
      invitations.created_by,
      users.username AS created_by_username,
      invitations.created_at,
      invitations.disabled_at
    FROM invitations
    LEFT JOIN users ON users.id = invitations.created_by
    ORDER BY invitations.created_at DESC, invitations.id DESC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    email: row.email,
    role: row.role,
    maxUses: row.max_uses,
    useCount: row.use_count,
    expiresAt: row.expires_at,
    createdBy: row.created_by,
    createdByUsername: row.created_by_username,
    createdAt: row.created_at,
    disabledAt: row.disabled_at,
  }));
}

export async function createInvitation(input: {
  code?: string;
  email?: string;
  role: string;
  maxUses: number;
  expiresAt?: string;
  createdBy: number;
}) {
  validateInvitationRole(input.role);

  const code = normalizeInviteCode(input.code) || generateInviteCode();
  const maxUses = normalizeMaxUses(input.maxUses);
  const expiresAt = normalizeOptionalDate(input.expiresAt);
  const email = normalizeOptionalEmail(input.email);
  const now = new Date().toISOString();

  await execute(
    `
    INSERT INTO invitations (code, email, role, max_uses, use_count, expires_at, created_by, created_at)
    VALUES ($1, $2, $3, $4, 0, $5, $6, $7)
    `,
    [code, email, input.role, maxUses, expiresAt, input.createdBy, now],
  );
}

export async function updateInvitation(
  id: number,
  input: {
    code: string;
    email?: string;
    role: string;
    maxUses: number;
    expiresAt?: string;
  },
) {
  validateInvitationRole(input.role);
  const code = normalizeInviteCode(input.code);

  if (!code) {
    throw new Error("Invitation code is required.");
  }

  await execute(
    `
    UPDATE invitations
    SET code = $1,
        email = $2,
        role = $3,
        max_uses = $4,
        expires_at = $5
    WHERE id = $6
    `,
    [
      code,
      normalizeOptionalEmail(input.email),
      input.role,
      normalizeMaxUses(input.maxUses),
      normalizeOptionalDate(input.expiresAt),
      id,
    ],
  );
}

export async function setInvitationDisabled(id: number, disabled: boolean) {
  await execute("UPDATE invitations SET disabled_at = $1 WHERE id = $2", [disabled ? new Date().toISOString() : null, id]);
}

export function mapInvitationForm(formData: FormData) {
  return {
    code: String(formData.get("code") || ""),
    email: String(formData.get("email") || ""),
    role: String(formData.get("role") || "member"),
    maxUses: Number(formData.get("maxUses") || 1),
    expiresAt: String(formData.get("expiresAt") || ""),
  };
}

function validateInvitationRole(role: string) {
  if (!["admin", "moderator", "member", "new_user"].includes(role)) {
    throw new Error("Invalid invitation role.");
  }
}

function normalizeInviteCode(code: string | undefined) {
  return String(code || "").trim();
}

function normalizeMaxUses(value: number) {
  if (!Number.isFinite(value) || value < 1) {
    throw new Error("Invitation max uses must be at least 1.");
  }

  return Math.floor(value);
}

function normalizeOptionalEmail(value: string | undefined) {
  const email = String(value || "").trim().toLowerCase();
  return email || null;
}

function normalizeOptionalDate(value: string | undefined) {
  const raw = String(value || "").trim();

  if (!raw) {
    return null;
  }

  const date = new Date(raw);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid invitation expiration date.");
  }

  return date.toISOString();
}

function generateInviteCode() {
  return `wsi-${randomBytes(8).toString("base64url")}`;
}
