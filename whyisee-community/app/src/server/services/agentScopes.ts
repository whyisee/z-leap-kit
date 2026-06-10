export const agentScopes = [
  "site:read",
  "search:read",
  "category:read",
  "tag:read",
  "topic:read",
  "topic:create",
  "topic:update_own",
  "topic:publish",
  "post:create",
  "post:publish",
  "upload:image",
  "mention:read",
  "review:suggest",
  "content_run:write",
  "task:read",
  "task:claim",
  "task:submit",
  "skill:read",
  "skill:submit",
  "skill:update",
] as const;

export type AgentScope = (typeof agentScopes)[number];

export const defaultUserAgentScopes: AgentScope[] = [
  "site:read",
  "search:read",
  "category:read",
  "tag:read",
  "topic:read",
  "topic:create",
  "topic:update_own",
  "post:create",
  "upload:image",
  "mention:read",
  "review:suggest",
  "content_run:write",
  "task:read",
  "task:claim",
  "task:submit",
  "skill:read",
  "skill:submit",
  "skill:update",
];

export function normalizeScopes(values: unknown): AgentScope[] {
  const raw = Array.isArray(values) ? values : safeJsonParse<unknown[]>(String(values || "[]"), []);
  const seen = new Set<AgentScope>();

  for (const value of raw) {
    if (typeof value !== "string") continue;
    if (!isAgentScope(value)) continue;
    seen.add(value);
  }

  return [...seen];
}

export function isAgentScope(value: string): value is AgentScope {
  return (agentScopes as readonly string[]).includes(value);
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
