import type { MiddlewareHandler } from "hono";
import { randomUUID } from "node:crypto";
import { authCookieName, readSessionId, type AuthSession } from "@lib/auth";
import { fail } from "./http";
import type { ApiEnv } from "./http";

/** sessions.id 是 32 字节 base64url，长度固定 43，先卡形状再查库 */
const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

export const requestIdMiddleware: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const incoming = c.req.header("x-request-id");
  const id = incoming && incoming.length <= 64 ? incoming : randomUUID();
  c.set("requestId", id);

  await next();

  c.res.headers.set("x-request-id", id);
};

export async function sessionFromRequest(request: Request): Promise<AuthSession | undefined> {
  const header = request.headers.get("authorization") || "";

  if (header.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (!tokenPattern.test(token)) return undefined;
    return readSessionId(token);
  }

  // WebView 里的原生注入脚本可能不带 Bearer，退回 cookie（与网页共用一条会话）
  const cookieToken = readCookie(request.headers.get("cookie"), authCookieName);
  if (cookieToken && tokenPattern.test(cookieToken)) {
    return readSessionId(cookieToken);
  }

  return undefined;
}

export const requireAuth: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const header = c.req.header("authorization");
  const session = await sessionFromRequest(c.req.raw);

  if (!session) {
    return header ? fail(c, "token_expired", "登录已失效，请重新登录") : fail(c, "unauthorized", "请先登录");
  }

  c.set("session", session);
  await next();
};

export const optionalAuth: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const session = await sessionFromRequest(c.req.raw);
  if (session) c.set("session", session);
  await next();
};

export function sessionOf(c: { get: (key: "session") => AuthSession | undefined }): AuthSession | undefined {
  try {
    return c.get("session");
  } catch {
    return undefined;
  }
}

function readCookie(header: string | null | undefined, name: string) {
  if (!header) return undefined;

  const hit = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return hit?.slice(name.length + 1);
}
