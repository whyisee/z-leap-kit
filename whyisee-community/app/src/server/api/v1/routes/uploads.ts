import { Hono } from "hono";
import { saveImageUpload } from "@server/services/uploads";
import { takeToken } from "@lib/rateLimit";
import { fail, ok, type ApiContext, type ApiEnv } from "../http";
import { requireAuth } from "../middleware";

const uploads = new Hono<ApiEnv>();

uploads.use("*", requireAuth);

const uploadRateLimit = { limit: 20, windowMs: 60 * 60 * 1000 };

/**
 * 注意：Astro 的 security.checkOrigin 会拦掉没有同源 Origin 的 multipart 请求。
 * 客户端发 multipart 时必须带 `Origin: https://whyisee.xyz`，否则这里根本收不到请求（403）。
 */
uploads.post("/images", async (c) => {
  const session = c.get("session");
  const limit = guard(c, session.userId);
  if (limit) return limit;

  const form = await c.req.formData().catch(() => undefined);
  const file = form?.get("image");

  if (!(file instanceof File)) {
    return fail(c, "validation_failed", "请选择图片文件（字段名 image）");
  }

  try {
    const uploaded = await saveImageUpload(file, session.userId);

    return ok(c, {
      id: uploaded.id,
      url: uploaded.url,
      markdown: uploaded.markdown,
      width: null,
      sizeBytes: uploaded.sizeBytes,
      mimeType: uploaded.mimeType,
    });
  } catch (error) {
    return fail(c, "validation_failed", error instanceof Error ? error.message : "图片上传失败");
  }
});

function guard(c: ApiContext, userId: number) {
  const limit = takeToken(`upload:${userId}`, uploadRateLimit.limit, uploadRateLimit.windowMs);
  if (limit.allowed) return undefined;

  c.header("retry-after", String(limit.retryAfterSeconds));
  return fail(c, "rate_limited", "上传次数超了，过会儿再来");
}

export default uploads;
