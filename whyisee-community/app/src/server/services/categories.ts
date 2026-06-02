import { getDb } from "@server/db/client";
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

export function listCategories(lang: Lang = defaultLang): Category[] {
  const rows = getDb()
    .prepare(
      `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.color,
        c.sort_order,
        COUNT(t.id) AS topic_count
      FROM categories c
      LEFT JOIN topics t ON t.category_id = c.id AND t.status = 'published'
      WHERE c.is_public = 1
      GROUP BY c.id
      ORDER BY c.sort_order ASC, c.id ASC
      `,
    )
    .all() as CategoryRow[];

  return rows.map((row) => mapCategory(row, lang));
}

export function getCategoryBySlug(slug: string, lang: Lang = defaultLang): Category | undefined {
  const row = getDb()
    .prepare(
      `
      SELECT
        c.id,
        c.name,
        c.slug,
        c.description,
        c.color,
        c.sort_order,
        COUNT(t.id) AS topic_count
      FROM categories c
      LEFT JOIN topics t ON t.category_id = c.id AND t.status = 'published'
      WHERE c.slug = ? AND c.is_public = 1
      GROUP BY c.id
      `,
    )
    .get(slug) as CategoryRow | undefined;

  return row ? mapCategory(row, lang) : undefined;
}

export function listTags(lang: Lang = defaultLang): Tag[] {
  const rows = getDb()
    .prepare(
      `
      SELECT
        tags.id,
        tags.name,
        tags.slug,
        tags.description,
        COUNT(topics.id) AS topic_count
      FROM tags
      LEFT JOIN topic_tags ON topic_tags.tag_id = tags.id
      LEFT JOIN topics ON topics.id = topic_tags.topic_id AND topics.status = 'published'
      GROUP BY tags.id
      ORDER BY topic_count DESC, tags.name ASC
      `,
    )
    .all() as TagRow[];

  return rows.map((row) => mapTag(row, lang));
}

export function getTagBySlug(slug: string, lang: Lang = defaultLang): Tag | undefined {
  const row = getDb()
    .prepare(
      `
      SELECT
        tags.id,
        tags.name,
        tags.slug,
        tags.description,
        COUNT(topics.id) AS topic_count
      FROM tags
      LEFT JOIN topic_tags ON topic_tags.tag_id = tags.id
      LEFT JOIN topics ON topics.id = topic_tags.topic_id AND topics.status = 'published'
      WHERE tags.slug = ?
      GROUP BY tags.id
      `,
    )
    .get(slug) as TagRow | undefined;

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
