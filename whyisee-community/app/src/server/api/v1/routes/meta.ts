import { Hono } from "hono";
import { ok, type ApiEnv } from "../http";

const meta = new Hono<ApiEnv>();

/**
 * 客户端启动时拉一次：强制升级阈值、功能开关、接口地址。
 * 值走环境变量，改配置不用发版。
 */
meta.get("/", (c) => {
  return ok(c, {
    minVersion: process.env.APP_MIN_VERSION || "0.1.0",
    latestVersion: process.env.APP_LATEST_VERSION || "0.1.0",
    apiHost: process.env.SITE_URL || "https://whyisee.xyz",
    featureFlags: {
      nativeFeed: process.env.APP_FLAG_NATIVE_FEED !== "0",
      nativeTopic: process.env.APP_FLAG_NATIVE_TOPIC !== "0",
      inAppNotifications: false,
      push: false,
    },
  });
});

export default meta;
