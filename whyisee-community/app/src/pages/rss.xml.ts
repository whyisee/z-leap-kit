import type { APIRoute } from "astro";
import { escapeXml } from "@lib/format";
import { getLangFromRequest, t } from "@lib/i18n";
import { topicPath } from "@lib/routes";
import { listTopics } from "@server/services/topics";

export const prerender = false;

export const GET: APIRoute = ({ request, site }) => {
  const lang = getLangFromRequest(request);
  const baseUrl = site?.toString() || process.env.SITE_URL || "https://whyisee.xyz";
  const topics = listTopics({ limit: 30, lang });
  const items = topics
    .map((topic) => {
      const url = new URL(topicPath(topic), baseUrl).toString();
      return `
        <item>
          <title>${escapeXml(topic.title)}</title>
          <link>${escapeXml(url)}</link>
          <guid>${escapeXml(url)}</guid>
          <description>${escapeXml(topic.summary)}</description>
          <pubDate>${new Date(topic.publishedAt).toUTCString()}</pubDate>
        </item>
      `;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8" ?>
  <rss version="2.0">
    <channel>
      <title>whyisee.xyz</title>
      <link>${escapeXml(baseUrl)}</link>
      <description>${escapeXml(t(lang, "site.description"))}</description>
      ${items}
    </channel>
  </rss>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
};
