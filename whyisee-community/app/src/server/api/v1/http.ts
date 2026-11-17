import type { Context } from "hono";
import type { AuthSession } from "@lib/auth";
import type { Lang } from "@lib/i18n";

export type ApiEnv = {
  Variables: {
    session: AuthSession;
    requestId: string;
  };
};

export type ApiContext = Context<ApiEnv>;

export type ApiErrorCode =
  | "unauthorized"
  | "token_expired"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "rate_limited"
  | "conflict"
  | "payload_too_large"
  | "server_error";

const statusByCode: Record<ApiErrorCode, number> = {
  unauthorized: 401,
  token_expired: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  rate_limited: 429,
  conflict: 409,
  payload_too_large: 413,
  server_error: 500,
};

export function ok(c: ApiContext, data: unknown, meta: Record<string, unknown> = {}) {
  return c.json({ ok: true, data, meta: { requestId: c.get("requestId"), ...meta } });
}

export function fail(
  c: ApiContext,
  code: ApiErrorCode,
  message: string,
  details?: Record<string, unknown>,
) {
  return c.json(
    { ok: false, error: { code, message, ...(details ? { details } : {}) } },
    statusByCode[code] as 400,
  );
}

export function failWithStatus(c: ApiContext, status: number, code: ApiErrorCode, message: string) {
  return c.json({ ok: false, error: { code, message } }, status as 400);
}

/**
 * 语言协商：app 传 Accept-Language，网页那边用 cookie / ?lang=，这里两者都认。
 * 只读不改，i18n 的既有实现留给网页用。
 */
export function langOf(c: ApiContext): Lang {
  const header = c.req.header("accept-language") || "";
  if (header.trim().toLowerCase().startsWith("en")) return "en";
  if (header.trim().toLowerCase().startsWith("zh")) return "zh";

  const query = c.req.query("lang");
  if (query === "en" || query === "zh") return query;

  return "zh";
}

export function intParam(value: string | undefined, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
}
