import "dotenv/config";
import { z } from "zod";

const environmentSchema = z.object({
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  API_HOST: z.string().default("127.0.0.1"),
  API_PORT: z.coerce.number().int().positive().default(8787),
  WEB_ORIGIN: z.string().url().default("http://127.0.0.1:5173"),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive(),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string(),
  DB_SCHEMA: z.string().regex(/^[a-z_][a-z0-9_]*$/),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DEV_USER_ID: z.string().uuid(),
  AUTH_SESSION_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  AUTH_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SOCIAL_MATCH_MIN_SCORE: z.coerce.number().int().min(1).max(99).default(60),
  AI_PROVIDER: z.enum(["mock", "deepseek"]).default("deepseek"),
  DEEPSEEK_API_KEY: z.string().trim().optional(),
  DEEPSEEK_BASE_URL: z.string().url().default("https://api.deepseek.com"),
  DEEPSEEK_MODEL: z.string().trim().min(1).default("deepseek-v4-flash"),
  DEEPSEEK_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(180_000).default(45_000),
  DEEPSEEK_MAX_RETRIES: z.coerce.number().int().min(0).max(4).default(2),
  MEDIA_LOCAL_DIR: z.string().trim().min(1).default("uploads"),
  MEDIA_STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  MEDIA_ENCRYPTION_KEY_ID: z.string().trim().min(1).max(120).default("traceweave-media-v1"),
  MEDIA_ENCRYPTION_KEY: z.string().trim().optional(),
  MEDIA_ENCRYPTION_KEYRING: z.string().trim().optional(),
  MEDIA_S3_REGION: z.string().trim().min(1).default("auto"),
  MEDIA_S3_BUCKET: z.string().trim().optional(),
  MEDIA_S3_ENDPOINT: z.string().url().optional(),
  MEDIA_S3_ACCESS_KEY_ID: z.string().trim().optional(),
  MEDIA_S3_SECRET_ACCESS_KEY: z.string().trim().optional(),
  MEDIA_S3_KMS_KEY_ID: z.string().trim().optional(),
  MEDIA_S3_FORCE_PATH_STYLE: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  MEDIA_SCAN_MODE: z.enum(["off", "clamav"]).default("off"),
  CLAMAV_HOST: z.string().trim().optional(),
  CLAMAV_PORT: z.coerce.number().int().min(1).max(65535).default(3310),
  MEDIA_MAX_BYTES: z.coerce.number().int().min(1024).max(100 * 1024 * 1024).default(25 * 1024 * 1024),
  MEDIA_MAX_FILES: z.coerce.number().int().min(1).max(30).default(12),
  MEDIA_MAX_TOTAL_BYTES: z.coerce
    .number()
    .int()
    .min(1024)
    .max(500 * 1024 * 1024)
    .default(100 * 1024 * 1024),
  NOTIFICATION_SWEEP_SECONDS: z.coerce.number().int().min(15).max(3600).default(60),
  OUTBOX_SWEEP_SECONDS: z.coerce.number().int().min(1).max(300).default(2),
  OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(100).default(20),
  OUTBOX_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(50).default(8),
  DELETION_SWEEP_SECONDS: z.coerce.number().int().min(1).max(300).default(3),
  DELETION_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(20).default(5),
  WEB_PUSH_VAPID_SUBJECT: z.string().trim().default("mailto:admin@example.com"),
  WEB_PUSH_VAPID_PUBLIC_KEY: z.string().trim().optional(),
  WEB_PUSH_VAPID_PRIVATE_KEY: z.string().trim().optional(),
  STT_PROVIDER: z.enum(["disabled", "openai_compatible"]).default("disabled"),
  STT_BASE_URL: z.string().url().default("https://api.openai.com/v1"),
  STT_API_KEY: z.string().trim().optional(),
  STT_MODEL: z.string().trim().min(1).default("whisper-1"),
  STT_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(300_000).default(120_000),
  METRICS_TOKEN: z.string().trim().min(24).optional(),
}).superRefine((environment, context) => {
  if (environment.APP_ENV === "production" && !environment.AUTH_COOKIE_SECURE) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["AUTH_COOKIE_SECURE"],
      message: "production 环境必须启用 Secure 会话 Cookie",
    });
  }
  if (environment.MEDIA_ENCRYPTION_KEY) {
    const decoded = Buffer.from(environment.MEDIA_ENCRYPTION_KEY, "base64");
    if (decoded.byteLength !== 32) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["MEDIA_ENCRYPTION_KEY"],
        message: "MEDIA_ENCRYPTION_KEY 必须是 32 字节密钥的 Base64 编码",
      });
    }
  }
  if (environment.MEDIA_ENCRYPTION_KEYRING) {
    try {
      const keyring = JSON.parse(environment.MEDIA_ENCRYPTION_KEYRING) as Record<string, unknown>;
      if (!keyring || Array.isArray(keyring) || typeof keyring !== "object" || Object.values(keyring).some((value) => typeof value !== "string" || Buffer.from(value, "base64").byteLength !== 32)) throw new Error();
    } catch {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["MEDIA_ENCRYPTION_KEYRING"], message: "媒体历史密钥环必须是 keyId 到 32 字节 Base64 密钥的 JSON 对象" });
    }
  }
  if (environment.MEDIA_STORAGE_PROVIDER === "s3" && !environment.MEDIA_S3_BUCKET) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["MEDIA_S3_BUCKET"], message: "S3 存储必须配置 bucket" });
  }
  if (environment.MEDIA_SCAN_MODE === "clamav" && !environment.CLAMAV_HOST) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["CLAMAV_HOST"], message: "ClamAV 扫描必须配置主机" });
  }
  if (environment.APP_ENV === "production") {
    if (environment.MEDIA_STORAGE_PROVIDER !== "s3") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["MEDIA_STORAGE_PROVIDER"], message: "生产环境必须使用私有 S3 兼容对象存储" });
    }
    if (!environment.MEDIA_ENCRYPTION_KEY) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["MEDIA_ENCRYPTION_KEY"], message: "生产环境必须启用媒体信封加密" });
    }
    if (!environment.MEDIA_S3_KMS_KEY_ID) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["MEDIA_S3_KMS_KEY_ID"], message: "生产环境必须配置对象存储 KMS 密钥" });
    }
    if (environment.MEDIA_SCAN_MODE !== "clamav") {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["MEDIA_SCAN_MODE"], message: "生产环境必须启用恶意文件扫描" });
    }
    if (!environment.WEB_PUSH_VAPID_PUBLIC_KEY || !environment.WEB_PUSH_VAPID_PRIVATE_KEY) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["WEB_PUSH_VAPID_PUBLIC_KEY"], message: "生产环境必须配置 Web Push VAPID 密钥" });
    }
    if (!environment.METRICS_TOKEN) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["METRICS_TOKEN"], message: "生产环境必须配置指标接口令牌" });
    }
  }
  if (Boolean(environment.WEB_PUSH_VAPID_PUBLIC_KEY) !== Boolean(environment.WEB_PUSH_VAPID_PRIVATE_KEY)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["WEB_PUSH_VAPID_PUBLIC_KEY"], message: "VAPID 公钥和私钥必须同时配置" });
  }
  if (environment.STT_PROVIDER === "openai_compatible" && !environment.STT_API_KEY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["STT_API_KEY"], message: "后端语音转写必须配置 API Key" });
  }
});

const parsed = environmentSchema.safeParse(process.env);

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const config = parsed.data;

export function quoteIdentifier(identifier: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(identifier)) {
    throw new Error(`Unsafe SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}
