import { execute, query } from "@server/db/client";

export interface AdminUserRow {
  id: number;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

export async function listAdminUsers(search = "", limit = 100): Promise<AdminUserRow[]> {
  const value = `%${search.trim()}%`;
  const rows = await query<{
    id: number;
    username: string;
    display_name: string;
    email: string | null;
    role: string;
    status: string;
    created_at: string;
    last_login_at: string | null;
  }>(
    `
    SELECT id, username, display_name, email, role, status, created_at, last_login_at
    FROM users
    WHERE $1 = '%%'
       OR username ILIKE $1
       OR display_name ILIKE $1
       OR email ILIKE $1
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    `,
    [value, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  }));
}

export async function updateAdminUser(userId: number, input: { role: string; status: string }) {
  if (!["admin", "moderator", "member", "new_user"].includes(input.role)) {
    throw new Error("Invalid role.");
  }

  if (!["active", "pending", "suspended", "banned"].includes(input.status)) {
    throw new Error("Invalid status.");
  }

  await execute("UPDATE users SET role = $1, status = $2, updated_at = $3 WHERE id = $4", [
    input.role,
    input.status,
    new Date().toISOString(),
    userId,
  ]);
}
