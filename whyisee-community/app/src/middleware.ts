import { defineMiddleware } from "astro:middleware";
import { authCookieName, readSessionId } from "@lib/auth";
import { recordPageView } from "@server/services/analytics";

export const onRequest = defineMiddleware(async (context, next) => {
  const response = await next();

  if (shouldRecordPageView(context.request, context.url.pathname, response)) {
    try {
      const session = await readSessionId(context.cookies.get(authCookieName)?.value);
      await recordPageView({
        path: context.url.pathname,
        method: context.request.method,
        userId: session?.userId,
        ip: context.clientAddress,
        userAgent: context.request.headers.get("user-agent"),
        referrer: context.request.headers.get("referer"),
      });
    } catch (error) {
      console.error("Failed to record page view", error);
    }
  }

  return response;
});

function shouldRecordPageView(request: Request, path: string, response: Response) {
  if (request.method !== "GET" || response.status >= 400) {
    return false;
  }

  if (
    path.startsWith("/api/") ||
    path.startsWith("/_astro/") ||
    path.startsWith("/assets/") ||
    path === "/favicon.ico" ||
    path === "/icon.png" ||
    path.endsWith(".xml")
  ) {
    return false;
  }

  const contentType = response.headers.get("content-type") || "";
  return contentType.includes("text/html");
}
