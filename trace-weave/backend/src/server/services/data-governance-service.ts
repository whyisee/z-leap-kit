import { hostname } from "node:os";
import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";
import { withTransaction } from "../db/transaction";
import { verifyPassword } from "./auth-service";
import { mediaStorage } from "./media-storage";

const schema = quoteIdentifier(config.DB_SCHEMA);
const deletionLeaseMinutes = 10;

export class DataGovernanceError extends Error {
  constructor(message: string, readonly statusCode: 400 | 401 | 404 | 409 = 400) {
    super(message);
    this.name = "DataGovernanceError";
  }
}

async function rows(client: PoolClient, sql: string, ownerUserId: string): Promise<Record<string, unknown>[]> {
  return (await client.query(sql, [ownerUserId])).rows;
}

export async function exportAccountData(client: PoolClient, ownerUserId: string) {
  const account = await client.query(
    `SELECT id, username, display_name AS "displayName", status, settings, created_at AS "createdAt", updated_at AS "updatedAt"
     FROM ${schema}.users WHERE id = $1`,
    [ownerUserId],
  );
  if (!account.rows[0]) throw new DataGovernanceError("账号不存在", 404);

  const data = {
    account: account.rows[0],
    rawEntries: await rows(client, `SELECT * FROM ${schema}.raw_entries WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    rawEntryContents: await rows(client, `SELECT content.* FROM ${schema}.raw_entry_contents content JOIN ${schema}.raw_entries entry ON entry.id = content.raw_entry_id WHERE entry.owner_user_id = $1 ORDER BY content.raw_entry_id, content.position`, ownerUserId),
    speechTranscripts: await rows(client, `SELECT transcript.* FROM ${schema}.speech_transcripts transcript JOIN ${schema}.raw_entry_contents content ON content.id = transcript.raw_entry_content_id JOIN ${schema}.raw_entries entry ON entry.id = content.raw_entry_id WHERE entry.owner_user_id = $1 ORDER BY transcript.created_at`, ownerUserId),
    mediaAttachments: await rows(client, `SELECT id, raw_entry_id, media_kind, original_filename, mime_type, byte_size, sha256, width, height, duration_ms, encryption_key_ref, technical_metadata, created_at, deleted_at FROM ${schema}.media_attachments WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    locationObservations: await rows(client, `SELECT * FROM ${schema}.location_observations WHERE owner_user_id = $1 ORDER BY captured_at`, ownerUserId),
    eventCandidates: await rows(client, `SELECT candidate.* FROM ${schema}.event_candidates candidate JOIN ${schema}.raw_entries entry ON entry.id = candidate.raw_entry_id WHERE entry.owner_user_id = $1 ORDER BY candidate.raw_entry_id, candidate.candidate_index`, ownerUserId),
    events: await rows(client, `SELECT * FROM ${schema}.events WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    eventRevisions: await rows(client, `SELECT * FROM ${schema}.event_revisions WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    eventParticipants: await rows(client, `SELECT participant.* FROM ${schema}.event_participants participant JOIN ${schema}.events event ON event.id = participant.event_id WHERE event.owner_user_id = $1 ORDER BY participant.created_at`, ownerUserId),
    eventEntityRelations: await rows(client, `SELECT relation.* FROM ${schema}.event_entity_relations relation JOIN ${schema}.events event ON event.id = relation.event_id WHERE event.owner_user_id = $1 ORDER BY relation.created_at`, ownerUserId),
    eventLocationLinks: await rows(client, `SELECT link.* FROM ${schema}.event_location_links link JOIN ${schema}.events event ON event.id = link.event_id WHERE event.owner_user_id = $1 ORDER BY link.created_at`, ownerUserId),
    eventRelations: await rows(client, `SELECT * FROM ${schema}.event_relations WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    userEntities: await rows(client, `SELECT * FROM ${schema}.user_entities WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    entityAliases: await rows(client, `SELECT alias.* FROM ${schema}.entity_aliases alias JOIN ${schema}.user_entities entity ON entity.id = alias.user_entity_id WHERE entity.owner_user_id = $1 ORDER BY alias.created_at`, ownerUserId),
    userAssertions: await rows(client, `SELECT * FROM ${schema}.user_assertions WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    inferredRelations: await rows(client, `SELECT * FROM ${schema}.inferred_relations WHERE owner_user_id = $1 ORDER BY generated_at`, ownerUserId),
    privacyPolicies: await rows(client, `SELECT * FROM ${schema}.privacy_policies WHERE owner_user_id = $1 ORDER BY policy_level, subject_key`, ownerUserId),
    sharedInvites: await rows(client, `SELECT * FROM ${schema}.event_participant_account_invites WHERE owner_user_id = $1 OR target_user_id = $1 ORDER BY created_at`, ownerUserId),
    occurrenceMemberships: await rows(client, `SELECT * FROM ${schema}.occurrence_memberships WHERE user_id = $1 OR invited_by_user_id = $1 ORDER BY created_at`, ownerUserId),
    socialMatches: await rows(client, `SELECT * FROM ${schema}.social_matches WHERE user_low_id = $1 OR user_high_id = $1 ORDER BY calculated_at`, ownerUserId),
    socialConnections: await rows(client, `SELECT * FROM ${schema}.social_connections WHERE user_low_id = $1 OR user_high_id = $1 ORDER BY connected_at`, ownerUserId),
    friendRequests: await rows(client, `SELECT * FROM ${schema}.friend_requests WHERE sender_user_id = $1 OR recipient_user_id = $1 ORDER BY created_at`, ownerUserId),
    directConversations: await rows(client, `SELECT * FROM ${schema}.direct_conversations WHERE user_low_id = $1 OR user_high_id = $1 ORDER BY created_at`, ownerUserId),
    directMessages: await rows(client, `SELECT message.* FROM ${schema}.direct_messages message JOIN ${schema}.direct_conversations conversation ON conversation.id = message.conversation_id WHERE conversation.user_low_id = $1 OR conversation.user_high_id = $1 ORDER BY message.created_at`, ownerUserId),
    userFeedback: await rows(client, `SELECT * FROM ${schema}.user_feedback WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    aiProcessingAudits: await rows(client, `SELECT * FROM ${schema}.ai_processing_audits WHERE owner_user_id = $1 ORDER BY started_at`, ownerUserId),
    notificationPreferences: await rows(client, `SELECT * FROM ${schema}.notification_preferences WHERE owner_user_id = $1`, ownerUserId),
    notifications: await rows(client, `SELECT * FROM ${schema}.notifications WHERE owner_user_id = $1 ORDER BY created_at`, ownerUserId),
    dataAccessAudits: await rows(client, `SELECT * FROM ${schema}.data_access_audits WHERE owner_user_id = $1::uuid OR actor_id = $1::text ORDER BY created_at`, ownerUserId),
  };

  const exportId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.data_access_audits (id, actor_type, actor_id, owner_user_id, purpose, resource_type, resource_id, result)
     VALUES ($1, 'user', $2::text, $2::uuid, 'account_data_export', 'account', $2::text, 'success')`,
    [exportId, ownerUserId],
  );
  return {
    schemaVersion: "traceweave-account-export/v1",
    exportId,
    exportedAt: new Date().toISOString(),
    attachmentBinaryIncluded: false,
    attachmentNote: "附件导出包含完整元数据；当前 JSON 导出不内嵌二进制文件。",
    data,
  };
}

export async function requestAccountDeletion(
  client: PoolClient,
  ownerUserId: string,
  password: string,
  usernameConfirmation: string,
): Promise<{ jobId: string; status: "pending" }> {
  const result = await client.query<{
    username: string;
    passwordHash: string;
    passwordSalt: string;
    status: string;
  }>(
    `SELECT user_account.username,
            user_account.status,
            credential.password_hash AS "passwordHash",
            credential.password_salt AS "passwordSalt"
     FROM ${schema}.users user_account
     JOIN ${schema}.user_credentials credential ON credential.user_id = user_account.id
     WHERE user_account.id = $1
     FOR UPDATE OF user_account, credential`,
    [ownerUserId],
  );
  const account = result.rows[0];
  if (!account || account.status !== "active") throw new DataGovernanceError("账号无法申请删除", 409);
  if (usernameConfirmation.trim().toLocaleLowerCase("zh-CN") !== account.username.toLocaleLowerCase("zh-CN")) {
    throw new DataGovernanceError("请输入当前用户名以确认删除");
  }
  if (!(await verifyPassword(password, account.passwordHash, account.passwordSalt))) {
    throw new DataGovernanceError("密码不正确", 401);
  }

  const existing = await client.query<{ id: string }>(
    `SELECT id FROM ${schema}.deletion_jobs
     WHERE owner_user_id = $1 AND resource_type = 'account' AND resource_id = $2
       AND status IN ('pending', 'running')`,
    [ownerUserId, ownerUserId],
  );
  if (existing.rows[0]) return { jobId: existing.rows[0].id, status: "pending" };

  const jobId = randomUUID();
  await client.query(
    `INSERT INTO ${schema}.deletion_jobs (id, owner_user_id, resource_type, resource_id, progress)
     VALUES ($1, $2, 'account', $3, '{"stage":"queued"}'::jsonb)`,
    [jobId, ownerUserId, ownerUserId],
  );
  await client.query(`UPDATE ${schema}.users SET status = 'suspended', updated_at = now() WHERE id = $1`, [ownerUserId]);
  await client.query(`UPDATE ${schema}.user_sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL`, [ownerUserId]);
  await client.query(
    `INSERT INTO ${schema}.data_access_audits (id, actor_type, actor_id, owner_user_id, purpose, resource_type, resource_id, result)
     VALUES ($1, 'user', $2::text, $2::uuid, 'account_deletion_request', 'account', $2::text, 'accepted')`,
    [randomUUID(), ownerUserId],
  );
  return { jobId, status: "pending" };
}

type DeletionJob = {
  id: string;
  ownerUserId: string;
  attempts: number;
  progress: { databaseErased?: boolean; mediaStorageKeys?: string[] };
};

export function deletionRetryDelaySeconds(attempts: number): number {
  return Math.min(3600, 5 * 2 ** Math.min(Math.max(attempts - 1, 0), 10));
}

async function claimDeletionJob(workerId: string): Promise<DeletionJob | null> {
  return withTransaction(async (client) => {
    const result = await client.query<DeletionJob>(
      `WITH candidate AS (
         SELECT id FROM ${schema}.deletion_jobs
         WHERE resource_type = 'account'
           AND status IN ('pending', 'running')
           AND available_at <= now()
           AND (locked_at IS NULL OR locked_at < now() - ($2 * interval '1 minute'))
         ORDER BY requested_at, id
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       UPDATE ${schema}.deletion_jobs job
       SET status = 'running', locked_at = now(), locked_by = $1,
           attempts = job.attempts + 1,
           progress = job.progress || '{"stage":"database_erasure"}'::jsonb
       FROM candidate
       WHERE job.id = candidate.id
       RETURNING job.id, job.owner_user_id AS "ownerUserId", job.attempts, job.progress`,
      [workerId, deletionLeaseMinutes],
    );
    return result.rows[0] ?? null;
  });
}

async function eraseAccountDatabase(job: DeletionJob, workerId: string): Promise<string[]> {
  return withTransaction(async (client) => {
    const locked = await client.query<{ progress: DeletionJob["progress"] }>(
      `SELECT progress FROM ${schema}.deletion_jobs
       WHERE id = $1 AND locked_by = $2 AND status = 'running'
       FOR UPDATE`,
      [job.id, workerId],
    );
    const progress = locked.rows[0]?.progress;
    if (!progress) throw new Error("Deletion job lease was lost");
    if (progress.databaseErased) return progress.mediaStorageKeys ?? [];

    const user = await client.query<{ id: string }>(
      `SELECT id FROM ${schema}.users WHERE id = $1 FOR UPDATE`,
      [job.ownerUserId],
    );
    if (!user.rows[0]) throw new Error("Deletion job account does not exist");

    const media = await client.query<{ storageKey: string }>(
      `SELECT storage_key AS "storageKey" FROM ${schema}.media_attachments WHERE owner_user_id = $1`,
      [job.ownerUserId],
    );
    const affected = await client.query<{ userId: string }>(
      `SELECT DISTINCT user_id AS "userId"
       FROM (
         SELECT CASE WHEN owner_user_id = $1 THEN target_user_id ELSE owner_user_id END AS user_id
         FROM ${schema}.event_participant_account_invites
         WHERE owner_user_id = $1 OR target_user_id = $1
         UNION ALL
         SELECT CASE WHEN user_low_id = $1 THEN user_high_id ELSE user_low_id END AS user_id
         FROM ${schema}.social_matches
         WHERE user_low_id = $1 OR user_high_id = $1
         UNION ALL
         SELECT membership.user_id
         FROM ${schema}.occurrence_memberships membership
         JOIN ${schema}.shared_occurrences occurrence ON occurrence.id = membership.occurrence_id
         WHERE occurrence.created_by_user_id = $1 OR membership.invited_by_user_id = $1
       ) affected
       WHERE user_id IS NOT NULL AND user_id <> $1`,
      [job.ownerUserId],
    );
    const affectedUserIds = affected.rows.map((row) => row.userId);

    await client.query(
      `UPDATE ${schema}.event_participant_account_invites
       SET status = 'revoked', responded_at = coalesce(responded_at, now()), updated_at = now()
       WHERE (owner_user_id = $1 OR target_user_id = $1) AND status <> 'revoked'`,
      [job.ownerUserId],
    );
    await client.query(
      `UPDATE ${schema}.event_occurrence_links link
       SET link_status = 'withdrawn'
       FROM ${schema}.shared_occurrences occurrence
       WHERE link.occurrence_id = occurrence.id AND occurrence.created_by_user_id = $1`,
      [job.ownerUserId],
    );
    await client.query(
      `UPDATE ${schema}.occurrence_memberships membership
       SET membership_status = 'removed', responded_at = coalesce(responded_at, now())
       FROM ${schema}.shared_occurrences occurrence
       WHERE membership.occurrence_id = occurrence.id
         AND occurrence.created_by_user_id = $1
         AND membership.membership_status IN ('invited', 'accepted')`,
      [job.ownerUserId],
    );
    await client.query(
      `UPDATE ${schema}.shared_occurrences
       SET status = 'deleted', version = version + 1, updated_at = now()
       WHERE created_by_user_id = $1 AND status <> 'deleted'`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.occurrence_memberships WHERE user_id = $1 OR invited_by_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.person_account_links WHERE owner_user_id = $1 OR linked_account_user_id = $1`, [job.ownerUserId]);
    await client.query(
      `DELETE FROM ${schema}.event_participants WHERE account_user_id = $1 AND user_entity_id IS NULL`,
      [job.ownerUserId],
    );
    await client.query(
      `UPDATE ${schema}.event_participants
       SET account_user_id = NULL, identity_confirmed = false, attributes = attributes - 'identitySource'
       WHERE account_user_id = $1 AND user_entity_id IS NOT NULL`,
      [job.ownerUserId],
    );

    await client.query(
      `DELETE FROM ${schema}.user_relation_evidence evidence
       USING ${schema}.social_matches match
       WHERE evidence.match_id = match.id AND (match.user_low_id = $1 OR match.user_high_id = $1)`,
      [job.ownerUserId],
    );
    await client.query(
      `DELETE FROM ${schema}.social_connections WHERE user_low_id = $1 OR user_high_id = $1`,
      [job.ownerUserId],
    );
    await client.query(
      `DELETE FROM ${schema}.match_consents consent
       USING ${schema}.social_matches match
       WHERE consent.match_id = match.id AND (match.user_low_id = $1 OR match.user_high_id = $1)`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.social_matches WHERE user_low_id = $1 OR user_high_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.social_projections WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.circle_memberships WHERE user_id = $1`, [job.ownerUserId]);
    await client.query(
      `DELETE FROM ${schema}.social_blocks WHERE blocker_user_id = $1 OR blocked_user_id = $1`,
      [job.ownerUserId],
    );
    await client.query(
      `DELETE FROM ${schema}.safety_reports WHERE reporter_user_id = $1 OR reported_user_id = $1`,
      [job.ownerUserId],
    );
    await client.query(
      `UPDATE ${schema}.direct_messages SET content = '消息已由用户删除', deleted_at = now()
       WHERE sender_user_id = $1 AND deleted_at IS NULL`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.direct_conversation_members WHERE user_id = $1`, [job.ownerUserId]);
    await client.query(
      `DELETE FROM ${schema}.direct_conversations conversation
       WHERE (conversation.user_low_id = $1 OR conversation.user_high_id = $1)
         AND NOT EXISTS (
           SELECT 1 FROM ${schema}.direct_conversation_members membership
           WHERE membership.conversation_id = conversation.id
         )`,
      [job.ownerUserId],
    );
    await client.query(
      `DELETE FROM ${schema}.friend_requests WHERE sender_user_id = $1 OR recipient_user_id = $1`,
      [job.ownerUserId],
    );

    await client.query(
      `DELETE FROM ${schema}.user_assertions assertion
       WHERE assertion.owner_user_id = $1
          OR assertion.target_user_entity_id IN (SELECT id FROM ${schema}.user_entities WHERE owner_user_id = $1)`,
      [job.ownerUserId],
    );
    await client.query(
      `DELETE FROM ${schema}.inferred_relations relation
       WHERE relation.owner_user_id = $1
          OR relation.target_user_entity_id IN (SELECT id FROM ${schema}.user_entities WHERE owner_user_id = $1)`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.event_relations WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.events WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.user_feedback WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.ai_processing_audits WHERE owner_user_id = $1`, [job.ownerUserId]);

    await client.query(
      `DELETE FROM ${schema}.speech_transcripts transcript
       USING ${schema}.raw_entry_contents content, ${schema}.raw_entries entry
       WHERE transcript.raw_entry_content_id = content.id
         AND content.raw_entry_id = entry.id AND entry.owner_user_id = $1`,
      [job.ownerUserId],
    );
    await client.query(
      `DELETE FROM ${schema}.raw_entry_contents content
       USING ${schema}.raw_entries entry
       WHERE content.raw_entry_id = entry.id AND entry.owner_user_id = $1`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.media_attachments WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(
      `DELETE FROM ${schema}.event_candidates candidate
       USING ${schema}.raw_entries entry
       WHERE candidate.raw_entry_id = entry.id AND entry.owner_user_id = $1`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.location_observations WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.raw_entries WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(
      `DELETE FROM ${schema}.entity_memory_operations operation
       WHERE operation.owner_user_id = $1
          OR operation.source_entity_id IN (SELECT id FROM ${schema}.user_entities WHERE owner_user_id = $1)
          OR operation.target_entity_id IN (SELECT id FROM ${schema}.user_entities WHERE owner_user_id = $1)`,
      [job.ownerUserId],
    );
    await client.query(`DELETE FROM ${schema}.user_entities WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.privacy_policies WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.notifications WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.push_subscriptions WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.web_push_subscriptions WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.notification_preferences WHERE owner_user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.user_credentials WHERE user_id = $1`, [job.ownerUserId]);
    await client.query(`DELETE FROM ${schema}.user_sessions WHERE user_id = $1`, [job.ownerUserId]);

    await client.query(
      `UPDATE ${schema}.users
       SET username = 'deleted-' || id::text,
           display_name = '已删除用户', status = 'deleted', settings = '{}'::jsonb, updated_at = now()
       WHERE id = $1`,
      [job.ownerUserId],
    );
    await client.query(
      `INSERT INTO ${schema}.outbox_events (id, aggregate_type, aggregate_id, event_type, payload)
       VALUES ($1, 'account', $2, 'account.deleted', $3::jsonb)`,
      [randomUUID(), job.ownerUserId, JSON.stringify({ ownerUserId: job.ownerUserId, affectedUserIds })],
    );
    const storageKeys = media.rows.map((row) => row.storageKey);
    await client.query(
      `UPDATE ${schema}.deletion_jobs
       SET progress = $3::jsonb, locked_at = now()
       WHERE id = $1 AND locked_by = $2`,
      [
        job.id,
        workerId,
        JSON.stringify({
          stage: "media_cleanup",
          databaseErased: true,
          mediaStorageKeys: storageKeys,
          affectedUserCount: affectedUserIds.length,
        }),
      ],
    );
    await client.query(
      `INSERT INTO ${schema}.data_access_audits (id, actor_type, actor_id, owner_user_id, purpose, resource_type, resource_id, result)
       VALUES ($1, 'system', $2, $3, 'account_database_erasure', 'deletion_job', $4, 'success')`,
      [randomUUID(), workerId, job.ownerUserId, job.id],
    );
    return storageKeys;
  });
}

async function completeDeletionJob(job: DeletionJob, workerId: string, mediaCount: number): Promise<void> {
  await pool.query(
    `UPDATE ${schema}.deletion_jobs
     SET status = 'completed', completed_at = now(), locked_at = NULL, locked_by = NULL,
         error_message = NULL,
         progress = jsonb_build_object('stage', 'completed', 'databaseErased', true, 'deletedMediaCount', $3::int)
     WHERE id = $1 AND locked_by = $2`,
    [job.id, workerId, mediaCount],
  );
}

async function failDeletionJob(job: DeletionJob, workerId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message.slice(0, 4000) : "Unknown deletion error";
  const terminal = job.attempts >= config.DELETION_MAX_ATTEMPTS;
  const delaySeconds = deletionRetryDelaySeconds(job.attempts);
  await pool.query(
    `UPDATE ${schema}.deletion_jobs
     SET status = CASE WHEN $4 THEN 'failed' ELSE 'pending' END,
         locked_at = NULL, locked_by = NULL, error_message = $3, last_error_at = now(),
         available_at = CASE WHEN $4 THEN available_at ELSE now() + ($5 * interval '1 second') END,
         progress = progress || jsonb_build_object(
           'stage', CASE WHEN $4 THEN 'failed' ELSE 'retry_scheduled' END
         )
     WHERE id = $1 AND locked_by = $2`,
    [job.id, workerId, message, terminal, delaySeconds],
  );
}

export async function processDeletionJob(
  logger?: Pick<FastifyBaseLogger, "info" | "error">,
  workerId = `${hostname()}:${process.pid}:${randomUUID()}`,
): Promise<boolean> {
  const job = await claimDeletionJob(workerId);
  if (!job) return false;
  try {
    const storageKeys = await eraseAccountDatabase(job, workerId);
    for (const storageKey of storageKeys) await mediaStorage.delete(storageKey);
    await completeDeletionJob(job, workerId, storageKeys.length);
    logger?.info({ jobId: job.id, deletedMediaCount: storageKeys.length }, "Account deletion completed");
  } catch (error) {
    await failDeletionJob(job, workerId, error);
    logger?.error({ err: error, jobId: job.id }, "Account deletion failed");
  }
  return true;
}

export function startDeletionWorker(logger: FastifyBaseLogger): () => void {
  const workerId = `${hostname()}:${process.pid}:${randomUUID()}`;
  let running = false;
  let stopped = false;
  const sweep = async () => {
    if (running || stopped) return;
    running = true;
    try {
      while (!stopped && (await processDeletionJob(logger, workerId))) {
        // Drain all currently eligible jobs before yielding to the next interval.
      }
    } catch (error) {
      logger.error({ err: error, workerId }, "Deletion worker sweep failed");
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void sweep(), config.DELETION_SWEEP_SECONDS * 1000);
  timer.unref();
  void sweep();
  return () => {
    stopped = true;
    clearInterval(timer);
  };
}
