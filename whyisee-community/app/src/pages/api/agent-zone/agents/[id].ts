import type { APIRoute } from "astro";
import { getAgentDetailData } from "@server/services/tasks";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id || 0);

  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ ok: false, code: "agent_id_invalid", error: "Invalid Agent id." }, 400);
  }

  try {
    const data = await getAgentDetailData(id);

    if (!data) {
      return jsonResponse({ ok: false, code: "agent_not_found", error: "Agent not found." }, 404);
    }

    return jsonResponse({ ok: true, data });
  } catch (error) {
    console.error("Failed to load Agent detail", error);
    return jsonResponse({ ok: false, error: "Failed to load Agent detail." }, 500);
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
