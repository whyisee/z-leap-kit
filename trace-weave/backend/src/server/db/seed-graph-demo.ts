import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { closePool, pool } from "./pool";
import { refreshSocialProjectionsForUser } from "../services/social-service";

const schema = quoteIdentifier(config.DB_SCHEMA);
const dataset = "relationship-graph-demo-v1";

function stableUuid(key: string): string {
  const chars = createHash("sha256").update(`trace-weave:${dataset}:${key}`).digest("hex").slice(0, 32).split("");
  chars[12] = "4";
  chars[16] = ((Number.parseInt(chars[16], 16) & 0x3) | 0x8).toString(16);
  const hex = chars.join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function normalizeName(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

type DemoUser = { id: string; username: string; displayName: string };
type DemoEntity = {
  name: string;
  type: string;
  role: string;
  quantity?: number;
  unit?: string;
  amount?: number;
  currency?: string;
};
type DemoEvent = {
  key: string;
  owner: DemoUser;
  title: string;
  eventType: string;
  occurredAt: string;
  entities: DemoEntity[];
  participants?: DemoUser[];
  location?: {
    label: string;
    latitude: number;
    longitude: number;
    exactGeohash: string;
    socialCell: string;
  };
};

async function ensureDemoUser(
  client: PoolClient,
  username: string,
  displayName: string,
): Promise<DemoUser> {
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM ${schema}.users WHERE lower(username) = lower($1) LIMIT 1`,
    [username],
  );
  const id = existing.rows[0]?.id ?? stableUuid(`user:${username}`);
  await client.query(
    `
      INSERT INTO ${schema}.users (id, username, display_name, status, settings)
      VALUES ($1, $2, $3, 'active', $4::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET display_name = EXCLUDED.display_name,
          status = 'active',
          settings = ${schema}.users.settings || EXCLUDED.settings,
          updated_at = now()
    `,
    [id, username, displayName, JSON.stringify({ demoDataset: dataset })],
  );
  await client.query(
    `
      INSERT INTO ${schema}.privacy_policies (
        id, owner_user_id, policy_level, subject_key, content_visibility,
        allow_anonymous_stats, allow_matching, allow_identity_disclosure,
        allow_shared_occurrence, version
      ) VALUES ($1, $2, 'user_default', '*', 'private', true, true, true, true, 1)
      ON CONFLICT (owner_user_id, policy_level, subject_key) DO UPDATE
      SET allow_anonymous_stats = true,
          allow_matching = true,
          allow_identity_disclosure = true,
          allow_shared_occurrence = true,
          version = ${schema}.privacy_policies.version + 1,
          revoked_at = NULL,
          updated_at = now()
    `,
    [stableUuid(`privacy:${username}`), id],
  );
  return { id, username, displayName };
}

async function ensureCanonicalEntity(
  client: PoolClient,
  entityType: string,
  name: string,
): Promise<string> {
  const normalized = normalizeName(name);
  const existing = await client.query<{ id: string }>(
    `
      SELECT id FROM ${schema}.canonical_entities
      WHERE entity_type = $1 AND normalized_name = $2 AND status = 'active'
      ORDER BY created_at LIMIT 1
    `,
    [entityType, normalized],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const id = stableUuid(`canonical:${entityType}:${normalized}`);
  await client.query(
    `
      INSERT INTO ${schema}.canonical_entities (
        id, entity_type, canonical_name, normalized_name, status,
        sensitivity, match_eligible, metadata
      ) VALUES ($1, $2, $3, $4, 'active', 'normal', true, $5::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET canonical_name = EXCLUDED.canonical_name,
          status = 'active',
          match_eligible = true,
          metadata = ${schema}.canonical_entities.metadata || EXCLUDED.metadata,
          updated_at = now()
    `,
    [id, entityType, name, normalized, JSON.stringify({ demoDataset: dataset })],
  );
  return id;
}

async function ensureUserEntity(
  client: PoolClient,
  owner: DemoUser,
  entityType: string,
  name: string,
  canonicalEntityId: string,
): Promise<string> {
  const normalized = normalizeName(name);
  const existing = await client.query<{ id: string }>(
    `
      SELECT id FROM ${schema}.user_entities
      WHERE owner_user_id = $1 AND entity_type = $2 AND normalized_name = $3 AND status = 'active'
      LIMIT 1
    `,
    [owner.id, entityType, normalized],
  );
  const id = existing.rows[0]?.id ?? stableUuid(`user-entity:${owner.id}:${entityType}:${normalized}`);
  await client.query(
    `
      INSERT INTO ${schema}.user_entities (
        id, owner_user_id, canonical_entity_id, entity_type, display_name,
        normalized_name, visibility, match_eligible, sensitivity, status, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, 'private', true, 'normal', 'active', $7::jsonb)
      ON CONFLICT (id) DO UPDATE
      SET canonical_entity_id = EXCLUDED.canonical_entity_id,
          display_name = EXCLUDED.display_name,
          match_eligible = true,
          status = 'active',
          metadata = ${schema}.user_entities.metadata || EXCLUDED.metadata,
          updated_at = now()
    `,
    [id, owner.id, canonicalEntityId, entityType, name, normalized, JSON.stringify({ demoDataset: dataset })],
  );
  return id;
}

async function upsertDemoEvent(client: PoolClient, event: DemoEvent, seedNamespace: string): Promise<string> {
  const eventSeedKey = `${seedNamespace}:${event.key}`;
  const rawEntryId = stableUuid(`raw-entry:${eventSeedKey}`);
  const rawContentId = stableUuid(`raw-content:${eventSeedKey}`);
  const eventId = stableUuid(`event:${eventSeedKey}`);
  await client.query(
    `
      INSERT INTO ${schema}.raw_entries (
        id, owner_user_id, status, client_timezone, client_created_at, confirmed_at
      ) VALUES ($1, $2, 'confirmed', 'Asia/Shanghai', $3::timestamptz, now())
      ON CONFLICT (id) DO UPDATE
      SET owner_user_id = EXCLUDED.owner_user_id,
          status = 'confirmed',
          client_created_at = EXCLUDED.client_created_at,
          confirmed_at = COALESCE(${schema}.raw_entries.confirmed_at, now()),
          deleted_at = NULL,
          updated_at = now()
    `,
    [rawEntryId, event.owner.id, event.occurredAt],
  );
  await client.query(
    `
      INSERT INTO ${schema}.raw_entry_contents (
        id, raw_entry_id, position, content_kind, text_content
      ) VALUES ($1, $2, 0, 'text', $3)
      ON CONFLICT (id) DO UPDATE SET text_content = EXCLUDED.text_content
    `,
    [rawContentId, rawEntryId, event.title],
  );
  await client.query(
    `
      INSERT INTO ${schema}.events (
        id, owner_user_id, raw_entry_id, event_type, event_schema_version,
        title, factual_status, occurred_start, time_precision, timezone,
        overall_confidence, extensions, version
      ) VALUES ($1, $2, $3, $4, 'event/v1', $5, 'occurred', $6::timestamptz,
                'minute', 'Asia/Shanghai', 1, $7::jsonb, 1)
      ON CONFLICT (id) DO UPDATE
      SET title = EXCLUDED.title,
          event_type = EXCLUDED.event_type,
          occurred_start = EXCLUDED.occurred_start,
          factual_status = 'occurred',
          deleted_at = NULL,
          extensions = ${schema}.events.extensions || EXCLUDED.extensions,
          updated_at = now()
    `,
    [eventId, event.owner.id, rawEntryId, event.eventType, event.title, event.occurredAt, JSON.stringify({ demoDataset: dataset })],
  );
  await client.query(
    `
      INSERT INTO ${schema}.event_revisions (
        id, event_id, owner_user_id, version, operation, snapshot, changed_fields
      ) VALUES ($1, $2, $3, 1, 'created', $4::jsonb, '[]'::jsonb)
      ON CONFLICT (event_id, version) DO NOTHING
    `,
    [
      stableUuid(`event-revision:${eventSeedKey}`),
      eventId,
      event.owner.id,
      JSON.stringify({ title: event.title, eventType: event.eventType, occurredStart: event.occurredAt, demoDataset: dataset }),
    ],
  );

  for (const [index, entity] of event.entities.entries()) {
    const canonicalId = await ensureCanonicalEntity(client, entity.type, entity.name);
    const userEntityId = await ensureUserEntity(client, event.owner, entity.type, entity.name, canonicalId);
    await client.query(
      `
        INSERT INTO ${schema}.event_entity_relations (
          id, event_id, user_entity_id, canonical_entity_id, relation_role,
          quantity, unit, amount, currency, confidence, attributes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET user_entity_id = EXCLUDED.user_entity_id,
            canonical_entity_id = EXCLUDED.canonical_entity_id,
            relation_role = EXCLUDED.relation_role,
            quantity = EXCLUDED.quantity,
            unit = EXCLUDED.unit,
            amount = EXCLUDED.amount,
            currency = EXCLUDED.currency,
            attributes = EXCLUDED.attributes
      `,
      [
        stableUuid(`event-entity:${eventSeedKey}:${index}`),
        eventId,
        userEntityId,
        canonicalId,
        entity.role,
        entity.quantity ?? null,
        entity.unit ?? null,
        entity.amount ?? null,
        entity.currency ?? null,
        JSON.stringify({ demoDataset: dataset }),
      ],
    );
  }

  for (const [index, participant] of (event.participants ?? []).entries()) {
    await client.query(
      `
        INSERT INTO ${schema}.event_participants (
          id, event_id, account_user_id, participant_role, identity_confirmed, attributes
        ) VALUES ($1, $2, $3, 'companion', true, $4::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET account_user_id = EXCLUDED.account_user_id,
            participant_role = EXCLUDED.participant_role,
            identity_confirmed = true,
            attributes = EXCLUDED.attributes
      `,
      [
        stableUuid(`event-participant:${eventSeedKey}:${index}`),
        eventId,
        participant.id,
        JSON.stringify({ demoDataset: dataset, identitySource: "demo_confirmed" }),
      ],
    );
  }

  if (event.location) {
    const observationId = stableUuid(`location:${eventSeedKey}`);
    await client.query(
      `
        INSERT INTO ${schema}.location_observations (
          id, raw_entry_id, owner_user_id, latitude, longitude, accuracy_m,
          captured_at, source, user_label, default_event_role, exact_geohash,
          social_cell, sensitivity, match_eligible, technical_metadata
        ) VALUES ($1, $2, $3, $4, $5, 25, $6::timestamptz, 'manual_pin', $7,
                  'occurred_at', $8, $9, 'normal', true, $10::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET latitude = EXCLUDED.latitude,
            longitude = EXCLUDED.longitude,
            user_label = EXCLUDED.user_label,
            social_cell = EXCLUDED.social_cell,
            match_eligible = true,
            deleted_at = NULL,
            updated_at = now()
      `,
      [
        observationId,
        rawEntryId,
        event.owner.id,
        event.location.latitude,
        event.location.longitude,
        event.occurredAt,
        event.location.label,
        event.location.exactGeohash,
        event.location.socialCell,
        JSON.stringify({ demoDataset: dataset }),
      ],
    );
    await client.query(
      `
        INSERT INTO ${schema}.event_location_links (
          id, event_id, location_observation_id, location_role,
          user_confirmed, confidence, social_match_eligible, attributes
        ) VALUES ($1, $2, $3, 'occurred_at', true, 1, true, $4::jsonb)
        ON CONFLICT (event_id, location_observation_id, location_role) DO UPDATE
        SET user_confirmed = true,
            social_match_eligible = true,
            attributes = EXCLUDED.attributes
      `,
      [stableUuid(`event-location:${eventSeedKey}`), eventId, observationId, JSON.stringify({ demoDataset: dataset })],
    );
  }

  await client.query(
    `
      INSERT INTO ${schema}.privacy_policies (
        id, owner_user_id, policy_level, subject_key, content_visibility,
        allow_anonymous_stats, allow_matching, allow_identity_disclosure,
        allow_shared_occurrence, version
      ) VALUES ($1, $2, 'event', $3, 'private', true, true, true, true, 1)
      ON CONFLICT (owner_user_id, policy_level, subject_key) DO UPDATE
      SET allow_anonymous_stats = true,
          allow_matching = true,
          allow_identity_disclosure = true,
          allow_shared_occurrence = true,
          version = ${schema}.privacy_policies.version + 1,
          revoked_at = NULL,
          updated_at = now()
    `,
    [stableUuid(`event-privacy:${eventSeedKey}`), event.owner.id, eventId],
  );
  return eventId;
}

async function upsertOccurrence(
  client: PoolClient,
  seedNamespace: string,
  key: string,
  creator: DemoUser,
  occurredAt: string,
  title: string,
  members: DemoUser[],
  eventIds: Array<{ eventId: string; ownerId: string }>,
): Promise<void> {
  const occurrenceSeedKey = `${seedNamespace}:${key}`;
  const occurrenceId = stableUuid(`occurrence:${occurrenceSeedKey}`);
  await client.query(
    `
      INSERT INTO ${schema}.shared_occurrences (
        id, status, occurred_start, time_precision, shared_facts, created_by_user_id
      ) VALUES ($1, 'active', $2::timestamptz, 'minute', $3::jsonb, $4)
      ON CONFLICT (id) DO UPDATE
      SET status = 'active',
          occurred_start = EXCLUDED.occurred_start,
          shared_facts = EXCLUDED.shared_facts,
          updated_at = now()
    `,
    [occurrenceId, occurredAt, JSON.stringify({ title, demoDataset: dataset }), creator.id],
  );
  const permissions = JSON.stringify({ eventTitle: true, entities: true, coarseTime: true, coarseLocation: true });
  for (const member of members) {
    await client.query(
      `
        INSERT INTO ${schema}.occurrence_memberships (
          id, occurrence_id, user_id, membership_status, shared_fact_permissions,
          invited_by_user_id, responded_at
        ) VALUES ($1, $2, $3, 'accepted', $4::jsonb, $5, now())
        ON CONFLICT (occurrence_id, user_id) DO UPDATE
        SET membership_status = 'accepted',
            shared_fact_permissions = EXCLUDED.shared_fact_permissions,
            responded_at = now()
      `,
      [stableUuid(`occurrence-member:${occurrenceSeedKey}:${member.id}`), occurrenceId, member.id, permissions, creator.id],
    );
  }
  for (const item of eventIds) {
    await client.query(
      `
        INSERT INTO ${schema}.event_occurrence_links (
          id, event_id, occurrence_id, owner_user_id, link_status
        ) VALUES ($1, $2, $3, $4, 'active')
        ON CONFLICT (event_id, occurrence_id) DO UPDATE SET link_status = 'active'
      `,
      [stableUuid(`occurrence-event:${occurrenceSeedKey}:${item.eventId}`), item.eventId, occurrenceId, item.ownerId],
    );
  }
}

async function makeConnectedShowcase(
  client: PoolClient,
  viewer: DemoUser,
  connectedUser: DemoUser,
  pendingUser: DemoUser,
): Promise<void> {
  const connectedMatch = await client.query<{ id: string; low: string; high: string }>(
    `
      SELECT id, user_low_id AS low, user_high_id AS high
      FROM ${schema}.social_matches
      WHERE (user_low_id = $1 AND user_high_id = $2)
         OR (user_low_id = $2 AND user_high_id = $1)
      LIMIT 1
    `,
    [viewer.id, connectedUser.id],
  );
  if (connectedMatch.rows[0]) {
    const match = connectedMatch.rows[0];
    await client.query(`UPDATE ${schema}.social_matches SET status = 'connected', updated_at = now() WHERE id = $1`, [match.id]);
    for (const user of [viewer, connectedUser]) {
      for (const consentType of ["reveal_identity", "connect"] as const) {
        await client.query(
          `
            INSERT INTO ${schema}.match_consents (id, match_id, user_id, consent_type, status)
            VALUES ($1, $2, $3, $4, 'granted')
            ON CONFLICT (match_id, user_id, consent_type) DO UPDATE
            SET status = 'granted', decided_at = now()
          `,
          [stableUuid(`match-consent:${match.id}:${user.id}:${consentType}`), match.id, user.id, consentType],
        );
      }
    }
    await client.query(
      `
        INSERT INTO ${schema}.social_connections (
          id, match_id, user_low_id, user_high_id, status, settings
        ) VALUES ($1, $2, $3, $4, 'active', $5::jsonb)
        ON CONFLICT (match_id) DO UPDATE SET status = 'active', ended_at = NULL
      `,
      [stableUuid(`connection:${match.id}`), match.id, match.low, match.high, JSON.stringify({ demoDataset: dataset })],
    );
  }

  const pendingMatch = await client.query<{ id: string }>(
    `
      SELECT id FROM ${schema}.social_matches
      WHERE (user_low_id = $1 AND user_high_id = $2)
         OR (user_low_id = $2 AND user_high_id = $1)
      LIMIT 1
    `,
    [viewer.id, pendingUser.id],
  );
  if (pendingMatch.rows[0]) {
    const matchId = pendingMatch.rows[0].id;
    await client.query(`UPDATE ${schema}.social_matches SET status = 'contact_pending', updated_at = now() WHERE id = $1`, [matchId]);
    await client.query(
      `
        INSERT INTO ${schema}.match_consents (id, match_id, user_id, consent_type, status)
        VALUES ($1, $2, $3, 'connect', 'granted')
        ON CONFLICT (match_id, user_id, consent_type) DO UPDATE
        SET status = 'granted', decided_at = now()
      `,
      [stableUuid(`match-consent:${matchId}:${viewer.id}:connect`), matchId, viewer.id],
    );
  }
}

async function seed(): Promise<void> {
  const targetUsername = (process.argv[2] ?? "whyisee").trim().toLocaleLowerCase("zh-CN");
  const targetResult = await pool.query<{ id: string; username: string; displayName: string }>(
    `SELECT id, username, display_name AS "displayName" FROM ${schema}.users WHERE lower(username) = $1 AND status = 'active' LIMIT 1`,
    [targetUsername],
  );
  const viewer = targetResult.rows[0];
  if (!viewer) throw new Error(`找不到活动账号 ${targetUsername}`);

  const client = await pool.connect();
  await client.query("BEGIN");
  try {
    const lin = await ensureDemoUser(client, "demo_lin_xiao", "林晓 · 演示用户");
    const chen = await ensureDemoUser(client, "demo_chen_yu", "陈屿 · 演示用户");
    const su = await ensureDemoUser(client, "demo_su_nian", "苏念 · 演示用户");

    const cafe = { label: "梧桐咖啡馆", latitude: 30.2741, longitude: 120.1551, exactGeohash: "wtmkn2c", socialCell: "wtmkn2" };
    const park = { label: "旗山湖公园", latitude: 30.4102, longitude: 119.9784, exactGeohash: "wtmk8q1", socialCell: "wtmk8q" };
    const noodleShop = { label: "兰亭面馆", latitude: 30.2687, longitude: 120.1692, exactGeohash: "wtmkn6d", socialCell: "wtmkn6" };
    const events: DemoEvent[] = [
      { key: "viewer-brunch", owner: viewer, title: "周六和林晓、陈屿在梧桐咖啡馆吃早午餐", eventType: "eat", occurredAt: "2026-08-08T03:30:00.000Z", participants: [lin, chen], location: cafe, entities: [
        { name: "梧桐咖啡馆", type: "place", role: "occurred_at" },
        { name: "手冲咖啡", type: "drink", role: "consumed", quantity: 1, unit: "杯", amount: 32, currency: "CNY" },
        { name: "牛油果吐司", type: "food", role: "consumed", quantity: 1, unit: "份", amount: 46, currency: "CNY" },
      ] },
      { key: "viewer-video", owner: viewer, title: "在哔哩哔哩看了一个大理旅行 Vlog", eventType: "watch", occurredAt: "2026-08-07T12:40:00.000Z", entities: [
        { name: "哔哩哔哩", type: "app", role: "used" }, { name: "大理旅行 Vlog", type: "video", role: "watched" },
      ] },
      { key: "viewer-game", owner: viewer, title: "晚上玩了两小时《黑神话：悟空》", eventType: "play", occurredAt: "2026-08-06T13:10:00.000Z", entities: [
        { name: "黑神话：悟空", type: "game", role: "played", quantity: 2, unit: "小时" },
      ] },
      { key: "viewer-book", owner: viewer, title: "读完《人类简史》的最后三章", eventType: "read", occurredAt: "2026-08-05T13:20:00.000Z", entities: [
        { name: "人类简史", type: "book", role: "read" },
      ] },
      { key: "viewer-song", owner: viewer, title: "在网易云音乐循环听《夜曲》", eventType: "listen", occurredAt: "2026-08-04T14:00:00.000Z", entities: [
        { name: "网易云音乐", type: "app", role: "used" }, { name: "夜曲", type: "song", role: "listened_to" },
      ] },
      { key: "viewer-run", owner: viewer, title: "傍晚去旗山湖公园跑了五公里", eventType: "exercise", occurredAt: "2026-08-03T10:15:00.000Z", location: park, entities: [
        { name: "旗山湖公园", type: "place", role: "occurred_at" }, { name: "跑步", type: "activity", role: "performed", quantity: 5, unit: "公里" },
      ] },
      { key: "viewer-dinner", owner: viewer, title: "和苏念在兰亭面馆吃红烧牛肉面", eventType: "eat", occurredAt: "2026-08-09T10:30:00.000Z", participants: [su], location: noodleShop, entities: [
        { name: "兰亭面馆", type: "place", role: "occurred_at" }, { name: "红烧牛肉面", type: "food", role: "consumed", quantity: 1, unit: "碗", amount: 28, currency: "CNY" },
      ] },
      { key: "viewer-podcast", owner: viewer, title: "散步时用小宇宙听《忽左忽右》", eventType: "listen", occurredAt: "2026-08-02T11:00:00.000Z", entities: [
        { name: "小宇宙", type: "app", role: "used" }, { name: "忽左忽右", type: "podcast", role: "listened_to" },
      ] },
      { key: "lin-brunch", owner: lin, title: "和 whyisee、陈屿在梧桐咖啡馆吃早午餐", eventType: "eat", occurredAt: "2026-08-08T03:30:00.000Z", participants: [viewer, chen], location: cafe, entities: [
        { name: "梧桐咖啡馆", type: "place", role: "occurred_at" }, { name: "手冲咖啡", type: "drink", role: "consumed" }, { name: "牛油果吐司", type: "food", role: "consumed" },
      ] },
      { key: "lin-book", owner: lin, title: "重读《人类简史》", eventType: "read", occurredAt: "2026-08-01T13:00:00.000Z", entities: [{ name: "人类简史", type: "book", role: "read" }] },
      { key: "lin-song", owner: lin, title: "在网易云音乐听《夜曲》", eventType: "listen", occurredAt: "2026-08-04T14:20:00.000Z", entities: [{ name: "网易云音乐", type: "app", role: "used" }, { name: "夜曲", type: "song", role: "listened_to" }] },
      { key: "lin-podcast", owner: lin, title: "通勤时在小宇宙听《忽左忽右》", eventType: "listen", occurredAt: "2026-08-02T00:20:00.000Z", entities: [{ name: "小宇宙", type: "app", role: "used" }, { name: "忽左忽右", type: "podcast", role: "listened_to" }] },
      { key: "chen-brunch", owner: chen, title: "和 whyisee、林晓在梧桐咖啡馆聚餐", eventType: "eat", occurredAt: "2026-08-08T03:35:00.000Z", participants: [viewer, lin], location: cafe, entities: [
        { name: "梧桐咖啡馆", type: "place", role: "occurred_at" }, { name: "手冲咖啡", type: "drink", role: "consumed" }, { name: "牛油果吐司", type: "food", role: "consumed" },
      ] },
      { key: "chen-game", owner: chen, title: "玩《黑神话：悟空》打过了新 Boss", eventType: "play", occurredAt: "2026-08-06T14:00:00.000Z", entities: [{ name: "黑神话：悟空", type: "game", role: "played" }] },
      { key: "chen-run", owner: chen, title: "在旗山湖公园夜跑", eventType: "exercise", occurredAt: "2026-08-03T10:30:00.000Z", location: park, entities: [{ name: "旗山湖公园", type: "place", role: "occurred_at" }, { name: "跑步", type: "activity", role: "performed" }] },
      { key: "chen-video", owner: chen, title: "在哔哩哔哩收藏了大理旅行 Vlog", eventType: "watch", occurredAt: "2026-08-07T13:10:00.000Z", entities: [{ name: "哔哩哔哩", type: "app", role: "used" }, { name: "大理旅行 Vlog", type: "video", role: "watched" }] },
      { key: "su-dinner", owner: su, title: "和 whyisee 在兰亭面馆吃红烧牛肉面", eventType: "eat", occurredAt: "2026-08-09T10:32:00.000Z", participants: [viewer], location: noodleShop, entities: [
        { name: "兰亭面馆", type: "place", role: "occurred_at" }, { name: "红烧牛肉面", type: "food", role: "consumed" },
      ] },
      { key: "su-video", owner: su, title: "在哔哩哔哩看大理旅行 Vlog", eventType: "watch", occurredAt: "2026-08-07T13:30:00.000Z", entities: [{ name: "哔哩哔哩", type: "app", role: "used" }, { name: "大理旅行 Vlog", type: "video", role: "watched" }] },
      { key: "su-song", owner: su, title: "用网易云音乐听《夜曲》", eventType: "listen", occurredAt: "2026-08-04T14:40:00.000Z", entities: [{ name: "网易云音乐", type: "app", role: "used" }, { name: "夜曲", type: "song", role: "listened_to" }] },
      { key: "su-book", owner: su, title: "开始看《人类简史》", eventType: "read", occurredAt: "2026-08-05T13:40:00.000Z", entities: [{ name: "人类简史", type: "book", role: "read" }] },
    ];

    const eventIds = new Map<string, string>();
    const seedNamespace = `viewer:${viewer.id}`;
    for (const event of events) eventIds.set(event.key, await upsertDemoEvent(client, event, seedNamespace));
    await upsertOccurrence(client, seedNamespace, "cafe-brunch", viewer, "2026-08-08T03:30:00.000Z", "梧桐咖啡馆早午餐", [viewer, lin, chen], [
      { eventId: eventIds.get("viewer-brunch")!, ownerId: viewer.id },
      { eventId: eventIds.get("lin-brunch")!, ownerId: lin.id },
      { eventId: eventIds.get("chen-brunch")!, ownerId: chen.id },
    ]);
    await upsertOccurrence(client, seedNamespace, "noodle-dinner", viewer, "2026-08-09T10:30:00.000Z", "兰亭面馆晚餐", [viewer, su], [
      { eventId: eventIds.get("viewer-dinner")!, ownerId: viewer.id },
      { eventId: eventIds.get("su-dinner")!, ownerId: su.id },
    ]);

    for (const user of [lin, chen, su, viewer]) await refreshSocialProjectionsForUser(client, user.id);
    await makeConnectedShowcase(client, viewer, lin, chen);
    await client.query("COMMIT");

    const summary = await client.query<{
      eventCount: number;
      canonicalCount: number;
      matchCount: number;
      occurrenceCount: number;
    }>(
      `
        SELECT
          (SELECT count(*)::int FROM ${schema}.events WHERE owner_user_id = $1 AND deleted_at IS NULL) AS "eventCount",
          (SELECT count(DISTINCT relation.canonical_entity_id)::int
             FROM ${schema}.event_entity_relations relation
             JOIN ${schema}.events event ON event.id = relation.event_id
            WHERE event.owner_user_id = $1 AND event.deleted_at IS NULL) AS "canonicalCount",
          (SELECT count(*)::int FROM ${schema}.social_matches
            WHERE (user_low_id = $1 OR user_high_id = $1)
              AND status IN ('anonymous_candidate','contact_pending','connected')) AS "matchCount",
          (SELECT count(*)::int FROM ${schema}.occurrence_memberships
            WHERE user_id = $1 AND membership_status = 'accepted') AS "occurrenceCount"
      `,
      [viewer.id],
    );
    console.info(JSON.stringify({ target: viewer.username, dataset, ...summary.rows[0] }, null, 2));
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closePool);
