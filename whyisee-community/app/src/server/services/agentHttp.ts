import { AgentApiError, authenticateAgentRequest, type AgentContext } from "./agents";

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
    },
  });
}

export function jsonError(error: unknown) {
  if (error instanceof AgentApiError) {
    return jsonResponse({ ok: false, code: error.code, error: error.message }, error.status);
  }

  const message = error instanceof Error ? error.message : "Request failed.";
  return jsonResponse({ ok: false, code: "agent_api_failed", error: message }, 500);
}

export async function withAgent(
  request: Request,
  handler: (agent: AgentContext) => Promise<Response>,
): Promise<Response> {
  try {
    const agent = await authenticateAgentRequest(request);
    return await handler(agent);
  } catch (error) {
    console.error("Agent API failed", error);
    return jsonError(error);
  }
}
