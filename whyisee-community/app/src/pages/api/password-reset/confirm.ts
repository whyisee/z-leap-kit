import type { APIRoute } from "astro";
import { resetPassword } from "@server/services/users";

export const prerender = false;

export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");

  try {
    await resetPassword(token, password);
    return redirect("/login?reset=1", 303);
  } catch (error) {
    console.error("Failed to reset password", error);
    return redirect(`/reset-password?error=1&token=${encodeURIComponent(token)}`, 303);
  }
};
