import { execute, query, queryOne } from "../db/client";
import { processNextBotJob } from "./botJobs.ts";
import { createNotification } from "./notifications";

export type MentionSourceType = "topic" | "post";

export interface MentionTarget {
  id: number;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  isBot: boolean;
}

interface MentionTargetRow {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
  is_bot: boolean;
}

interface ActorRow {
  id: number;
  role: string;
  is_bot: boolean;
}

const mentionPattern = /(^|[^a-zA-Z0-9_@./-])@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})\b/g;

export function extractMentionUsernames(markdown: string) {
  const text = stripIgnoredMarkdown(markdown);
  const seen = new Set<string>();
  const usernames: string[] = [];
  let match: RegExpExecArray | null;

  mentionPattern.lastIndex = 0;

  while ((match = mentionPattern.exec(text))) {
    const username = match[2].toLowerCase();

    if (!seen.has(username)) {
      seen.add(username);
      usernames.push(username);
    }
  }

  return usernames;
}

export async function searchMentionTargets(search: string, limit = 8): Promise<MentionTarget[]> {
  const q = search.trim().replace(/^@/, "").toLowerCase().slice(0, 32);
  const like = `%${q}%`;
  const rows = await query<MentionTargetRow>(
    `
    SELECT id, username, display_name, avatar_url, is_bot
    FROM users
    WHERE status = 'active'
      AND (
        $1 = ''
        OR lower(username) LIKE $2
        OR lower(display_name) LIKE $2
      )
    ORDER BY
      is_bot DESC,
      CASE WHEN lower(username) = $1 THEN 0 WHEN lower(username) LIKE ($1 || '%') THEN 1 ELSE 2 END,
      username ASC
    LIMIT $3
    `,
    [q, like, limit],
  );

  return rows.map(mapMentionTarget);
}

export async function syncMentions(input: {
  sourceType: MentionSourceType;
  sourceId: number;
  actorId: number;
  markdown: string;
  title: string;
  body?: string;
  href: string;
  skipUserIds?: number[];
}) {
  const usernames = extractMentionUsernames(input.markdown);
  const targets = await resolveMentionTargets(usernames);
  const targetIds = targets.map((target) => target.id);
  const actor = await queryOne<ActorRow>("SELECT id, role, is_bot FROM users WHERE id = $1 LIMIT 1", [input.actorId]);

  await pruneMentions(input.sourceType, input.sourceId, targetIds);

  if (!actor || targets.length === 0) {
    return;
  }

  const skipUserIds = new Set([input.actorId, ...(input.skipUserIds || [])]);
  const now = new Date().toISOString();

  for (const target of targets) {
    const inserted = await queryOne<{ id: number }>(
      `
      INSERT INTO mentions (source_type, source_id, mentioned_user_id, actor_id, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT(source_type, source_id, mentioned_user_id) DO NOTHING
      RETURNING id
      `,
      [input.sourceType, input.sourceId, target.id, input.actorId, now],
    );

    if (!inserted || skipUserIds.has(target.id)) {
      continue;
    }

    if (target.isBot) {
      await createBotJobIfAllowed({
        actor,
        bot: target,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        markdown: input.markdown,
      });
      continue;
    }

    await createNotification({
      userId: target.id,
      actorId: input.actorId,
      type: "mention",
      targetType: input.sourceType,
      targetId: input.sourceId,
      title: "有人提到了你",
      body: input.body || input.title,
      href: input.href,
    });
  }
}

async function resolveMentionTargets(usernames: string[]) {
  if (usernames.length === 0) {
    return [];
  }

  const rows = await query<MentionTargetRow>(
    `
    SELECT id, username, display_name, avatar_url, is_bot
    FROM users
    WHERE status = 'active' AND lower(username) = ANY($1::text[])
    `,
    [usernames],
  );
  const byUsername = new Map(rows.map((row) => [row.username.toLowerCase(), mapMentionTarget(row)]));

  return usernames.map((username) => byUsername.get(username)).filter((target): target is MentionTarget => Boolean(target));
}

async function pruneMentions(sourceType: MentionSourceType, sourceId: number, targetIds: number[]) {
  if (targetIds.length === 0) {
    await execute("DELETE FROM mentions WHERE source_type = $1 AND source_id = $2", [sourceType, sourceId]);
    return;
  }

  await execute(
    `
    DELETE FROM mentions
    WHERE source_type = $1
      AND source_id = $2
      AND NOT (mentioned_user_id = ANY($3::int[]))
    `,
    [sourceType, sourceId, targetIds],
  );
}

async function createBotJobIfAllowed(input: {
  actor: ActorRow;
  bot: MentionTarget;
  sourceType: MentionSourceType;
  sourceId: number;
  markdown: string;
}) {
  if (input.actor.is_bot) {
    return;
  }

  if (input.bot.username === "mod" && input.actor.role !== "admin" && input.actor.role !== "moderator") {
    return;
  }

  if (input.actor.role !== "admin" && input.actor.role !== "moderator") {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const count = await queryOne<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM bot_jobs WHERE actor_id = $1 AND created_at >= $2",
      [input.actor.id, since],
    );

    if (Number(count?.count || 0) >= 20) {
      return;
    }
  }

  const existing = await queryOne<{ id: number }>(
    `
    SELECT id
    FROM bot_jobs
    WHERE bot_user_id = $1
      AND source_type = $2
      AND source_id = $3
      AND status IN ('queued', 'running')
    LIMIT 1
    `,
    [input.bot.id, input.sourceType, input.sourceId],
  );

  if (existing) {
    return;
  }

  const now = new Date().toISOString();

  await execute(
    `
    INSERT INTO bot_jobs (bot_user_id, source_type, source_id, actor_id, prompt, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, 'queued', $6, $6)
    `,
    [
      input.bot.id,
      input.sourceType,
      input.sourceId,
      input.actor.id,
      extractBotPrompt(input.markdown, input.bot.username),
      now,
    ],
  );

  setTimeout(() => {
    void processNextBotJob().catch((error) => {
      console.error("Failed to process bot job", error);
    });
  }, 0);
}

function extractBotPrompt(markdown: string, username: string) {
  const escaped = username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(^|\\s)@${escaped}\\b\\s*([^\\n]*)`, "i");
  const prompt = stripIgnoredMarkdown(markdown).match(pattern)?.[2]?.trim();

  return prompt || "";
}

function stripIgnoredMarkdown(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1");
}

function mapMentionTarget(row: MentionTargetRow): MentionTarget {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    isBot: Boolean(row.is_bot),
  };
}
