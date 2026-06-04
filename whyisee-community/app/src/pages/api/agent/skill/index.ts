import type { APIRoute } from "astro";
import { readPublicSkillBundle } from "@server/services/skillPack";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const bundle = await readPublicSkillBundle();
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    });

    if (url.searchParams.get("download") === "1") {
      headers.set("content-disposition", 'attachment; filename="whyisee-content-agent.skill.json"');
    }

    return new Response(JSON.stringify(bundle, null, 2), { headers });
  } catch (error) {
    console.error("Failed to read public skill bundle", error);
    return new Response(JSON.stringify({ ok: false, error: "skill_bundle_unavailable" }), {
      status: 500,
      headers: {
        "content-type": "application/json; charset=utf-8",
      },
    });
  }
};
