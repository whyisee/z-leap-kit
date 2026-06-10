import type { APIRoute } from "astro";
import { getSessionFromAstro, isAdmin, safeRedirectPath } from "@lib/auth";
import { runBotTaskNow, updateBotTaskSettings } from "@server/services/botJobs";

export const prerender = false;

export const POST: APIRoute = async (context) => {
  const session = await getSessionFromAstro(context);
  const id = Number(context.params.id || 0);

  if (!session) {
    return context.redirect(`/login?redirect=${encodeURIComponent("/admin/bot-jobs")}`, 303);
  }

  if (!isAdmin(session)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (!Number.isFinite(id) || id <= 0) {
    return context.redirect("/admin/bot-jobs?error=1", 303);
  }

  const formData = await context.request.formData();
  const intent = String(formData.get("intent") || "update");
  const redirect = safeRedirectPath(formData.get("redirect"), "/admin/bot-jobs");
  const selectedBoards = formData
    .getAll("boardSelections")
    .map((value) => String(value).trim())
    .filter(Boolean);
  const customBoards = String(formData.get("boards") || "").trim();
  const boards = [...selectedBoards, customBoards].filter(Boolean).join("\n");

  try {
    if (intent === "run") {
      await runBotTaskNow(id);
      return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}taskProcessed=1`, 303);
    }

    await updateBotTaskSettings({
      id,
      status: formData.get("status") === "paused" ? "paused" : "active",
      scheduleIntervalSeconds: Number(formData.get("scheduleIntervalSeconds") || 60),
      autoApproveMaxRisk: Number(formData.get("autoApproveMaxRisk") || 25),
      autoAcceptMinScore: Number(formData.get("autoAcceptMinScore") || 82),
      autoRejectMaxScore: Number(formData.get("autoRejectMaxScore") || 35),
      batchSize: Number(formData.get("batchSize") || 5),
      dryRun: formData.get("dryRun") === "1",
      sourceUrl: String(formData.get("sourceUrl") || ""),
      apiBaseUrl: String(formData.get("apiBaseUrl") || ""),
      boards,
      maxItems: Number(formData.get("maxItems") || formData.get("batchSize") || 30),
      timeoutMs: Number(formData.get("timeoutMs") || 15000),
      userAgent: String(formData.get("userAgent") || ""),
      windowHours: Number(formData.get("windowHours") || 24),
      minSeenCount: Number(formData.get("minSeenCount") || 1),
      publishMode: String(formData.get("publishMode") || ""),
      categorySlug: String(formData.get("categorySlug") || ""),
      tagNames: String(formData.get("tagNames") || ""),
      style: String(formData.get("style") || ""),
      itemId: Number(formData.get("itemId") || 0),
    });

    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}saved=1`, 303);
  } catch (error) {
    console.error("Failed to update bot task", error);
    return context.redirect(`${redirect}${redirect.includes("?") ? "&" : "?"}error=1`, 303);
  }
};
