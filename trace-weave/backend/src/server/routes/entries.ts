import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import type { PoolClient } from "pg";
import { z } from "zod";
import { config, quoteIdentifier } from "../config";
import {
  confirmEntrySchema,
  createEntrySchema,
  createMixedEntrySchema,
  createVoiceEntrySchema,
  type EventCandidatePayload,
} from "../domain/event-candidate";
import { pool } from "../db/pool";
import { withTransaction } from "../db/transaction";
import { resolveEventEntity } from "../services/entity-resolver";
import { authenticateRequest } from "../services/auth-service";
import { refreshSocialProjectionsForUser } from "../services/social-service";
import { AiConfigurationError } from "../services/event-parser";
import {
  insertLocationObservation,
  parserLocationContext,
  type SavedLocationObservation,
} from "../services/location-context";
import {
  mediaStorage,
  MediaValidationError,
  type MediaKind,
} from "../services/media-storage";
import { eventParser } from "../services/parser-factory";
import { jsonChangedPaths } from "../services/json-diff";
import { speechToTextService } from "../services/speech-to-text-service";

const schema = quoteIdentifier(config.DB_SCHEMA);

class EntryConflictError extends Error {}
class DraftLimitError extends Error {}

const timelineQuerySchema = z.object({
  q: z.string().trim().max(200).default(""),
  eventType: z.string().trim().min(1).max(80).optional(),
  entityId: z.string().uuid().optional(),
  personId: z.string().uuid().optional(),
  placeId: z.string().uuid().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
const appendDraftTextSchema = z.object({ text: z.string().trim().min(1).max(20_000) });

type SavedCandidate = {
  id: string;
  payload: EventCandidatePayload;
  parserProvider: string;
  parserModelVersion: string;
};

type IncomingMedia = {
  kind: MediaKind;
  buffer: Buffer;
  filename: string;
  mimeType: string;
};

const multipartMediaKinds: Record<string, MediaKind> = {
  voice: "voice",
  image: "image",
  screenshot: "screenshot",
  video: "video",
  file: "file",
};

function attachLocationEvidence(
  candidates: EventCandidatePayload[],
  location: SavedLocationObservation | undefined,
): EventCandidatePayload[] {
  if (!location?.label || location.defaultEventRole !== "occurred_at") return candidates;
  const normalizedLabel = location.label.normalize("NFKC").trim().toLocaleLowerCase("zh-CN");
  return candidates.map((candidate) => ({
    ...candidate,
    entities: candidate.entities.map((entity) =>
      entity.entityType === "place" &&
      entity.mention.normalize("NFKC").trim().toLocaleLowerCase("zh-CN") === normalizedLabel
        ? {
            ...entity,
            attributes: {
              ...entity.attributes,
              locationObservationId: location.id,
              locationEvidence: "user_attached",
            },
          }
        : entity,
    ),
  }));
}

function requireConfiguredParser(): void {
  if (!eventParser.configured) {
    throw new AiConfigurationError(
      "DeepSeek 尚未配置：请在 backend/.env 中填写 DEEPSEEK_API_KEY 后重启服务",
    );
  }
}

async function assertDraftCapacity(client: PoolClient, ownerUserId: string): Promise<void> {
  await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
  const draftCount = await client.query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM ${schema}.raw_entries
      WHERE owner_user_id = $1
        AND status IN ('parsing', 'awaiting_confirmation', 'failed')
        AND deleted_at IS NULL
    `,
    [ownerUserId],
  );

  if (Number(draftCount.rows[0]?.count ?? 0) >= 30) {
    throw new DraftLimitError("待确认草稿已达到 30 条，请先确认或删除至少一条");
  }
}

async function scheduleDraftReminder(
  client: PoolClient,
  rawEntryId: string,
  ownerUserId: string,
): Promise<void> {
  await client.query(
    `
      WITH reminder_time AS (
        SELECT
          entry.created_at + make_interval(
            mins => COALESCE(preference.draft_reminder_delay_minutes, 1440)
          ) AS remind_at
        FROM ${schema}.raw_entries entry
        LEFT JOIN ${schema}.notification_preferences preference
          ON preference.owner_user_id = entry.owner_user_id
        WHERE entry.id = $1 AND entry.owner_user_id = $2
      ), updated_entry AS (
        UPDATE ${schema}.raw_entries entry
        SET draft_reminder_after = reminder_time.remind_at
        FROM reminder_time
        WHERE entry.id = $1
        RETURNING entry.draft_reminder_after
      )
      INSERT INTO ${schema}.draft_reminders (
        id, raw_entry_id, owner_user_id, remind_at
      )
      SELECT $3, $1, $2, draft_reminder_after
      FROM updated_entry
      ON CONFLICT (raw_entry_id) DO UPDATE
      SET remind_at = EXCLUDED.remind_at,
          status = 'scheduled',
          sent_at = NULL
    `,
    [rawEntryId, ownerUserId, randomUUID()],
  );
}

async function parseAndSaveCandidates(input: {
  ownerUserId: string;
  rawEntryId: string;
  auditId: string;
  text: string;
  timezone: string;
  referenceTime: Date;
  location?: { label?: string; role: "occurred_at" | "recorded_at" };
  savedLocation?: SavedLocationObservation;
  candidateIndexOffset?: number;
}): Promise<{ candidates: SavedCandidate[]; resolvedModelVersion: string }> {
  try {
    const parseResult = await eventParser.parse({
      text: input.text,
      timezone: input.timezone,
      referenceTime: input.referenceTime,
      location: input.location,
    });

    const savedCandidates = await withTransaction(async (client) => {
      const rows: SavedCandidate[] = [];

      const candidatesWithLocationEvidence = attachLocationEvidence(
        parseResult.candidates,
        input.savedLocation,
      );
      for (const [index, payload] of candidatesWithLocationEvidence.entries()) {
        const candidateId = randomUUID();
        await client.query(
          `
            INSERT INTO ${schema}.event_candidates (
              id,
              raw_entry_id,
              candidate_index,
              payload,
              overall_confidence,
              schema_version,
              parser_provider,
              parser_model_version
            ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
          `,
          [
            candidateId,
            input.rawEntryId,
            index + (input.candidateIndexOffset ?? 0),
            JSON.stringify(payload),
            payload.confidence,
            payload.schemaVersion,
            eventParser.provider,
            parseResult.resolvedModelVersion,
          ],
        );
        rows.push({
          id: candidateId,
          payload,
          parserProvider: eventParser.provider,
          parserModelVersion: parseResult.resolvedModelVersion,
        });
      }

      await client.query(
        `
          UPDATE ${schema}.raw_entries
          SET status = 'awaiting_confirmation', updated_at = now()
          WHERE id = $1 AND owner_user_id = $2
        `,
        [input.rawEntryId, input.ownerUserId],
      );
      await client.query(
        `
          UPDATE ${schema}.ai_processing_audits
          SET status = 'succeeded',
              model_version = $2,
              provider_request_id = $3,
              usage = $4::jsonb,
              completed_at = now()
          WHERE id = $1
        `,
        [
          input.auditId,
          parseResult.resolvedModelVersion,
          parseResult.providerRequestId ?? null,
          JSON.stringify(parseResult.usage ?? {}),
        ],
      );
      return rows;
    });

    return { candidates: savedCandidates, resolvedModelVersion: parseResult.resolvedModelVersion };
  } catch (error) {
    await pool.query(
      `
        UPDATE ${schema}.raw_entries
        SET status = 'failed', failure_code = 'PARSER_FAILED', failure_message = $2, updated_at = now()
        WHERE id = $1
      `,
      [input.rawEntryId, error instanceof Error ? error.message : "Unknown parser error"],
    );
    await pool.query(
      `
        UPDATE ${schema}.ai_processing_audits
        SET status = 'failed',
            error_code = $2,
            error_message = $3,
            completed_at = now()
        WHERE id = $1
      `,
      [
        input.auditId,
        error instanceof Error ? error.name : "UNKNOWN_AI_ERROR",
        error instanceof Error ? error.message : "Unknown parser error",
      ],
    );
    throw error;
  }
}

async function insertConfirmedEvent(
  client: PoolClient,
  ownerUserId: string,
  rawEntryId: string,
  candidateId: string,
  payload: EventCandidatePayload,
  location?: {
    observationId: string;
    role: "occurred_at" | "recorded_at";
    socialMatchEligible: boolean;
  },
): Promise<string> {
  const eventId = randomUUID();
  await client.query(
    `
      INSERT INTO ${schema}.events (
        id,
        owner_user_id,
        raw_entry_id,
        accepted_candidate_id,
        event_type,
        event_schema_version,
        title,
        factual_status,
        occurred_start,
        occurred_end,
        time_precision,
        timezone,
        source_time_expression,
        overall_confidence,
        subjective_experience,
        extensions
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9::timestamptz, $10::timestamptz, $11, $12, $13, $14, $15::jsonb, $16::jsonb
      )
    `,
    [
      eventId,
      ownerUserId,
      rawEntryId,
      candidateId,
      payload.eventType,
      payload.schemaVersion,
      payload.title,
      payload.factualStatus,
      payload.time.start,
      payload.time.end,
      payload.time.precision,
      payload.time.timezone,
      payload.time.sourceExpression,
      payload.confidence,
      JSON.stringify(payload.subjectiveExperience),
      JSON.stringify(payload.extensions),
    ],
  );

  for (const participant of payload.participants) {
    if (participant.isCurrentUser) {
      await client.query(
        `
          INSERT INTO ${schema}.event_participants (
            id, event_id, account_user_id, participant_role, identity_confirmed, attributes
          ) VALUES ($1, $2, $3, $4, true, $5::jsonb)
        `,
        [
          randomUUID(),
          eventId,
          ownerUserId,
          participant.role,
          JSON.stringify({ mention: participant.mention, confidence: participant.confidence }),
        ],
      );
      continue;
    }

    const person = await resolveEventEntity(client, ownerUserId, {
      mention: participant.mention,
      entityType: "person",
      role: participant.role,
      confidence: participant.confidence,
      attributes: {},
      resolvedUserEntityId: participant.resolvedUserEntityId,
    });
    await client.query(
      `
        INSERT INTO ${schema}.event_participants (
          id, event_id, user_entity_id, participant_role, identity_confirmed, attributes
        ) VALUES ($1, $2, $3, $4, false, $5::jsonb)
      `,
      [
        randomUUID(),
        eventId,
        person.userEntityId,
        participant.role,
        JSON.stringify({ mention: participant.mention, confidence: participant.confidence }),
      ],
    );
  }

  for (const entity of payload.entities) {
    const resolved = await resolveEventEntity(client, ownerUserId, entity);
    await client.query(
      `
        INSERT INTO ${schema}.event_entity_relations (
          id,
          event_id,
          user_entity_id,
          canonical_entity_id,
          relation_role,
          quantity,
          unit,
          amount,
          currency,
          confidence,
          attributes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      `,
      [
        randomUUID(),
        eventId,
        resolved.userEntityId,
        resolved.canonicalEntityId,
        entity.role,
        entity.quantity ?? null,
        entity.unit ?? null,
        entity.amount ?? null,
        entity.currency ?? null,
        entity.confidence ?? null,
        JSON.stringify(entity.attributes),
      ],
    );
  }

  if (location) {
    await client.query(
      `
        INSERT INTO ${schema}.event_location_links (
          id,
          event_id,
          location_observation_id,
          location_role,
          user_confirmed,
          social_match_eligible,
          attributes
        ) VALUES ($1, $2, $3, $4, true, $5, '{"source":"user_confirmation"}'::jsonb)
      `,
      [randomUUID(), eventId, location.observationId, location.role, location.socialMatchEligible],
    );
  }

  await client.query(
    `
      INSERT INTO ${schema}.event_revisions (
        id, event_id, owner_user_id, version, operation, snapshot, changed_fields
      ) VALUES ($1, $2, $3, 1, 'created', $4::jsonb, '[]'::jsonb)
    `,
    [
      randomUUID(),
      eventId,
      ownerUserId,
      JSON.stringify({
        payload,
        location: location
          ? {
              observationId: location.observationId,
              role: location.role,
              socialMatchEligible: location.socialMatchEligible,
            }
          : null,
      }),
    ],
  );

  await client.query(
    `
      INSERT INTO ${schema}.outbox_events (
        id, aggregate_type, aggregate_id, event_type, payload
      ) VALUES ($1, 'event', $2, 'event.confirmed', $3::jsonb)
    `,
    [randomUUID(), eventId, JSON.stringify({ eventId, ownerUserId, rawEntryId })],
  );

  return eventId;
}

export const entryRoutes: FastifyPluginAsync = async (app) => {
  app.addHook("preHandler", authenticateRequest);

  app.post("/api/speech/transcribe", async (request) => {
    let audio: { buffer: Buffer; filename: string; mimeType: string } | undefined;
    let language = "zh-CN";
    for await (const part of request.parts()) {
      if (part.type === "file" && part.fieldname === "audio") {
        if (audio) throw new MediaValidationError("每次只能转写一段语音");
        audio = { buffer: await part.toBuffer(), filename: part.filename, mimeType: part.mimetype };
      } else if (part.type === "field" && part.fieldname === "language") language = String(part.value ?? "zh-CN");
      else if (part.type === "file") await part.toBuffer();
    }
    if (!audio) throw new MediaValidationError("请选择一段语音");
    mediaStorage.assertAudio(audio.mimeType, audio.buffer.byteLength);
    return speechToTextService.transcribe({ ...audio, language });
  });

  app.post("/api/entries", async (request, reply) => {
    const body = createEntrySchema.parse(request.body);
    requireConfiguredParser();
    const ownerUserId = request.authUser.id;
    const rawEntryId = randomUUID();
    const contentId = randomUUID();
    const auditId = randomUUID();
    let savedLocation: SavedLocationObservation | undefined;

    await withTransaction(async (client) => {
      await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", [ownerUserId]);
      const draftCount = await client.query<{ count: string }>(
        `
          SELECT count(*)::text AS count
          FROM ${schema}.raw_entries
          WHERE owner_user_id = $1
            AND status IN ('parsing', 'awaiting_confirmation', 'failed')
            AND deleted_at IS NULL
        `,
        [ownerUserId],
      );

      if (Number(draftCount.rows[0]?.count ?? 0) >= 30) {
        throw new DraftLimitError("待确认草稿已达到 30 条，请先确认或删除至少一条");
      }

      await client.query(
        `
          INSERT INTO ${schema}.raw_entries (
            id,
            owner_user_id,
            status,
            input_locale,
            client_timezone,
            client_created_at,
            draft_reminder_after
          ) VALUES ($1, $2, 'parsing', $3, $4, $5::timestamptz, now() + interval '24 hours')
        `,
        [rawEntryId, ownerUserId, body.inputLocale, body.clientTimezone, body.clientCreatedAt ?? null],
      );
      if (body.location) {
        savedLocation = await insertLocationObservation(client, {
          rawEntryId,
          ownerUserId,
          location: body.location,
        });
      }
      await client.query(
        `
          INSERT INTO ${schema}.raw_entry_contents (
            id, raw_entry_id, position, content_kind, text_content
          ) VALUES ($1, $2, 0, 'text', $3)
        `,
        [contentId, rawEntryId, body.text],
      );
      await scheduleDraftReminder(client, rawEntryId, ownerUserId);
      await client.query(
        `
          INSERT INTO ${schema}.ai_processing_audits (
            id, owner_user_id, raw_entry_id, operation, provider, model_version,
            data_scope, retention_policy, status
          ) VALUES (
            $1, $2, $3, 'event_extraction', $4, $5,
            $6::jsonb,
            $7,
            'started'
          )
        `,
        [
          auditId,
          ownerUserId,
          rawEntryId,
          eventParser.provider,
          eventParser.modelVersion,
          JSON.stringify({
            text: true,
            attachments: false,
            locationLabel: Boolean(body.location?.label),
            preciseCoordinates: false,
          }),
          eventParser.retentionPolicy,
        ],
      );
    });

    try {
      const parseResult = await eventParser.parse({
        text: body.text,
        timezone: body.clientTimezone,
        referenceTime: body.clientCreatedAt ? new Date(body.clientCreatedAt) : new Date(),
        location: parserLocationContext(body.location),
      });

      const savedCandidates = await withTransaction(async (client) => {
        const rows: Array<{
          id: string;
          payload: EventCandidatePayload;
          parserProvider: string;
          parserModelVersion: string;
        }> = [];

        const candidatesWithLocationEvidence = attachLocationEvidence(
          parseResult.candidates,
          savedLocation,
        );
        for (const [index, payload] of candidatesWithLocationEvidence.entries()) {
          const candidateId = randomUUID();
          await client.query(
            `
              INSERT INTO ${schema}.event_candidates (
                id,
                raw_entry_id,
                candidate_index,
                payload,
                overall_confidence,
                schema_version,
                parser_provider,
                parser_model_version
              ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)
            `,
            [
              candidateId,
              rawEntryId,
              index,
              JSON.stringify(payload),
              payload.confidence,
              payload.schemaVersion,
              eventParser.provider,
              parseResult.resolvedModelVersion,
            ],
          );
          rows.push({
            id: candidateId,
            payload,
            parserProvider: eventParser.provider,
            parserModelVersion: parseResult.resolvedModelVersion,
          });
        }

        await client.query(
          `
            UPDATE ${schema}.raw_entries
            SET status = 'awaiting_confirmation', updated_at = now()
            WHERE id = $1 AND owner_user_id = $2
          `,
          [rawEntryId, ownerUserId],
        );
        await client.query(
          `
            UPDATE ${schema}.ai_processing_audits
            SET status = 'succeeded',
                model_version = $2,
                provider_request_id = $3,
                usage = $4::jsonb,
                completed_at = now()
            WHERE id = $1
          `,
          [
            auditId,
            parseResult.resolvedModelVersion,
            parseResult.providerRequestId ?? null,
            JSON.stringify(parseResult.usage ?? {}),
          ],
        );
        return rows;
      });

      return reply.code(201).send({
        entry: { id: rawEntryId, status: "awaiting_confirmation", text: body.text },
        location: savedLocation ?? null,
        candidates: savedCandidates,
        parser: {
          provider: eventParser.provider,
          model: parseResult.resolvedModelVersion,
        },
      });
    } catch (error) {
      await pool.query(
        `
          UPDATE ${schema}.raw_entries
          SET status = 'failed', failure_code = 'PARSER_FAILED', failure_message = $2, updated_at = now()
          WHERE id = $1
        `,
        [rawEntryId, error instanceof Error ? error.message : "Unknown parser error"],
      );
      await pool.query(
        `
          UPDATE ${schema}.ai_processing_audits
          SET status = 'failed',
              error_code = $2,
              error_message = $3,
              completed_at = now()
          WHERE id = $1
        `,
        [
          auditId,
          error instanceof Error ? error.name : "UNKNOWN_AI_ERROR",
          error instanceof Error ? error.message : "Unknown parser error",
        ],
      );
      throw error;
    }
  });

  app.post("/api/entries/mixed", async (request, reply) => {
    requireConfiguredParser();

    const fields: Record<string, string> = {};
    const incomingMedia: IncomingMedia[] = [];
    let totalBytes = 0;

    for await (const part of request.parts()) {
      if (part.type === "file") {
        const kind = multipartMediaKinds[part.fieldname];
        const buffer = await part.toBuffer();
        if (!kind) throw new MediaValidationError(`未知的附件类型：${part.fieldname}`);
        mediaStorage.assertMedia(kind, part.mimetype, buffer.byteLength);
        totalBytes += buffer.byteLength;
        if (totalBytes > config.MEDIA_MAX_TOTAL_BYTES) {
          throw new MediaValidationError(
            `单条记录的附件总大小不能超过 ${Math.floor(config.MEDIA_MAX_TOTAL_BYTES / 1024 / 1024)} MB`,
            413,
          );
        }
        incomingMedia.push({
          kind,
          buffer,
          filename: part.filename,
          mimeType: part.mimetype,
        });
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }

    const body = createMixedEntrySchema.parse(fields);
    if (!incomingMedia.length && body.textBlocks.length <= 1) throw new MediaValidationError("组合记录至少需要两个内容块");
    if (incomingMedia.filter((item) => item.kind === "voice").length > 8) throw new MediaValidationError("每条记录最多包含八段原始录音");
    const ownerUserId = request.authUser.id;
    const rawEntryId = randomUUID();
    const auditId = randomUUID();
    const storedMedia: Array<
      IncomingMedia & {
        attachmentId: string;
        storageKey: string;
        sha256: string;
        byteSize: number;
        encryptionKeyRef: string | null;
        storageProvider: "local" | "s3";
      }
    > = [];
    let savedLocation: SavedLocationObservation | undefined;

    try {
      for (const media of incomingMedia) {
        const attachmentId = randomUUID();
        const stored = await mediaStorage.save({
          ownerUserId,
          rawEntryId,
          attachmentId,
          filename: media.filename,
          mimeType: media.mimeType,
          buffer: media.buffer,
          kind: media.kind,
        });
        storedMedia.push({ ...media, attachmentId, ...stored });
      }

      await withTransaction(async (client) => {
        await assertDraftCapacity(client, ownerUserId);
        await client.query(
          `
            INSERT INTO ${schema}.raw_entries (
              id,
              owner_user_id,
              status,
              input_locale,
              client_timezone,
              client_created_at,
              draft_reminder_after
            ) VALUES ($1, $2, 'parsing', $3, $4, $5::timestamptz, now() + interval '24 hours')
          `,
          [rawEntryId, ownerUserId, body.inputLocale, body.clientTimezone, body.clientCreatedAt ?? null],
        );
        if (body.location) {
          savedLocation = await insertLocationObservation(client, {
            rawEntryId,
            ownerUserId,
            location: body.location,
          });
        }

        await scheduleDraftReminder(client, rawEntryId, ownerUserId);

        for (const media of storedMedia) {
          await client.query(
            `
              INSERT INTO ${schema}.media_attachments (
                id,
                raw_entry_id,
                owner_user_id,
                media_kind,
                storage_key,
                original_filename,
                mime_type,
                byte_size,
                sha256,
                encryption_key_ref,
                duration_ms,
                technical_metadata
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb)
            `,
            [
              media.attachmentId,
              rawEntryId,
              ownerUserId,
              media.kind,
              media.storageKey,
              media.filename,
              media.mimeType,
              media.byteSize,
              media.sha256,
              media.encryptionKeyRef,
              media.kind === "voice" ? (body.durationMs ?? null) : null,
              JSON.stringify({
                capture: "user_initiated",
                aiParsed: false,
                storageProvider: media.storageProvider,
                envelopeEncrypted: Boolean(media.encryptionKeyRef),
                ...(media.kind === "voice" ? { transcription: body.transcriptProvider } : {}),
              }),
            ],
          );
        }

        const textBlocks = body.textBlocks.length ? body.textBlocks : [body.text];
        const defaultOrder = [
          ...textBlocks.map((_, index) => ({ type: "text" as const, index })),
          ...storedMedia.map((_, index) => ({ type: "media" as const, index })),
        ];
        const seen = new Set<string>();
        const validOrder = (body.contentOrder.length ? body.contentOrder : defaultOrder).filter((item) => {
          const key = `${item.type}:${item.index}`;
          if (seen.has(key)) return false;
          const exists = item.type === "text" ? Boolean(textBlocks[item.index]) : Boolean(storedMedia[item.index]);
          if (exists) seen.add(key);
          return exists;
        });
        for (const item of defaultOrder) {
          const key = `${item.type}:${item.index}`;
          if (!seen.has(key)) validOrder.push(item);
        }
        for (const [position, item] of validOrder.entries()) {
          const contentId = randomUUID();
          if (item.type === "text") {
            await client.query(
              `INSERT INTO ${schema}.raw_entry_contents (id, raw_entry_id, position, content_kind, text_content)
               VALUES ($1, $2, $3, 'text', $4)`,
              [contentId, rawEntryId, position, textBlocks[item.index]],
            );
            continue;
          }
          const media = storedMedia[item.index];
          await client.query(
            `INSERT INTO ${schema}.raw_entry_contents (id, raw_entry_id, position, content_kind, media_attachment_id)
             VALUES ($1, $2, $3, $4, $5)`,
            [contentId, rawEntryId, position, media.kind, media.attachmentId],
          );
          if (media.kind === "voice") {
            await client.query(
              `INSERT INTO ${schema}.speech_transcripts (
                 id, raw_entry_content_id, transcript_text, language, provider, model_version
               ) VALUES ($1, $2, $3, $4, $5, 'browser-or-manual')`,
              [randomUUID(), contentId, body.text, body.inputLocale, body.transcriptProvider],
            );
          }
        }

        await client.query(
          `
            INSERT INTO ${schema}.ai_processing_audits (
              id, owner_user_id, raw_entry_id, operation, provider, model_version,
              data_scope, retention_policy, status
            ) VALUES (
              $1, $2, $3, 'event_extraction', $4, $5,
              $6::jsonb,
              $7,
              'started'
            )
          `,
          [
            auditId,
            ownerUserId,
            rawEntryId,
            eventParser.provider,
            eventParser.modelVersion,
            JSON.stringify({
              text: true,
              attachments: false,
              attachmentKinds: [...new Set(storedMedia.map((item) => item.kind))],
              source: storedMedia.some((item) => item.kind === "voice")
                ? "speech_transcript_and_user_text"
                : "user_text",
              locationLabel: Boolean(body.location?.label),
              preciseCoordinates: false,
            }),
            eventParser.retentionPolicy,
          ],
        );
      });
    } catch (error) {
      await Promise.all(storedMedia.map((media) => mediaStorage.delete(media.storageKey).catch(() => undefined)));
      throw error;
    }

    const parsed = await parseAndSaveCandidates({
      ownerUserId,
      rawEntryId,
      auditId,
      text: body.text,
      timezone: body.clientTimezone,
      referenceTime: body.clientCreatedAt ? new Date(body.clientCreatedAt) : new Date(),
      location: parserLocationContext(body.location),
      savedLocation,
    });

    return reply.code(201).send({
      entry: {
        id: rawEntryId,
        status: "awaiting_confirmation",
        text: body.text,
        inputKind: "mixed",
      },
      attachments: storedMedia.map((media) => ({
        id: media.attachmentId,
        kind: media.kind,
        originalFilename: media.filename,
        mimeType: media.mimeType,
        byteSize: media.byteSize,
        durationMs: media.kind === "voice" ? (body.durationMs ?? null) : null,
        url: `/api/media/${media.attachmentId}`,
      })),
      location: savedLocation ?? null,
      candidates: parsed.candidates,
      parser: {
        provider: eventParser.provider,
        model: parsed.resolvedModelVersion,
      },
    });
  });

  app.post("/api/entries/voice", async (request, reply) => {
    requireConfiguredParser();

    const fields: Record<string, string> = {};
    let audio:
      | { buffer: Buffer; filename: string; mimeType: string }
      | undefined;

    for await (const part of request.parts()) {
      if (part.type === "file") {
        if (part.fieldname !== "audio") {
          await part.toBuffer();
          continue;
        }
        if (audio) throw new MediaValidationError("每条记录只能提交一个录音文件");
        audio = {
          buffer: await part.toBuffer(),
          filename: part.filename,
          mimeType: part.mimetype,
        };
      } else {
        fields[part.fieldname] = String(part.value ?? "");
      }
    }

    if (!audio) throw new MediaValidationError("请选择或录制一段语音");
    const body = createVoiceEntrySchema.parse(fields);
    mediaStorage.assertAudio(audio.mimeType, audio.buffer.byteLength);

    const ownerUserId = request.authUser.id;
    const rawEntryId = randomUUID();
    const contentId = randomUUID();
    const transcriptId = randomUUID();
    const attachmentId = randomUUID();
    const auditId = randomUUID();
    let savedLocation: SavedLocationObservation | undefined;

    const stored = await mediaStorage.saveVoice({
      ownerUserId,
      rawEntryId,
      attachmentId,
      filename: audio.filename,
      mimeType: audio.mimeType,
      buffer: audio.buffer,
    });

    try {
      await withTransaction(async (client) => {
        await assertDraftCapacity(client, ownerUserId);
        await client.query(
          `
            INSERT INTO ${schema}.raw_entries (
              id,
              owner_user_id,
              status,
              input_locale,
              client_timezone,
              client_created_at,
              draft_reminder_after
            ) VALUES ($1, $2, 'parsing', $3, $4, $5::timestamptz, now() + interval '24 hours')
          `,
          [rawEntryId, ownerUserId, body.inputLocale, body.clientTimezone, body.clientCreatedAt ?? null],
        );
        if (body.location) {
          savedLocation = await insertLocationObservation(client, {
            rawEntryId,
            ownerUserId,
            location: body.location,
          });
        }
        await client.query(
          `
            INSERT INTO ${schema}.media_attachments (
              id,
              raw_entry_id,
              owner_user_id,
              media_kind,
              storage_key,
              original_filename,
              mime_type,
              byte_size,
              sha256,
              encryption_key_ref,
              duration_ms,
              technical_metadata
            ) VALUES ($1, $2, $3, 'voice', $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
          `,
          [
            attachmentId,
            rawEntryId,
            ownerUserId,
            stored.storageKey,
            audio.filename,
            audio.mimeType,
            stored.byteSize,
            stored.sha256,
            stored.encryptionKeyRef,
            body.durationMs ?? null,
            JSON.stringify({
              capture: "user_initiated",
              transcription: body.transcriptProvider,
              storageProvider: stored.storageProvider,
              envelopeEncrypted: Boolean(stored.encryptionKeyRef),
            }),
          ],
        );
        await client.query(
          `
            INSERT INTO ${schema}.raw_entry_contents (
              id, raw_entry_id, position, content_kind, media_attachment_id
            ) VALUES ($1, $2, 0, 'voice', $3)
          `,
          [contentId, rawEntryId, attachmentId],
        );
        await scheduleDraftReminder(client, rawEntryId, ownerUserId);
        await client.query(
          `
            INSERT INTO ${schema}.speech_transcripts (
              id,
              raw_entry_content_id,
              transcript_text,
              language,
              provider,
              model_version
            ) VALUES ($1, $2, $3, $4, $5, 'web-speech-api')
          `,
          [transcriptId, contentId, body.transcript, body.inputLocale, body.transcriptProvider],
        );
        await client.query(
          `
            INSERT INTO ${schema}.ai_processing_audits (
              id, owner_user_id, raw_entry_id, operation, provider, model_version,
              data_scope, retention_policy, status
            ) VALUES (
              $1, $2, $3, 'event_extraction', $4, $5,
              $6::jsonb,
              $7,
              'started'
            )
          `,
          [
            auditId,
            ownerUserId,
            rawEntryId,
            eventParser.provider,
            eventParser.modelVersion,
            JSON.stringify({
              text: true,
              attachments: false,
              source: "speech_transcript",
              locationLabel: Boolean(body.location?.label),
              preciseCoordinates: false,
            }),
            eventParser.retentionPolicy,
          ],
        );
      });
    } catch (error) {
      await mediaStorage.delete(stored.storageKey).catch(() => undefined);
      throw error;
    }

    const parsed = await parseAndSaveCandidates({
      ownerUserId,
      rawEntryId,
      auditId,
      text: body.transcript,
      timezone: body.clientTimezone,
      referenceTime: body.clientCreatedAt ? new Date(body.clientCreatedAt) : new Date(),
      location: parserLocationContext(body.location),
      savedLocation,
    });

    return reply.code(201).send({
      entry: {
        id: rawEntryId,
        status: "awaiting_confirmation",
        text: body.transcript,
        inputKind: "voice",
      },
      media: {
        id: attachmentId,
        mimeType: audio.mimeType,
        byteSize: stored.byteSize,
        durationMs: body.durationMs ?? null,
        url: `/api/media/${attachmentId}`,
      },
      location: savedLocation ?? null,
      candidates: parsed.candidates,
      parser: {
        provider: eventParser.provider,
        model: parsed.resolvedModelVersion,
      },
    });
  });

  app.post<{ Params: { entryId: string } }>("/api/entries/:entryId/text-blocks", async (request, reply) => {
    requireConfiguredParser();
    const body = appendDraftTextSchema.parse(request.body);
    const ownerUserId = request.authUser.id;
    const entryId = request.params.entryId;
    const auditId = randomUUID();
    const prepared = await withTransaction(async (client) => {
      const entryResult = await client.query<{ timezone: string; referenceTime: string; candidateIndexOffset: number }>(
        `SELECT entry.client_timezone AS timezone,
                COALESCE(entry.client_created_at, entry.created_at)::text AS "referenceTime",
                COALESCE((SELECT max(candidate_index) + 1 FROM ${schema}.event_candidates WHERE raw_entry_id = entry.id), 0)::int AS "candidateIndexOffset"
         FROM ${schema}.raw_entries entry
         WHERE entry.id = $1 AND entry.owner_user_id = $2 AND entry.status = 'awaiting_confirmation' AND entry.deleted_at IS NULL
         FOR UPDATE`,
        [entryId, ownerUserId],
      );
      const entry = entryResult.rows[0];
      if (!entry) throw new EntryConflictError("只有待确认草稿可以追加内容");
      const positionResult = await client.query<{ position: number }>(
        `SELECT COALESCE(max(position) + 1, 0)::int AS position FROM ${schema}.raw_entry_contents WHERE raw_entry_id = $1`,
        [entryId],
      );
      await client.query(
        `INSERT INTO ${schema}.raw_entry_contents (id, raw_entry_id, position, content_kind, text_content)
         VALUES ($1, $2, $3, 'text', $4)`,
        [randomUUID(), entryId, positionResult.rows[0].position, body.text],
      );
      await client.query(`UPDATE ${schema}.event_candidates SET status = 'superseded', updated_at = now() WHERE raw_entry_id = $1 AND status = 'pending'`, [entryId]);
      await client.query(`UPDATE ${schema}.raw_entries SET status = 'parsing', updated_at = now() WHERE id = $1`, [entryId]);
      await client.query(
        `INSERT INTO ${schema}.ai_processing_audits (
           id, owner_user_id, raw_entry_id, operation, provider, model_version, data_scope, retention_policy, status
         ) VALUES ($1,$2,$3,'event_extraction',$4,$5,'{"text":true,"attachments":false,"source":"draft_append"}'::jsonb,$6,'started')`,
        [auditId, ownerUserId, entryId, eventParser.provider, eventParser.modelVersion, eventParser.retentionPolicy],
      );
      const textResult = await client.query<{ text: string }>(
        `SELECT string_agg(COALESCE(content.text_content, transcript.transcript_text), E'\n' ORDER BY content.position) AS text
         FROM ${schema}.raw_entry_contents content
         LEFT JOIN ${schema}.speech_transcripts transcript ON transcript.raw_entry_content_id = content.id
         WHERE content.raw_entry_id = $1`,
        [entryId],
      );
      return { ...entry, text: textResult.rows[0].text };
    });
    const parsed = await parseAndSaveCandidates({
      ownerUserId, rawEntryId: entryId, auditId, text: prepared.text, timezone: prepared.timezone,
      referenceTime: new Date(prepared.referenceTime), candidateIndexOffset: prepared.candidateIndexOffset,
    });
    return reply.code(201).send({ entry: { id: entryId, status: "awaiting_confirmation", text: prepared.text }, candidates: parsed.candidates, parser: { provider: eventParser.provider, model: parsed.resolvedModelVersion } });
  });

  app.get("/api/entries/drafts", async (request) => {
    const result = await pool.query(
      `
        SELECT
          re.id,
          re.status,
          re.created_at AS "createdAt",
          re.draft_reminder_after AS "draftReminderAfter",
          source."contentKind",
          source.text,
          attachment_data.attachments,
          loc.location,
          candidate_data.candidates
        FROM ${schema}.raw_entries re
        LEFT JOIN LATERAL (
          SELECT
            CASE WHEN text_content.text IS NOT NULL THEN 'text' ELSE 'voice' END AS "contentKind",
            COALESCE(text_content.text, voice_content.transcript) AS text
          FROM (SELECT 1) singleton
          LEFT JOIN LATERAL (
            SELECT string_agg(rec.text_content, E'\n' ORDER BY rec.position) AS text
            FROM ${schema}.raw_entry_contents rec
            WHERE rec.raw_entry_id = re.id AND rec.content_kind = 'text'
          ) text_content ON true
          LEFT JOIN LATERAL (
            SELECT st.transcript_text AS transcript
            FROM ${schema}.raw_entry_contents rec
            JOIN ${schema}.speech_transcripts st ON st.raw_entry_content_id = rec.id
            WHERE rec.raw_entry_id = re.id AND rec.content_kind = 'voice'
            ORDER BY rec.position
            LIMIT 1
          ) voice_content ON true
        ) source ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', ma.id,
                'kind', ma.media_kind,
                'originalFilename', ma.original_filename,
                'mimeType', ma.mime_type,
                'byteSize', ma.byte_size,
                'durationMs', ma.duration_ms,
                'url', '/api/media/' || ma.id
              )
              ORDER BY rec.position
            ),
            '[]'::json
          ) AS attachments
          FROM ${schema}.raw_entry_contents rec
          JOIN ${schema}.media_attachments ma
            ON ma.id = rec.media_attachment_id AND ma.deleted_at IS NULL
          WHERE rec.raw_entry_id = re.id
        ) attachment_data ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'id', lo.id,
            'latitude', lo.latitude::double precision,
            'longitude', lo.longitude::double precision,
            'accuracyM', lo.accuracy_m::double precision,
            'capturedAt', lo.captured_at,
            'label', lo.user_label,
            'defaultEventRole', lo.default_event_role,
            'socialMatching', lo.match_eligible,
            'sensitivity', lo.sensitivity
          ) AS location
          FROM ${schema}.location_observations lo
          WHERE lo.raw_entry_id = re.id AND lo.deleted_at IS NULL
          ORDER BY lo.created_at
          LIMIT 1
        ) loc ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', ec.id,
                'payload', ec.payload,
                'parserProvider', ec.parser_provider,
                'parserModelVersion', ec.parser_model_version
              )
              ORDER BY ec.candidate_index
            ),
            '[]'::json
          ) AS candidates
          FROM ${schema}.event_candidates ec
          WHERE ec.raw_entry_id = re.id AND ec.status = 'pending'
        ) candidate_data ON true
        WHERE re.owner_user_id = $1
          AND re.status IN ('awaiting_confirmation', 'failed')
          AND re.deleted_at IS NULL
        ORDER BY re.created_at DESC
        LIMIT 30
      `,
      [request.authUser.id],
    );

    return { drafts: result.rows };
  });

  app.get<{ Params: { attachmentId: string } }>(
    "/api/media/:attachmentId",
    async (request, reply) => {
      const result = await pool.query<{ storageKey: string; mimeType: string; mediaKind: MediaKind; originalFilename: string | null }>(
        `
          SELECT
            storage_key AS "storageKey",
            mime_type AS "mimeType",
            media_kind AS "mediaKind",
            original_filename AS "originalFilename"
          FROM ${schema}.media_attachments
          WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
        `,
        [request.params.attachmentId, request.authUser.id],
      );

      const media = result.rows[0];
      if (!media) return reply.code(404).send({ message: "附件不存在" });
      const stored = await mediaStorage.open(media.storageKey);
      reply.header("Content-Type", media.mimeType);
      reply.header("Content-Length", String(stored.size));
      reply.header("Cache-Control", "private, no-store");
      reply.header("X-Content-Type-Options", "nosniff");
      if (media.mediaKind === "file") {
        const filename = encodeURIComponent(media.originalFilename || "attachment");
        reply.header("Content-Disposition", `attachment; filename*=UTF-8''${filename}`);
      }
      return reply.send(stored.stream);
    },
  );

  app.post<{ Params: { entryId: string } }>("/api/entries/:entryId/confirm", async (request) => {
    const { entryId } = request.params;
    const body = confirmEntrySchema.parse(request.body);
    const ownerUserId = request.authUser.id;

    const eventIds = await withTransaction(async (client) => {
      const entryResult = await client.query<{ status: string }>(
        `
          SELECT status
          FROM ${schema}.raw_entries
          WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL
          FOR UPDATE
        `,
        [entryId, ownerUserId],
      );

      if (!entryResult.rows[0]) throw new EntryConflictError("记录不存在");
      if (entryResult.rows[0].status !== "awaiting_confirmation") {
        throw new EntryConflictError("记录当前状态不能确认");
      }

      const allowedCandidates = await client.query<{
        id: string;
        payload: EventCandidatePayload;
        candidateIndex: number;
        parserProvider: string;
        parserModelVersion: string | null;
      }>(
        `SELECT
           id,
           payload,
           candidate_index AS "candidateIndex",
           parser_provider AS "parserProvider",
           parser_model_version AS "parserModelVersion"
         FROM ${schema}.event_candidates
         WHERE raw_entry_id = $1 AND status = 'pending'
         ORDER BY candidate_index
         FOR UPDATE`,
        [entryId],
      );
      const allowedById = new Map(allowedCandidates.rows.map((row) => [row.id, row]));
      const accountedIds = new Set([
        ...body.accepted.flatMap((candidate) => candidate.sourceCandidateIds),
        ...body.rejectedCandidateIds,
      ]);
      if (
        [...accountedIds].some((id) => !allowedById.has(id)) ||
        allowedCandidates.rows.some((candidate) => !accountedIds.has(candidate.id))
      ) throw new EntryConflictError("必须明确处理当前记录的全部候选事件");

      const sourceUseCount = new Map<string, number>();
      for (const resolution of body.accepted) {
        for (const sourceId of resolution.sourceCandidateIds) {
          sourceUseCount.set(sourceId, (sourceUseCount.get(sourceId) ?? 0) + 1);
        }
      }

      const requestedLocationIds = [
        ...new Set(
          body.accepted.flatMap((candidate) =>
            candidate.location ? [candidate.location.observationId] : [],
          ),
        ),
      ];
      const locationResult = requestedLocationIds.length
        ? await client.query<{
            id: string;
            matchEligible: boolean;
            sensitivity: "normal" | "sensitive" | "prohibited";
          }>(
            `
              SELECT
                id,
                match_eligible AS "matchEligible",
                sensitivity
              FROM ${schema}.location_observations
              WHERE raw_entry_id = $1
                AND owner_user_id = $2
                AND id = ANY($3::uuid[])
                AND deleted_at IS NULL
            `,
            [entryId, ownerUserId, requestedLocationIds],
          )
        : { rows: [] };
      const allowedLocations = new Map(locationResult.rows.map((location) => [location.id, location]));
      if (requestedLocationIds.some((id) => !allowedLocations.has(id))) {
        throw new EntryConflictError("定位信息不属于当前记录或已经删除");
      }

      let nextCandidateIndex = Math.max(-1, ...allowedCandidates.rows.map((row) => row.candidateIndex)) + 1;
      const createdEventIds: string[] = [];
      const directAcceptedSourceIds = new Set<string>();
      const resolvedCandidateIds = new Map<string, string>();

      for (const resolution of body.accepted) {
        const direct = resolution.sourceCandidateIds.length === 1 && sourceUseCount.get(resolution.sourceCandidateIds[0]) === 1;
        let acceptedCandidateId: string;
        if (direct) {
          acceptedCandidateId = resolution.sourceCandidateIds[0];
          directAcceptedSourceIds.add(acceptedCandidateId);
          await client.query(
            `UPDATE ${schema}.event_candidates
             SET status = 'accepted', payload = $2::jsonb, overall_confidence = $3, updated_at = now()
             WHERE id = $1`,
            [acceptedCandidateId, JSON.stringify(resolution.payload), resolution.payload.confidence],
          );
        } else {
          acceptedCandidateId = randomUUID();
          await client.query(
            `INSERT INTO ${schema}.event_candidates (
               id, raw_entry_id, candidate_index, status, payload, overall_confidence,
               field_confidences, schema_version, parser_provider, parser_model_version
             ) VALUES ($1, $2, $3, 'accepted', $4::jsonb, $5, '{}'::jsonb, $6, 'user_resolution', $7)`,
            [
              acceptedCandidateId,
              entryId,
              nextCandidateIndex,
              JSON.stringify(resolution.payload),
              resolution.payload.confidence,
              resolution.payload.schemaVersion,
              resolution.sourceCandidateIds.length > 1 ? "manual-merge/v1" : "manual-split/v1",
            ],
          );
          nextCandidateIndex += 1;
        }
        resolvedCandidateIds.set(resolution.resolutionId, acceptedCandidateId);

        const observation = resolution.location
          ? allowedLocations.get(resolution.location.observationId)
          : undefined;
        createdEventIds.push(
          await insertConfirmedEvent(
            client,
            ownerUserId,
            entryId,
            acceptedCandidateId,
            resolution.payload,
            resolution.location && observation
              ? {
                  observationId: resolution.location.observationId,
                  role: resolution.location.role,
                  socialMatchEligible:
                    resolution.location.role === "occurred_at" &&
                    observation.matchEligible &&
                    observation.sensitivity === "normal",
                }
              : undefined,
          ),
        );

        const sourceSnapshots = resolution.sourceCandidateIds.map((id) => ({
          candidateId: id,
          payload: allowedById.get(id)!.payload,
        }));
        const resolutionType = resolution.sourceCandidateIds.length > 1
          ? "merge"
          : (sourceUseCount.get(resolution.sourceCandidateIds[0]) ?? 0) > 1
            ? "split"
            : "accept";
        const changedFields = resolutionType === "accept"
          ? jsonChangedPaths(sourceSnapshots[0].payload, resolution.payload)
          : jsonChangedPaths(sourceSnapshots.map((item) => item.payload), resolution.payload);
        await client.query(
          `INSERT INTO ${schema}.user_feedback (
             id, owner_user_id, raw_entry_id, feedback_type, before_value, after_value
           ) VALUES ($1, $2, $3, 'candidate_resolution', $4::jsonb, $5::jsonb)`,
          [
            randomUUID(),
            ownerUserId,
            entryId,
            JSON.stringify({ sourceCandidates: sourceSnapshots }),
            JSON.stringify({
              resolutionId: resolution.resolutionId,
              acceptedCandidateId,
              sourceCandidateIds: resolution.sourceCandidateIds,
              resolutionType,
              changedFields,
              payload: resolution.payload,
            }),
          ],
        );
      }

      const acceptedSourceIds = [...sourceUseCount.keys()];
      const supersededSourceIds = acceptedSourceIds.filter((id) => !directAcceptedSourceIds.has(id));
      if (supersededSourceIds.length) {
        await client.query(
          `UPDATE ${schema}.event_candidates SET status = 'superseded', updated_at = now()
           WHERE id = ANY($1::uuid[])`,
          [supersededSourceIds],
        );
      }
      if (body.rejectedCandidateIds.length) {
        await client.query(
          `UPDATE ${schema}.event_candidates SET status = 'rejected', updated_at = now()
           WHERE id = ANY($1::uuid[])`,
          [body.rejectedCandidateIds],
        );
        for (const candidateId of body.rejectedCandidateIds) {
          await client.query(
            `INSERT INTO ${schema}.user_feedback (
               id, owner_user_id, raw_entry_id, feedback_type, before_value, after_value
             ) VALUES ($1, $2, $3, 'candidate_rejected', $4::jsonb, $5::jsonb)`,
            [
              randomUUID(), ownerUserId, entryId,
              JSON.stringify({ candidateId, payload: allowedById.get(candidateId)!.payload }),
              JSON.stringify({ candidateId, decision: "rejected" }),
            ],
          );
        }
      }
      await client.query(
        `
          UPDATE ${schema}.raw_entries
          SET status = 'confirmed', confirmed_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1
        `,
        [entryId],
      );
      await client.query(
        `UPDATE ${schema}.draft_reminders SET status = 'cancelled' WHERE raw_entry_id = $1`,
        [entryId],
      );
      await client.query(
        `
          UPDATE ${schema}.notifications
          SET status = 'dismissed', updated_at = now()
          WHERE owner_user_id = $1
            AND resource_type = 'raw_entry'
            AND resource_id = $2
            AND status IN ('pending', 'delivered', 'read')
        `,
        [ownerUserId, entryId],
      );

      // Only confirmed facts can enter the revocable, privacy-filtered social read model.
      await refreshSocialProjectionsForUser(client, ownerUserId);

      return createdEventIds;
    });

    return { entryId, status: "confirmed", eventIds };
  });

  app.get("/api/timeline", async (request) => {
    const query = timelineQuerySchema.parse(request.query);
    const result = await pool.query(
      `
        SELECT
          e.id,
          count(*) OVER()::int AS "totalCount",
          e.version,
          e.event_type AS "eventType",
          e.title,
          e.factual_status AS "factualStatus",
          CASE
            WHEN e.owner_user_id = $1 THEN e.occurred_start
            ELSE date_trunc('day', e.occurred_start)
          END AS "occurredStart",
          CASE
            WHEN e.owner_user_id = $1 THEN e.occurred_end
            ELSE date_trunc('day', e.occurred_end)
          END AS "occurredEnd",
          e.time_precision AS "timePrecision",
          CASE WHEN e.owner_user_id = $1 THEN e.timezone ELSE NULL END AS timezone,
          CASE
            WHEN e.owner_user_id = $1 THEN e.source_time_expression
            ELSE NULL
          END AS "sourceTimeExpression",
          CASE
            WHEN e.owner_user_id = $1 THEN e.created_at
            ELSE date_trunc('day', e.created_at)
          END AS "createdAt",
          (e.owner_user_id = $1) AS "isOwned",
          json_build_object(
            'id', event_owner.id,
            'username', event_owner.username,
            'displayName', event_owner.display_name
          ) AS owner,
          loc.location,
          attachment_data.attachments,
          entity_data.entities,
          participant_data.participants
        FROM ${schema}.events e
        JOIN ${schema}.users event_owner ON event_owner.id = e.owner_user_id
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', CASE WHEN e.owner_user_id = $1 THEN ue.id ELSE ce.id END,
                'name', CASE WHEN e.owner_user_id = $1 THEN ue.display_name ELSE ce.canonical_name END,
                'type', CASE WHEN e.owner_user_id = $1 THEN ue.entity_type ELSE ce.entity_type END,
                'role', eer.relation_role,
                'quantity', CASE WHEN e.owner_user_id = $1 THEN eer.quantity ELSE NULL END,
                'unit', CASE WHEN e.owner_user_id = $1 THEN eer.unit ELSE NULL END,
                'amount', CASE WHEN e.owner_user_id = $1 THEN eer.amount ELSE NULL END,
                'currency', CASE WHEN e.owner_user_id = $1 THEN eer.currency ELSE NULL END,
                'attributes', CASE WHEN e.owner_user_id = $1 THEN eer.attributes ELSE '{}'::jsonb END
              )
              ORDER BY eer.created_at
            ),
            '[]'::json
          ) AS entities
          FROM ${schema}.event_entity_relations eer
          JOIN ${schema}.user_entities ue ON ue.id = eer.user_entity_id
          LEFT JOIN ${schema}.canonical_entities ce ON ce.id = eer.canonical_entity_id
          WHERE eer.event_id = e.id
            AND (
              e.owner_user_id = $1
              OR (ce.id IS NOT NULL AND ce.sensitivity = 'normal')
            )
        ) entity_data ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', ep.id,
                'userEntityId', CASE WHEN e.owner_user_id = $1 THEN ep.user_entity_id ELSE NULL END,
                'name', COALESCE(account_user.display_name, person_entity.display_name),
                'role', ep.participant_role,
                'isCurrentUser', ep.account_user_id = $1,
                'isAccount', ep.account_user_id IS NOT NULL AND ep.identity_confirmed,
                'link', CASE WHEN outgoing_invite.id IS NULL THEN NULL ELSE json_build_object(
                  'inviteId', outgoing_invite.id,
                  'status', outgoing_invite.status,
                  'username', target_user.username,
                  'displayName', target_user.display_name
                ) END
              )
              ORDER BY ep.created_at
            ),
            '[]'::json
          ) AS participants
          FROM ${schema}.event_participants ep
          LEFT JOIN ${schema}.users account_user ON account_user.id = ep.account_user_id
          LEFT JOIN ${schema}.user_entities person_entity ON person_entity.id = ep.user_entity_id
          LEFT JOIN LATERAL (
            SELECT invite.id, invite.status, invite.target_user_id
            FROM ${schema}.event_participant_account_invites invite
            WHERE invite.event_participant_id = ep.id
              AND invite.owner_user_id = $1
              AND invite.status IN ('invited', 'accepted')
            ORDER BY invite.updated_at DESC
            LIMIT 1
          ) outgoing_invite ON true
          LEFT JOIN ${schema}.users target_user ON target_user.id = outgoing_invite.target_user_id
          WHERE ep.event_id = e.id
            AND (
              e.owner_user_id = $1
              OR (ep.account_user_id IS NOT NULL AND ep.identity_confirmed)
            )
        ) participant_data ON true
        LEFT JOIN LATERAL (
          SELECT COALESCE(
            json_agg(
              json_build_object(
                'id', ma.id,
                'kind', ma.media_kind,
                'originalFilename', ma.original_filename,
                'mimeType', ma.mime_type,
                'byteSize', ma.byte_size,
                'durationMs', ma.duration_ms,
                'url', '/api/media/' || ma.id
              )
              ORDER BY rec.position
            ),
            '[]'::json
          ) AS attachments
          FROM ${schema}.raw_entry_contents rec
          JOIN ${schema}.media_attachments ma
            ON ma.id = rec.media_attachment_id AND ma.deleted_at IS NULL
          WHERE rec.raw_entry_id = e.raw_entry_id
            AND e.owner_user_id = $1
        ) attachment_data ON true
        LEFT JOIN LATERAL (
          SELECT jsonb_build_object(
            'id', lo.id,
            'label', lo.user_label,
            'latitude', lo.latitude::double precision,
            'longitude', lo.longitude::double precision,
            'accuracyM', lo.accuracy_m::double precision,
            'role', ell.location_role,
            'socialMatching', ell.social_match_eligible
          ) AS location
          FROM ${schema}.event_location_links ell
          JOIN ${schema}.location_observations lo ON lo.id = ell.location_observation_id
          WHERE ell.event_id = e.id
            AND e.owner_user_id = $1
            AND lo.deleted_at IS NULL
          ORDER BY CASE ell.location_role WHEN 'occurred_at' THEN 0 ELSE 1 END, ell.created_at
          LIMIT 1
        ) loc ON true
        WHERE e.deleted_at IS NULL
          AND ($2 = '' OR e.title ILIKE '%' || $2 || '%'
            OR EXISTS (
              SELECT 1 FROM ${schema}.raw_entry_contents search_content
              WHERE search_content.raw_entry_id = e.raw_entry_id
                AND e.owner_user_id = $1
                AND (search_content.text_content ILIKE '%' || $2 || '%'
                  OR EXISTS (SELECT 1 FROM ${schema}.speech_transcripts search_transcript
                             WHERE search_transcript.raw_entry_content_id = search_content.id
                               AND search_transcript.transcript_text ILIKE '%' || $2 || '%'))
            )
            OR EXISTS (
              SELECT 1 FROM ${schema}.event_entity_relations search_relation
              JOIN ${schema}.user_entities search_entity ON search_entity.id = search_relation.user_entity_id
              WHERE search_relation.event_id = e.id
                AND (search_entity.display_name ILIKE '%' || $2 || '%'
                  OR EXISTS (SELECT 1 FROM ${schema}.entity_aliases search_alias
                             WHERE search_alias.user_entity_id = search_entity.id AND search_alias.alias ILIKE '%' || $2 || '%'))
            )
            OR EXISTS (
              SELECT 1 FROM ${schema}.event_participants search_participant
              LEFT JOIN ${schema}.user_entities search_person ON search_person.id = search_participant.user_entity_id
              LEFT JOIN ${schema}.users search_user ON search_user.id = search_participant.account_user_id
              WHERE search_participant.event_id = e.id
                AND COALESCE(search_person.display_name, search_user.display_name) ILIKE '%' || $2 || '%'
            ))
          AND ($3::text IS NULL OR e.event_type = $3)
          AND ($4::uuid IS NULL OR EXISTS (SELECT 1 FROM ${schema}.event_entity_relations filter_relation WHERE filter_relation.event_id = e.id AND filter_relation.user_entity_id = $4))
          AND ($5::uuid IS NULL OR EXISTS (SELECT 1 FROM ${schema}.event_participants filter_person WHERE filter_person.event_id = e.id AND filter_person.user_entity_id = $5))
          AND ($6::uuid IS NULL OR EXISTS (SELECT 1 FROM ${schema}.event_entity_relations filter_place WHERE filter_place.event_id = e.id AND filter_place.user_entity_id = $6))
          AND ($7::timestamptz IS NULL OR COALESCE(e.occurred_start, e.created_at) >= $7)
          AND ($8::timestamptz IS NULL OR COALESCE(e.occurred_start, e.created_at) < $8)
          AND (
            e.owner_user_id = $1
            OR EXISTS (
              SELECT 1
              FROM ${schema}.event_occurrence_links occurrence_link
              JOIN ${schema}.occurrence_memberships membership
                ON membership.occurrence_id = occurrence_link.occurrence_id
              WHERE occurrence_link.event_id = e.id
                AND occurrence_link.link_status = 'active'
                AND membership.user_id = $1
                AND membership.membership_status = 'accepted'
            )
          )
        ORDER BY COALESCE(e.occurred_start, e.created_at) DESC, e.created_at DESC, e.id DESC
        LIMIT $9 OFFSET $10
      `,
      [
        request.authUser.id, query.q, query.eventType ?? null, query.entityId ?? null,
        query.personId ?? null, query.placeId ?? null, query.from ?? null, query.to ?? null,
        query.limit, (query.page - 1) * query.limit,
      ],
    );

    const total = Number((result.rows[0] as { totalCount?: number } | undefined)?.totalCount ?? 0);
    return { events: result.rows.map(({ totalCount: _totalCount, ...event }) => event), page: query.page, limit: query.limit, total };
  });

  app.delete<{ Params: { entryId: string } }>("/api/entries/:entryId", async (request, reply) => {
    const storageKeys = await withTransaction(async (client) => {
      const result = await client.query(
        `
          UPDATE ${schema}.raw_entries
          SET status = 'deleted', deleted_at = now(), updated_at = now(), version = version + 1
          WHERE id = $1
            AND owner_user_id = $2
            AND status IN ('awaiting_confirmation', 'failed')
            AND deleted_at IS NULL
          RETURNING id
        `,
        [request.params.entryId, request.authUser.id],
      );

      if (!result.rowCount) return null;
      const attachments = await client.query<{ storageKey: string }>(
        `
          UPDATE ${schema}.media_attachments
          SET deleted_at = now()
          WHERE raw_entry_id = $1 AND deleted_at IS NULL
          RETURNING storage_key AS "storageKey"
        `,
        [request.params.entryId],
      );
      await client.query(
        `UPDATE ${schema}.draft_reminders SET status = 'cancelled' WHERE raw_entry_id = $1`,
        [request.params.entryId],
      );
      await client.query(
        `
          UPDATE ${schema}.notifications
          SET status = 'dismissed', updated_at = now()
          WHERE owner_user_id = $1
            AND resource_type = 'raw_entry'
            AND resource_id = $2
            AND status IN ('pending', 'delivered', 'read')
        `,
        [request.authUser.id, request.params.entryId],
      );
      await client.query(
        `
          UPDATE ${schema}.location_observations
          SET deleted_at = now(), updated_at = now(), match_eligible = false, social_cell = NULL
          WHERE raw_entry_id = $1 AND deleted_at IS NULL
        `,
        [request.params.entryId],
      );
      return attachments.rows.map((row) => row.storageKey);
    });

    if (!storageKeys) return reply.code(404).send({ message: "待确认记录不存在" });
    await Promise.all(storageKeys.map((storageKey) => mediaStorage.delete(storageKey)));
    return reply.code(204).send();
  });
};

export { DraftLimitError, EntryConflictError };
