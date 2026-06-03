import { query, queryOne } from "@server/db/client";
import { categoryTranslations, defaultLang, tagTranslations, type Lang } from "@lib/i18n";
import type { Category, Tag } from "@lib/types";

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  color: string;
  sort_order: number;
  topic_count: number;
}

interface TagRow {
  id: number;
  name: string;
  slug: string;
  description: string;
  topic_count: number;
}

export async function listCategories(lang: Lang = defaultLang): Promise<Category[]> {
  const rows = await query<CategoryRow>(
    `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.color,
        c.sort_order,
        COUNT(t.id)::int AS topic_count
      FROM categories c
      LEFT JOIN topics t ON t.category_id = c.id AND t.status = 'published'
      WHERE c.is_public = TRUE
      GROUP BY c.id, c.name, c.slug, c.description, c.color, c.sort_order
      ORDER BY c.sort_order ASC, c.id ASC
      `,
  );

  return rows.map((row: CategoryRow) => mapCategory(row, lang));
}

export async function getCategoryBySlug(slug: string, lang: Lang = defaultLang): Promise<Category | undefined> {
  const row = await queryOne<CategoryRow>(
    `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.color,
        c.sort_order,
        COUNT(t.id)::int AS topic_count
      FROM categories c
      LEFT JOIN topics t ON t.category_id = c.id AND t.status = 'published'
      WHERE c.slug = $1 AND c.is_public = TRUE
      GROUP BY c.id, c.name, c.slug, c.description, c.color, c.sort_order
      `,
    [slug],
  );

  return row ? mapCategory(row, lang) : undefined;
}

export async function listTags(lang: Lang = defaultLang): Promise<Tag[]> {
  const rows = await query<TagRow>(
    `
      SELECT
        tags.id,
        tags.name,
        tags.slug,
        tags.description,
        COUNT(topics.id)::int AS topic_count
      FROM tags
      LEFT JOIN topic_tags ON topic_tags.tag_id = tags.id
      LEFT JOIN topics ON topics.id = topic_tags.topic_id AND topics.status = 'published'
      GROUP BY tags.id, tags.name, tags.slug, tags.description
      ORDER BY topic_count DESC, tags.name ASC
      `,
  );

  return rows.map((row: TagRow) => mapTag(row, lang));
}

export async function getTagBySlug(slug: string, lang: Lang = defaultLang): Promise<Tag | undefined> {
  const row = await queryOne<TagRow>(
    `
      SELECT
        tags.id,
        tags.name,
        tags.slug,
        tags.description,
        COUNT(topics.id)::int AS topic_count
      FROM tags
      LEFT JOIN topic_tags ON topic_tags.tag_id = tags.id
      LEFT JOIN topics ON topics.id = topic_tags.topic_id AND topics.status = 'published'
      WHERE tags.slug = $1
      GROUP BY tags.id, tags.name, tags.slug, tags.description
      `,
    [slug],
  );

  return row ? mapTag(row, lang) : undefined;
}

function mapCategory(row: CategoryRow, lang: Lang): Category {
  const translated = categoryTranslations[row.slug]?.[lang];

  return {
    id: row.id,
    name: translated?.name || row.name,
    slug: row.slug,
    description: translated?.description || row.description,
    color: row.color,
    sortOrder: row.sort_order,
    topicCount: row.topic_count,
  };
}

function mapTag(row: TagRow, lang: Lang): Tag {
  const translated = tagTranslations[row.slug]?.[lang];

  return {
    id: row.id,
    name: translated?.name || row.name,
    slug: row.slug,
    description: translated?.description || row.description,
    topicCount: row.topic_count,
  };
}
