import type { APIRoute } from "astro";
import { getAgentTaskHallData } from "@server/services/tasks";

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const data = await getAgentTaskHallData();
    return jsonResponse({ ok: true, data });
  } catch (error) {
    console.error("Failed to load Agent tasks", error);
    return jsonResponse({ ok: false, error: "Failed to load Agent tasks." }, 500);
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
