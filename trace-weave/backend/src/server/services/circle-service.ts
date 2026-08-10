import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { evaluateEventPrivacyBatch } from "./privacy-policy-service";

const schema = quoteIdentifier(config.DB_SCHEMA);
const ANONYMITY_THRESHOLD = 3;

export class CircleError extends Error {
  constructor(message: string, readonly statusCode: 400 | 403 | 404 | 409 = 400) { super(message); this.name = "CircleError"; }
}

async function ensureCircles(client: PoolClient) {
  await client.query(
    `INSERT INTO ${schema}.social_circles (id,canonical_entity_id,circle_type,name)
     SELECT gen_random_uuid(), entity.id,
            CASE WHEN entity.entity_type IN ('place','geo_cell') THEN 'place' ELSE 'interest' END,
            CASE WHEN entity.entity_type IN ('place','geo_cell') THEN entity.canonical_name || '地点圈' ELSE entity.canonical_name || '兴趣圈' END
     FROM ${schema}.canonical_entities entity
     WHERE entity.status = 'active' AND entity.match_eligible AND entity.sensitivity = 'normal'
       AND entity.entity_type <> 'person'
     ON CONFLICT (canonical_entity_id,circle_type) DO NOTHING`,
  );
}

export async function listCircles(client: PoolClient, userId: string) {
  await ensureCircles(client);
  const result = await client.query(
    `SELECT circle.id, circle.name, circle.circle_type AS "circleType",
            entity.entity_type AS "entityType", entity.canonical_name AS "entityName",
            count(membership.id) FILTER (WHERE membership.status = 'joined')::int AS "memberCount",
            bool_or(membership.user_id = $1 AND membership.status = 'joined') AS joined
     FROM ${schema}.social_circles circle
     JOIN ${schema}.canonical_entities entity ON entity.id = circle.canonical_entity_id
     LEFT JOIN ${schema}.circle_memberships membership ON membership.circle_id = circle.id
     WHERE circle.status = 'active'
     GROUP BY circle.id, entity.id
     ORDER BY joined DESC, "memberCount" DESC, circle.name LIMIT 200`, [userId],
  );
  return { circles: result.rows, anonymityThreshold: ANONYMITY_THRESHOLD };
}

export async function setCircleMembership(client: PoolClient, userId: string, circleId: string, joined: boolean) {
  const circle = await client.query(`SELECT 1 FROM ${schema}.social_circles WHERE id = $1 AND status = 'active'`, [circleId]);
  if (!circle.rows[0]) throw new CircleError("圈子不存在", 404);
  await client.query(
    `INSERT INTO ${schema}.circle_memberships (id,circle_id,user_id,status)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (circle_id,user_id) DO UPDATE SET status = CASE WHEN ${schema}.circle_memberships.status = 'banned' THEN 'banned' ELSE EXCLUDED.status END, updated_at = now()`,
    [randomUUID(), circleId, userId, joined ? "joined" : "left"],
  );
}

export async function getAnonymousCircleStats(client: PoolClient, userId: string) {
  const joined = await client.query<{ circleId: string; canonicalEntityId: string }>(
    `SELECT circle.id AS "circleId", circle.canonical_entity_id AS "canonicalEntityId"
     FROM ${schema}.circle_memberships membership JOIN ${schema}.social_circles circle ON circle.id = membership.circle_id
     WHERE membership.user_id = $1 AND membership.status = 'joined' AND circle.status = 'active'`, [userId],
  );
  if (!joined.rows.length) return { stats: [], anonymityThreshold: ANONYMITY_THRESHOLD };
  const candidateEvents = await client.query<{ eventId: string; ownerUserId: string; canonicalEntityId: string; occurredAt: string }>(
    `SELECT event.id AS "eventId", event.owner_user_id AS "ownerUserId", relation.canonical_entity_id AS "canonicalEntityId",
            COALESCE(event.occurred_start,event.created_at)::text AS "occurredAt"
     FROM ${schema}.events event JOIN ${schema}.event_entity_relations relation ON relation.event_id = event.id
     WHERE event.deleted_at IS NULL AND event.factual_status IN ('occurred','ongoing')
       AND relation.canonical_entity_id = ANY($1::uuid[])
       AND COALESCE(event.occurred_start,event.created_at) >= now() - interval '60 days'`,
    [joined.rows.map((row) => row.canonicalEntityId)],
  );
  const permitted = new Set<string>();
  const byOwner = new Map<string, string[]>();
  for (const event of candidateEvents.rows) byOwner.set(event.ownerUserId, [...(byOwner.get(event.ownerUserId) ?? []), event.eventId]);
  for (const [ownerId, eventIds] of byOwner) {
    const policies = await evaluateEventPrivacyBatch(client, ownerId, eventIds);
    for (const [eventId, policy] of policies) if (policy.allowAnonymousStats) permitted.add(eventId);
  }
  const stats = joined.rows.flatMap((circle) => {
    const events = candidateEvents.rows.filter((event) => event.canonicalEntityId === circle.canonicalEntityId && permitted.has(event.eventId));
    const users = new Set(events.map((event) => event.ownerUserId));
    if (users.size < ANONYMITY_THRESHOLD) return [];
    const recent = events.filter((event) => new Date(event.occurredAt).getTime() >= Date.now() - 30 * 86_400_000).length;
    return [{ circleId: circle.circleId, participantCountLowerBound: users.size, recentEventCount: recent,
      previousEventCount: events.length - recent, trend: recent - (events.length - recent) }];
  });
  return { stats, anonymityThreshold: ANONYMITY_THRESHOLD };
}

export async function getSocialFeed(client: PoolClient, userId: string) {
  const candidates = await client.query<{ id: string; ownerUserId: string; title: string; eventType: string; occurredDate: string | null; createdAt: string }>(
    `SELECT DISTINCT event.id, event.owner_user_id AS "ownerUserId", event.title, event.event_type AS "eventType",
            event.occurred_start::date::text AS "occurredDate", event.created_at AS "createdAt"
     FROM ${schema}.events event
     WHERE event.owner_user_id <> $1 AND event.deleted_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM ${schema}.social_blocks block WHERE
         (block.blocker_user_id = $1 AND block.blocked_user_id = event.owner_user_id)
         OR (block.blocker_user_id = event.owner_user_id AND block.blocked_user_id = $1))
     ORDER BY event.created_at DESC LIMIT 300`, [userId],
  );
  const byOwner = new Map<string, string[]>();
  for (const event of candidates.rows) byOwner.set(event.ownerUserId, [...(byOwner.get(event.ownerUserId) ?? []), event.id]);
  const policies = new Map<string, string>();
  for (const [ownerId, eventIds] of byOwner) {
    const evaluated = await evaluateEventPrivacyBatch(client, ownerId, eventIds);
    for (const [eventId, policy] of evaluated) policies.set(eventId, policy.contentVisibility);
  }
  const relations = await client.query<{ otherId: string }>(
    `SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END AS "otherId"
     FROM ${schema}.social_connections WHERE (user_low_id = $1 OR user_high_id = $1) AND status IN ('active','muted')`, [userId],
  );
  const friends = new Set(relations.rows.map((row) => row.otherId));
  const circleVisibleResult = await client.query<{ eventId: string }>(
    `SELECT DISTINCT event.id AS "eventId"
     FROM ${schema}.events event
     JOIN ${schema}.event_entity_relations relation ON relation.event_id = event.id
     JOIN ${schema}.social_circles circle ON circle.canonical_entity_id = relation.canonical_entity_id AND circle.status = 'active'
     JOIN ${schema}.circle_memberships mine ON mine.circle_id = circle.id AND mine.user_id = $1 AND mine.status = 'joined'
     JOIN ${schema}.circle_memberships owner_membership ON owner_membership.circle_id = circle.id AND owner_membership.user_id = event.owner_user_id AND owner_membership.status = 'joined'
     WHERE event.id = ANY($2::uuid[])`, [userId, candidates.rows.map((event) => event.id)],
  );
  const circleVisible = new Set(circleVisibleResult.rows.map((row) => row.eventId));
  const visible = candidates.rows.filter((event) => policies.get(event.id) === "public"
    || (friends.has(event.ownerUserId) && policies.get(event.id) === "friends")
    || (circleVisible.has(event.id) && policies.get(event.id) === "circle"));
  const owners = visible.length ? await client.query<{ id: string; username: string; displayName: string }>(
    `SELECT id,username,display_name AS "displayName" FROM ${schema}.users WHERE id = ANY($1::uuid[])`, [[...new Set(visible.map((event) => event.ownerUserId))]],
  ) : { rows: [] };
  const ownerMap = new Map(owners.rows.map((owner) => [owner.id, owner]));
  return { feed: visible.slice(0, 100).map((event) => ({ ...event, owner: ownerMap.get(event.ownerUserId) })) };
}

export async function blockUser(client: PoolClient, userId: string, blockedUserId: string, reason?: string) {
  if (userId === blockedUserId) throw new CircleError("不能拉黑自己");
  const target = await client.query(`SELECT 1 FROM ${schema}.users WHERE id = $1 AND status = 'active'`, [blockedUserId]);
  if (!target.rows[0]) throw new CircleError("用户不存在", 404);
  await client.query(`INSERT INTO ${schema}.social_blocks (id,blocker_user_id,blocked_user_id,reason) VALUES ($1,$2,$3,$4) ON CONFLICT (blocker_user_id,blocked_user_id) DO UPDATE SET reason = EXCLUDED.reason`, [randomUUID(), userId, blockedUserId, reason ?? null]);
  await client.query(`UPDATE ${schema}.social_connections SET status = 'blocked', ended_at = now() WHERE (user_low_id = LEAST($1::uuid,$2::uuid) AND user_high_id = GREATEST($1::uuid,$2::uuid)) AND status <> 'ended'`, [userId, blockedUserId]);
  await client.query(`UPDATE ${schema}.social_matches SET status = 'revoked', updated_at = now() WHERE user_low_id = LEAST($1::uuid,$2::uuid) AND user_high_id = GREATEST($1::uuid,$2::uuid)`, [userId, blockedUserId]);
}

export async function reportUser(client: PoolClient, userId: string, input: { reportedUserId: string; reason: string; details?: string; contextType?: string; contextId?: string }) {
  if (userId === input.reportedUserId) throw new CircleError("不能举报自己");
  const target = await client.query(`SELECT 1 FROM ${schema}.users WHERE id = $1 AND status = 'active'`, [input.reportedUserId]);
  if (!target.rows[0]) throw new CircleError("用户不存在", 404);
  const recent = await client.query<{ count: string }>(`SELECT count(*)::text AS count FROM ${schema}.safety_reports WHERE reporter_user_id = $1 AND created_at >= now() - interval '1 hour'`, [userId]);
  if (Number(recent.rows[0].count) >= 10) throw new CircleError("举报提交过于频繁，请稍后再试", 409);
  await client.query(`INSERT INTO ${schema}.safety_reports (id,reporter_user_id,reported_user_id,reason,details,context_type,context_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [randomUUID(), userId, input.reportedUserId, input.reason, input.details ?? null, input.contextType ?? null, input.contextId ?? null]);
}
