import type { APIRoute } from "astro";
import { readPublicSkillMarkdown } from "@server/services/skillPack";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const markdown = await readPublicSkillMarkdown();

    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="whyisee-content-agent-SKILL.md"',
        "cache-control": "public, max-age=300",
      },
    });
  } catch (error) {
    console.error("Failed to read public skill markdown", error);
    return new Response("Skill file unavailable.", { status: 500 });
  }
};
