import { slugify } from "@lib/slug";
import { execute, query } from "@server/db/client";
import type { Category, Tag } from "@lib/types";

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

export interface AdminCategoryRow extends Category {
  isPublic: boolean;
}

export interface AdminTagRow extends Tag {
  createdAt: string;
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

export async function listAdminCategories(): Promise<AdminCategoryRow[]> {
  const rows = await query<{
    id: number;
    name: string;
    slug: string;
    description: string;
    color: string;
    sort_order: number;
    is_public: boolean;
    topic_count: string;
  }>(
    `
    SELECT
      categories.id,
      categories.name,
      categories.slug,
      categories.description,
      categories.color,
      categories.sort_order,
      categories.is_public,
      COUNT(topics.id)::text AS topic_count
    FROM categories
    LEFT JOIN topics ON topics.category_id = categories.id AND topics.status <> 'deleted'
    GROUP BY categories.id
    ORDER BY categories.sort_order ASC, categories.id ASC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    color: row.color,
    sortOrder: row.sort_order,
    isPublic: row.is_public,
    topicCount: Number(row.topic_count || 0),
  }));
}

export async function listAdminTags(): Promise<AdminTagRow[]> {
  const rows = await query<{
    id: number;
    name: string;
    slug: string;
    description: string;
    created_at: string;
    topic_count: string;
  }>(
    `
    SELECT
      tags.id,
      tags.name,
      tags.slug,
      tags.description,
      tags.created_at,
      COUNT(topic_tags.topic_id)::text AS topic_count
    FROM tags
    LEFT JOIN topic_tags ON topic_tags.tag_id = tags.id
    GROUP BY tags.id
    ORDER BY COUNT(topic_tags.topic_id) DESC, tags.name ASC
    `,
  );

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    sortOrder: 0,
    createdAt: row.created_at,
    topicCount: Number(row.topic_count || 0),
  }));
}

export async function createCategory(input: {
  name: string;
  slug?: string;
  description: string;
  color: string;
  sortOrder: number;
  isPublic: boolean;
}) {
  const now = new Date().toISOString();
  await execute(
    `
    INSERT INTO categories (name, slug, description, color, sort_order, is_public, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
    `,
    [
      input.name.trim(),
      slugify(input.slug || input.name),
      input.description.trim(),
      input.color || "#7fb3ff",
      input.sortOrder || 100,
      input.isPublic,
      now,
    ],
  );
}

export async function updateCategory(
  id: number,
  input: {
    name: string;
    slug?: string;
    description: string;
    color: string;
    sortOrder: number;
    isPublic: boolean;
  },
) {
  await execute(
    `
    UPDATE categories
    SET name = $1,
        slug = $2,
        description = $3,
        color = $4,
        sort_order = $5,
        is_public = $6,
        updated_at = $7
    WHERE id = $8
    `,
    [
      input.name.trim(),
      slugify(input.slug || input.name),
      input.description.trim(),
      input.color || "#7fb3ff",
      input.sortOrder || 100,
      input.isPublic,
      new Date().toISOString(),
      id,
    ],
  );
}

export async function createTag(input: { name: string; slug?: string; description: string }) {
  await execute(
    `
    INSERT INTO tags (name, slug, description, created_at)
    VALUES ($1, $2, $3, $4)
    `,
    [input.name.trim(), slugify(input.slug || input.name), input.description.trim(), new Date().toISOString()],
  );
}

export async function updateTag(id: number, input: { name: string; slug?: string; description: string }) {
  await execute("UPDATE tags SET name = $1, slug = $2, description = $3 WHERE id = $4", [
    input.name.trim(),
    slugify(input.slug || input.name),
    input.description.trim(),
    id,
  ]);
}

export function mapCategoryForm(formData: FormData) {
  return {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || ""),
    color: String(formData.get("color") || "#7fb3ff"),
    sortOrder: Number(formData.get("sortOrder") || 100),
    isPublic: formData.getAll("isPublic").includes("1"),
  };
}

export function mapTagForm(formData: FormData) {
  return {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || ""),
  };
}

export type AdminCategory = Category;
export type AdminTag = Tag;
