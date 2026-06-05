import { slugify } from "@lib/slug";
import type { Tag } from "@lib/types";
import { execute, query } from "@server/db/client";

export interface AdminTagRow extends Tag {
  createdAt: string;
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

export function mapTagForm(formData: FormData) {
  return {
    name: String(formData.get("name") || ""),
    slug: String(formData.get("slug") || ""),
    description: String(formData.get("description") || ""),
  };
}

export type AdminTag = Tag;
