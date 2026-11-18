import { Hono } from "hono";
import {
  appSessionMaxAgeSeconds,
  authCookieName,
  authenticateUser,
  revokeSession,
  type AuthSession,
} from "@lib/auth";
import { queryOne } from "@server/db/client";
import { sendEmail } from "@server/services/mailer";
import {
  createPasswordResetToken,
  createUserWithInvitation,
  getSignupIssueMessage,
  resetPassword,
  SignupValidationError,
} from "@server/services/users";
import { promoteSessionToApp, rotateAppSession } from "@server/services/appSessions";
import { clientIpOf, takeToken } from "@lib/rateLimit";
import { fail, langOf, ok, type ApiEnv } from "../http";
import { requireAuth } from "../middleware";

const auth = new Hono<ApiEnv>();

const loginRateLimit = { limit: 10, windowMs: 5 * 60 * 1000 };

auth.use("/me", requireAuth);
auth.use("/logout", requireAuth);

auth.post("/login", async (c) => {
  const ip = clientIpOf(c.req.raw);
  const limit = takeToken(`login:${ip}`, loginRateLimit.limit, loginRateLimit.windowMs);

  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "尝试太频繁，稍后再试");
  }

  const body = await readJson<{ identifier?: string; password?: string; deviceName?: string; platform?: string }>(c.req.raw);
  const identifier = String(body?.identifier || "").trim();
  const password = String(body?.password || "");

  if (!identifier || !password) {
    return fail(c, "validation_failed", "账号和密码都要填");
  }

  const session = await authenticateUser(identifier, password, {
    client: "app",
    ttlSeconds: appSessionMaxAgeSeconds,
    clientVersion: c.req.header("x-app-version") ?? null,
    userAgent: describeDevice(body?.platform, body?.deviceName),
  });

  if (!session) {
    return fail(c, "unauthorized", "账号或密码不对");
  }

  return ok(c, {
    token: session.sessionId,
    expiresAt: expiresAtIso(appSessionMaxAgeSeconds),
    user: toUserDto(session),
  });
});

/**
 * 注册。校验和网页完全同一套（邀请码、用户名格式、邮箱唯一），这里只多一件事：
 * 注册成功直接发 token。用户刚填完一遍密码，没理由让他退回去再登一次。
 */
auth.post("/signup", async (c) => {
  const ip = clientIpOf(c.req.raw);
  const limit = takeToken(`signup:${ip}`, 5, 10 * 60 * 1000);

  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "尝试太频繁，稍后再试");
  }

  const body = await readJson<{
    username?: string;
    email?: string;
    password?: string;
    inviteCode?: string;
  }>(c.req.raw);

  const password = String(body?.password || "");

  if (password.length < 8) {
    return fail(c, "validation_failed", "密码至少 8 位");
  }

  try {
    const session = await createUserWithInvitation({
      username: String(body?.username || ""),
      email: String(body?.email || ""),
      password,
      inviteCode: String(body?.inviteCode || ""),
    });

    // 注册时建的是网页会话（默认有效期），这里转成 app 会话，否则手机上很快就过期
    const expiresAt = await promoteSessionToApp(session.sessionId, {
      clientVersion: c.req.header("x-app-version") ?? null,
    });

    return ok(c, {
      token: session.sessionId,
      expiresAt: expiresAt ?? expiresAtIso(appSessionMaxAgeSeconds),
      user: toUserDto(session),
    });
  } catch (error) {
    if (error instanceof SignupValidationError) {
      return fail(c, "validation_failed", getSignupIssueMessage(error.issue, langOf(c)), {
        field: error.issue.field,
        reason: error.issue.code,
      });
    }

    console.error("Failed to sign up from app", error);
    return fail(c, "server_error", "注册没成功，稍后再试");
  }
});

/**
 * 发起找回密码。
 *
 * 无论账号存不存在都回 sent: true —— 这个接口不登录就能调，按结果区分就等于
 * 送给别人一个「这个用户名有没有注册」的探测工具。
 */
auth.post("/password-reset/request", async (c) => {
  const ip = clientIpOf(c.req.raw);
  const limit = takeToken(`reset:${ip}`, 5, 10 * 60 * 1000);

  if (!limit.allowed) {
    c.header("retry-after", String(limit.retryAfterSeconds));
    return fail(c, "rate_limited", "尝试太频繁，稍后再试");
  }

  const body = await readJson<{ identifier?: string }>(c.req.raw);
  const identifier = String(body?.identifier || "").trim();

  if (!identifier) {
    return fail(c, "validation_failed", "填用户名或邮箱");
  }

  const result = await createPasswordResetToken(identifier);

  if (result?.email) {
    const siteUrl = process.env.SITE_URL || "https://whyisee.xyz";

    await sendEmail({
      to: result.email,
      recipientUserId: result.userId,
      subject: "whyisee 密码重置",
      body: `你正在重置 whyisee 账号密码。\n\n${siteUrl}/reset-password?token=${encodeURIComponent(result.token)}\n\n如果不是你本人操作，可以忽略这封邮件。`,
    });
  }

  return ok(c, {
    sent: true,
    // 只有开发环境回 token：线上邮件是真发的，把 token 回给调用方等于绕过邮箱
    debugToken: import.meta.env.DEV ? result?.token : undefined,
  });
});

/**
 * 用邮件里的 token 设新密码。
 *
 * 成功后不动现有会话：重置密码的人多半是在另一台机器上被锁在外面，
 * 家里那台还登着的设备不该因此掉线。
 */
auth.post("/password-reset/confirm", async (c) => {
  const body = await readJson<{ token?: string; password?: string }>(c.req.raw);
  const token = String(body?.token || "").trim();
  const password = String(body?.password || "");

  if (!token) {
    return fail(c, "validation_failed", "缺少重置 token");
  }

  if (password.length < 8) {
    return fail(c, "validation_failed", "密码至少 8 位");
  }

  try {
    await resetPassword(token, password);
    return ok(c, { reset: true });
  } catch {
    // 过期、已用过、token 不对，对用户来说是同一件事：这个链接不能用了
    return fail(c, "validation_failed", "这个重置链接已失效，请重新发起找回");
  }
});

auth.post("/refresh", async (c) => {
  const header = c.req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  if (!token) {
    return fail(c, "unauthorized", "缺少 token");
  }

  const session = await rotateAppSession(token, {
    clientVersion: c.req.header("x-app-version") ?? null,
  });

  if (!session) {
    return fail(c, "token_expired", "登录已失效，请重新登录");
  }

  return ok(c, {
    token: session.sessionId,
    expiresAt: expiresAtIso(appSessionMaxAgeSeconds),
    user: toUserDto(session),
  });
});

/**
 * 网页登录成功后由 WebView 里的注入脚本调用（只认 cookie，不认 Bearer）。
 * 它把网页那条会话标记为 app 会话并延长到 90 天，再把同一个 sessionId 当 token 交给原生。
 * 好处：网页退登，app 立刻失效，不用额外同步。
 */
auth.post("/session-from-cookie", async (c) => {
  const cookieToken = parseCookie(c.req.header("cookie") || "", authCookieName);

  if (!cookieToken) {
    return fail(c, "unauthorized", "没有登录 cookie");
  }

  const expiresAt = await promoteSessionToApp(cookieToken, {
    clientVersion: c.req.header("x-app-version") ?? null,
  });

  if (!expiresAt) {
    return fail(c, "token_expired", "网页会话已失效");
  }

  return ok(c, { token: cookieToken, expiresAt });
});

auth.post("/logout", async (c) => {
  const header = c.req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";

  await revokeSession(token);

  return ok(c, { loggedOut: true });
});

auth.get("/me", async (c) => {
  const session = c.get("session");
  if (!session) return fail(c, "unauthorized", "请先登录");

  const unread = await queryOne<{ count: string }>(
    "SELECT COUNT(*)::text AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL",
    [session.userId],
  );

  return ok(c, {
    user: toUserDto(session),
    unreadCount: Number(unread?.count || 0),
  });
});

function toUserDto(session: AuthSession) {
  return {
    id: session.userId,
    username: session.username,
    displayName: session.displayName,
    avatarUrl: session.avatarUrl,
    email: session.email,
    role: session.role,
    status: session.status,
  };
}

function expiresAtIso(ttlSeconds: number) {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}

function describeDevice(platform?: string, deviceName?: string) {
  const parts = [platform, deviceName].filter(Boolean);
  return parts.length ? parts.join(" / ").slice(0, 200) : "app";
}

async function readJson<T>(request: Request): Promise<T | undefined> {
  try {
    return (await request.json()) as T;
  } catch {
    return undefined;
  }
}

function parseCookie(header: string, name: string) {
  const hit = header
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${name}=`));

  return hit?.slice(name.length + 1);
}

export default auth;
