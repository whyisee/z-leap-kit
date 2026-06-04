import type { APIRoute } from "astro";
import { getSessionFromAstro } from "@lib/auth";
import { searchMentionTargets } from "@server/services/mentions";

export const prerender = false;

export const GET: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);

  if (!session) {
    return json({ error: "login_required" }, 401);
  }

  const q = context.url.searchParams.get("q") || "";
  const targets = await searchMentionTargets(q, 8);

  return json({
    users: targets.map((target) => ({
      username: target.username,
      displayName: target.displayName,
      avatarUrl: target.avatarUrl,
      isBot: target.isBot,
    })),
  });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
