import { Hono } from "hono";
import { changeUserPassword } from "@server/services/users";
import { getUserById, updateUserProfile } from "@server/services/users";
import { listUserAgentDevices, unbindUserAgentDevice } from "@server/services/userAgentDevices";
import { execute } from "@server/db/client";
import { fail, ok, type ApiEnv } from "../http";
import { sessionOf } from "../middleware";

const settings = new Hono<ApiEnv>();

/**
 * 公开资料。
 *
 * 只回本人能看的字段（含邮箱），「设置」页要用它回填表单；
 * `/users/:username` 那边是给别人看的版本，不给邮箱。
 */
settings.get("/profile", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const user = await getUserById(session.userId);
  if (!user) return fail(c, "not_found", "账号不存在");

  return ok(c, {
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    email: user.email,
    websiteUrl: user.websiteUrl,
    githubUrl: user.githubUrl,
    locale: user.locale,
  });
});

settings.patch("/profile", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const read = (key: string, fallback = "") =>
    typeof body[key] === "string" ? (body[key] as string) : fallback;

  const displayName = read("displayName").trim();
  if (!displayName) return fail(c, "validation_failed", "昵称不能为空");
  if (displayName.length > 32) return fail(c, "validation_failed", "昵称最多 32 个字");

  const bio = read("bio").trim();
  if (bio.length > 300) return fail(c, "validation_failed", "简介最多 300 个字");

  for (const key of ["avatarUrl", "websiteUrl", "githubUrl"]) {
    const value = read(key).trim();
    // 只收 http(s)：头像地址最终会进 <img src>，放 javascript: 就是给所有人挂 XSS
    if (value && !/^https?:\/\//i.test(value)) {
      return fail(c, "validation_failed", "链接要以 http:// 或 https:// 开头");
    }
  }

  const current = await getUserById(session.userId);
  if (!current) return fail(c, "not_found", "账号不存在");

  await updateUserProfile(session.userId, {
    displayName,
    avatarUrl: read("avatarUrl"),
    bio,
    websiteUrl: read("websiteUrl"),
    githubUrl: read("githubUrl"),
    locale: read("locale", current.locale) === "en" ? "en" : "zh",
  });

  return ok(c, { saved: true });
});

/**
 * 改密码。
 *
 * 成功后把其它会话全部吊销、只留当前这一个 —— 网页那边的做法是直接踢回登录页，
 * 但在 App 里正操作到一半被踢出去很莫名。留当前会话既保住了这次的连续性，
 * 又把「旧密码可能已经被人知道」的风险面收到最小。
 */
settings.post("/password", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const nextPassword = typeof body.nextPassword === "string" ? body.nextPassword : "";

  if (!currentPassword) return fail(c, "validation_failed", "请输入当前密码");
  if (nextPassword.length < 8) return fail(c, "validation_failed", "新密码至少 8 位");

  try {
    await changeUserPassword(session.userId, currentPassword, nextPassword);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Current password is incorrect")) {
      return fail(c, "validation_failed", "当前密码不对");
    }
    if (message.includes("at least 8 characters")) {
      return fail(c, "validation_failed", "新密码至少 8 位");
    }
    if (message.includes("does not have a password")) {
      return fail(c, "validation_failed", "这个账号没有密码，请用第三方登录");
    }
    console.error("App change password failed", error);
    return fail(c, "server_error", "改密码失败，稍后再试");
  }

  await execute(
    "UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND id <> $3 AND revoked_at IS NULL",
    [new Date().toISOString(), session.userId, session.sessionId],
  );

  return ok(c, { saved: true, revokedOthers: true });
});

/** Agent 设备：哪台机器绑着这个账号，以及解绑。 */
settings.get("/agents", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const devices = await listUserAgentDevices(session.userId);

  return ok(c, {
    devices: devices.map((device) => ({
      id: device.id,
      deviceName: device.deviceName,
      agentName: device.agentName,
      status: device.status,
      tokenPrefix: device.tokenPrefix,
      lastSeenAt: device.lastSeenAt,
      lastIpAddress: device.lastIpAddress,
      createdAt: device.createdAt,
    })),
  });
});

/**
 * 解绑设备。
 *
 * 用 POST 而不是 DELETE：Astro 的跨站防护会拦掉没有 Origin 头的 DELETE
 * （`Cross-site DELETE form submissions are forbidden`），而 App 是原生请求、
 * 根本不会带 Origin —— 那样这条接口在手机上永远 403。JSON POST 不受影响。
 */
settings.post("/agents/:id/unbind", async (c) => {
  const session = sessionOf(c);
  if (!session) return fail(c, "unauthorized", "请先登录");

  const id = Number(c.req.param("id"));
  if (!Number.isFinite(id) || id <= 0) return fail(c, "validation_failed", "设备 id 不对");

  // 服务层已经带 userId 过滤，这里再确认一次「是不是他的」不靠客户端传
  const devices = await listUserAgentDevices(session.userId);
  if (!devices.some((device) => device.id === id)) return fail(c, "not_found", "设备不存在");

  await unbindUserAgentDevice(session.userId, id);
  return ok(c, { unbound: true });
});

export default settings;
