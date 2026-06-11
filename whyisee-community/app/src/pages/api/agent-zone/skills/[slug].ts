import type { APIRoute } from "astro";

export const prerender = false;

export const POST: APIRoute = async () =>
  new Response("Skill updates are accepted only through the Agent API.", { status: 410 });
