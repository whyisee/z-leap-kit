import { Hono } from "hono";
import { requestIdMiddleware } from "./middleware";
import { fail, type ApiEnv } from "./http";
import authRoutes from "./routes/auth";
import feedRoutes from "./routes/feed";
import topicRoutes from "./routes/topics";
import interactionRoutes from "./routes/interactions";
import uploadRoutes from "./routes/uploads";
import eventRoutes from "./routes/events";
import aiRoutes from "./routes/ai";
import meRoutes from "./routes/me";
import participationRoutes from "./routes/participation";
import followingRoutes from "./routes/following";
import notificationRoutes from "./routes/notifications";
import adminRoutes from "./routes/admin";
import metaRoutes from "./routes/meta";
import taxonomyRoutes from "./routes/taxonomy";
import searchRoutes from "./routes/search";
import userRoutes from "./routes/users";

/**
 * app 专用协议层。
 *
 * 红线：这里只做参数解析、鉴权、序列化、分页、限流、错误映射。
 * 业务规则一律调 src/server/services/*，不写 SQL、不复制判断逻辑，
 * 否则网页与 app 会慢慢长成两套行为。
 */
const v1 = new Hono<ApiEnv>();

v1.use("*", requestIdMiddleware);

v1.route("/auth", authRoutes);
v1.route("/feed", feedRoutes);
v1.route("/topics", topicRoutes);
v1.route("/interactions", interactionRoutes);
v1.route("/uploads", uploadRoutes);
v1.route("/events", eventRoutes);
v1.route("/ai", aiRoutes);
v1.route("/me", meRoutes);
v1.route("/participation", participationRoutes);
v1.route("/following", followingRoutes);
v1.route("/notifications", notificationRoutes);
v1.route("/admin", adminRoutes);
v1.route("/meta", metaRoutes);
v1.route("/taxonomy", taxonomyRoutes);
v1.route("/search", searchRoutes);
v1.route("/users", userRoutes);

v1.notFound((c) => fail(c, "not_found", "接口不存在"));

v1.onError((error, c) => {
  console.error("[api/v1]", c.req.method, c.req.path, error);
  return fail(c, "server_error", "服务出了点问题，稍后再试");
});

export default v1;
