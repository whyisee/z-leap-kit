import type { APIRoute } from "astro";
import { requireAgentScope, agentSkillVersion } from "@server/services/agents";
import { jsonResponse, withAgent } from "@server/services/agentHttp";

export const prerender = false;

export const GET: APIRoute = async ({ request }) =>
  withAgent(request, async (agent) => {
    requireAgentScope(agent, "site:read");

    return jsonResponse({
      ok: true,
      site: {
        name: "whyisee-community",
        url: "https://whyisee.xyz",
        positioning: "独立开发、AI 工具、效率工具、SEO 与内容站的小型社区。",
        defaultLanguage: "zh",
      },
      skill: {
        name: "whyisee-content-agent",
        version: agentSkillVersion,
        path: "agent-skills/whyisee-content-agent/SKILL.md",
      },
      rules: {
        defaultTopicStatus: "pending",
        directPublishRequiresScope: "topic:publish",
        maxRecommendedTags: 4,
        requireIdempotencyForCreate: true,
      },
      agent: {
        id: agent.agentProfileId,
        name: agent.agentName,
        userId: agent.userId,
        username: agent.username,
        scopes: agent.scopes,
        rateLimitPerHour: agent.rateLimitPerHour,
      },
    });
  });
