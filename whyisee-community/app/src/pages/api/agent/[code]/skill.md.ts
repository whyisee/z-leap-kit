import type { APIRoute } from "astro";
import { AgentApiError } from "@server/services/agents";
import { readUserAgentSkillMarkdown } from "@server/services/skillPack";
import { getUserAgentSkillBindContext } from "@server/services/userAgentDevices";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  try {
    const code = String(context.params.code || "").trim();

    if (!code) {
      return new Response("Agent skill link is invalid.", { status: 400 });
    }

    const bindContext = await getUserAgentSkillBindContext(code, context.url.origin);
    const markdown = await readUserAgentSkillMarkdown({
      username: bindContext.user.username,
      displayName: bindContext.user.displayName,
      bindCommand: bindContext.bindCommand,
      expiresAt: bindContext.expiresAt,
    });

    return new Response(markdown, {
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "content-disposition": 'attachment; filename="whyisee-content-agent-SKILL.md"',
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof AgentApiError) {
      return new Response(error.message, { status: error.status });
    }

    console.error("Failed to read personalized agent skill", error);
    return new Response("Skill file unavailable.", { status: 500 });
  }
};
