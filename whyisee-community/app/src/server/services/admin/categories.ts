import { slugify } from "@lib/slug";
import type { Category } from "@lib/types";
import { execute, query } from "@server/db/client";

export interface AdminCategoryRow extends Category {
  isPublic: boolean;
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

export type AdminCategory = Category;
