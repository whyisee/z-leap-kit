import type { APIRoute } from "astro";
import { escapeXml } from "@lib/format";
import { categoryPath, tagPath, topicPath } from "@lib/routes";
import { listCategories, listTags } from "@server/services/categories";
import { listTopics } from "@server/services/topics";

export const prerender = false;

export const GET: APIRoute = async ({ site }) => {
  const baseUrl = site?.toString() || process.env.SITE_URL || "https://whyisee.xyz";
  const staticPaths = ["/", "/latest", "/categories", "/projects", "/about", "/guidelines", "/agent-skill"];
  const categories = await listCategories();
  const tags = await listTags();
  const topics = await listTopics({ limit: 500 });
  const siteLastmod = latestDate(topics.map((topic) => topic.updatedAt || topic.lastActivityAt || topic.publishedAt));
  const entries = [
    ...staticPaths.map((path) => ({ path, lastmod: siteLastmod })),
    ...categories.map((category) => ({
      path: categoryPath(category.slug),
      lastmod: latestDate(
        topics
          .filter((topic) => topic.category.slug === category.slug)
          .map((topic) => topic.updatedAt || topic.lastActivityAt || topic.publishedAt),
        siteLastmod,
      ),
    })),
    ...tags.map((tag) => ({
      path: tagPath(tag.slug),
      lastmod: latestDate(
        topics
          .filter((topic) => topic.tags.some((topicTag) => topicTag.slug === tag.slug))
          .map((topic) => topic.updatedAt || topic.lastActivityAt || topic.publishedAt),
        siteLastmod,
      ),
    })),
    ...topics.map((topic) => ({
      path: topicPath(topic),
      lastmod: formatSitemapDate(topic.updatedAt || topic.lastActivityAt || topic.publishedAt || topic.createdAt),
    })),
  ];
  const localizedEntries = [...entries, ...entries.map((entry) => ({ ...entry, path: addLangQuery(entry.path, "en") }))];

  const urls = localizedEntries
    .map((entry) => {
      const url = new URL(entry.path, baseUrl).toString();
      return `
        <url>
          <loc>${escapeXml(url)}</loc>
          <lastmod>${escapeXml(entry.lastmod)}</lastmod>
          <changefreq>weekly</changefreq>
        </url>
      `;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    ${urls}
  </urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};

function addLangQuery(path: string, lang: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}lang=${lang}`;
}

function latestDate(values: Array<string | undefined>, fallback = new Date().toISOString()) {
  const timestamps = values
    .map((value) => (value ? Date.parse(value) : Number.NaN))
    .filter((value) => Number.isFinite(value));

  if (timestamps.length === 0) {
    return formatSitemapDate(fallback);
  }

  return formatSitemapDate(new Date(Math.max(...timestamps)).toISOString());
}

function formatSitemapDate(value: string) {
  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    return new Date().toISOString().slice(0, 10);
  }

  return new Date(timestamp).toISOString().slice(0, 10);
}
