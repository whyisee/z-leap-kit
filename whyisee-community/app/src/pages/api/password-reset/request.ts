import type { APIRoute } from "astro";
import { createPasswordResetToken } from "@server/services/users";
import { sendEmail } from "@server/services/mailer";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const identifier = String(formData.get("identifier") || "");
  const result = await createPasswordResetToken(identifier);
  const params = new URLSearchParams({ sent: "1" });

  if (result?.email) {
    const siteUrl = process.env.SITE_URL || "https://whyisee.xyz";
    await sendEmail({
      to: result.email,
      recipientUserId: result.userId,
      subject: "whyisee 密码重置",
      body: `你正在重置 whyisee 账号密码。\n\n${siteUrl}/reset-password?token=${encodeURIComponent(result.token)}\n\n如果不是你本人操作，可以忽略这封邮件。`,
    });
  }

  if (import.meta.env.DEV && result?.token) {
    params.set("debugToken", result.token);
  }

  return redirect(`/forgot-password?${params.toString()}`, 303);
};
