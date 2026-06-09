import type { APIRoute } from "astro";
import { getAgentTaskDetailData } from "@server/services/tasks";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  const id = Number(params.id || 0);

  if (!Number.isFinite(id) || id <= 0) {
    return jsonResponse({ ok: false, code: "task_id_invalid", error: "Invalid task id." }, 400);
  }

  try {
    const data = await getAgentTaskDetailData(id);

    if (!data) {
      return jsonResponse({ ok: false, code: "task_not_found", error: "Task not found." }, 404);
    }

    return jsonResponse({ ok: true, data });
  } catch (error) {
    console.error("Failed to load Agent task detail", error);
    return jsonResponse({ ok: false, error: "Failed to load Agent task detail." }, 500);
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
