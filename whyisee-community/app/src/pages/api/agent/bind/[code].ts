import type { APIRoute } from "astro";
import { jsonError, jsonResponse } from "@server/services/agentHttp";
import { bindUserAgentDevice } from "@server/services/userAgentDevices";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  try {
    const code = String(params.code || "").trim();

    if (!code) {
      return jsonResponse({ ok: false, code: "bind_code_required", error: "Bind code is required." }, 400);
    }

    const body = await readJsonBody(request);
    const result = await bindUserAgentDevice(code, {
      deviceName: readString(body.deviceName),
      agentName: readString(body.agentName),
      machineFingerprint: readString(body.machineFingerprint),
      runtime: typeof body.runtime === "object" && body.runtime ? (body.runtime as Record<string, unknown>) : undefined,
    }, request);

    return jsonResponse(result, 201);
  } catch (error) {
    return jsonError(error);
  }
};

async function readJsonBody(request: Request) {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function readString(value: unknown) {
  return String(value || "").trim();
}
