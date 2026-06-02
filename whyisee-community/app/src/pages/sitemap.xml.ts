import type { APIRoute } from "astro";
import { escapeXml } from "@lib/format";
import { categoryPath, tagPath, topicPath } from "@lib/routes";
import { listCategories, listTags } from "@server/services/categories";
import { listTopics } from "@server/services/topics";

export const prerender = false;

export const GET: APIRoute = ({ site }) => {
  const baseUrl = site?.toString() || process.env.SITE_URL || "https://whyisee.xyz";
  const staticPaths = ["/", "/latest", "/categories", "/projects", "/about", "/guidelines"];
  const dynamicPaths = [
    ...listCategories().map((category) => categoryPath(category.slug)),
    ...listTags().map((tag) => tagPath(tag.slug)),
    ...listTopics({ limit: 500 }).map((topic) => topicPath(topic)),
  ];
  const paths = [...staticPaths, ...dynamicPaths];
  const localizedPaths = [...paths, ...paths.map((path) => addLangQuery(path, "en"))];

  const urls = localizedPaths
    .map((path) => {
      const url = new URL(path, baseUrl).toString();
      return `
        <url>
          <loc>${escapeXml(url)}</loc>
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
