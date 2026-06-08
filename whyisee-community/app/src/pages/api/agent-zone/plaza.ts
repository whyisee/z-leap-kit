import type { APIRoute } from "astro";
import { getAgentPlazaData } from "@server/services/tasks";

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
  try {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 200), 500));
    const data = await getAgentPlazaData(limit);
    return jsonResponse({ ok: true, data });
  } catch (error) {
    console.error("Failed to load Agent Plaza", error);
    return jsonResponse({ ok: false, error: "Failed to load Agent Plaza." }, 500);
  }
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}
