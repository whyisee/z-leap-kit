import type { APIRoute } from "astro";
import { normalizeSkillPath, readPublicSkillFile } from "@server/services/skillPack";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const filePath = normalizeSkillPath(params.path || "");

  try {
    const content = await readPublicSkillFile(filePath);

    return new Response(content, {
      headers: {
        "content-type": contentType(filePath),
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("Skill file not found.", { status: 404 });
  }
};

function contentType(filePath: string) {
  if (filePath.endsWith(".json")) {
    return "application/json; charset=utf-8";
  }

  return "text/markdown; charset=utf-8";
}
