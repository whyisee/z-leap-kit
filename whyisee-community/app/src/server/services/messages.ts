import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "@server/db/client";
import { createNotification, markNotificationsReadByTarget } from "./notifications";

export interface DirectConversationSummary {
  id: number;
  participantId: number;
  participantUsername: string;
  participantName: string;
  participantAvatarUrl: string | null;
  lastMessageBody: string;
  lastMessageAt: string;
  lastSenderId: number | null;
  unreadCount: number;
}

export interface DirectMessageItem {
  id: number;
  conversationId: number;
  senderId: number;
  senderUsername: string;
  senderName: string;
  senderAvatarUrl: string | null;
  body: string;
  createdAt: string;
  isMine: boolean;
}

interface ConversationRow {
  id: number;
  participant_id: number;
  participant_username: string;
  participant_name: string;
  participant_avatar_url: string | null;
  last_message_body: string | null;
  last_message_at: string | null;
  last_sender_id: number | null;
  unread_count: string;
  updated_at: string;
}

interface MessageRow {
  id: number;
  conversation_id: number;
  sender_id: number;
  sender_username: string;
  sender_name: string;
  sender_avatar_url: string | null;
  body: string;
  created_at: string;
}

interface UserLookupRow {
  id: number;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

export async function listDirectConversations(userId: number, limit = 50): Promise<DirectConversationSummary[]> {
  const rows = await query<ConversationRow>(
    `
    SELECT
      conversations.id,
      other_participants.user_id AS participant_id,
      users.username AS participant_username,
      users.display_name AS participant_name,
      users.avatar_url AS participant_avatar_url,
      last_message.body AS last_message_body,
      last_message.created_at AS last_message_at,
      last_message.sender_id AS last_sender_id,
      unread_messages.count AS unread_count,
      conversations.updated_at
    FROM direct_conversation_participants participants
    INNER JOIN direct_conversations conversations ON conversations.id = participants.conversation_id
    INNER JOIN direct_conversation_participants other_participants
      ON other_participants.conversation_id = conversations.id
     AND other_participants.user_id <> participants.user_id
    INNER JOIN users ON users.id = other_participants.user_id
    LEFT JOIN LATERAL (
      SELECT sender_id, body, created_at
      FROM direct_messages
      WHERE conversation_id = conversations.id
        AND deleted_at IS NULL
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    ) last_message ON TRUE
    LEFT JOIN LATERAL (
      SELECT COUNT(*)::text AS count
      FROM direct_messages
      WHERE conversation_id = conversations.id
        AND sender_id <> participants.user_id
        AND deleted_at IS NULL
        AND (
          participants.last_read_at IS NULL
          OR created_at > participants.last_read_at
        )
    ) unread_messages ON TRUE
    WHERE participants.user_id = $1
      AND participants.archived_at IS NULL
    ORDER BY COALESCE(last_message.created_at, conversations.updated_at) DESC, conversations.id DESC
    LIMIT $2
    `,
    [userId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    participantId: row.participant_id,
    participantUsername: row.participant_username,
    participantName: row.participant_name,
    participantAvatarUrl: row.participant_avatar_url,
    lastMessageBody: row.last_message_body || "",
    lastMessageAt: row.last_message_at || row.updated_at,
    lastSenderId: row.last_sender_id,
    unreadCount: Number(row.unread_count || 0),
  }));
}

export async function listDirectMessages(userId: number, conversationId: number, limit = 80): Promise<DirectMessageItem[]> {
  const canRead = await isConversationParticipant(userId, conversationId);

  if (!canRead) {
    return [];
  }

  const rows = await query<MessageRow>(
    `
    SELECT
      messages.id,
      messages.conversation_id,
      messages.sender_id,
      users.username AS sender_username,
      users.display_name AS sender_name,
      users.avatar_url AS sender_avatar_url,
      messages.body,
      messages.created_at
    FROM direct_messages messages
    INNER JOIN users ON users.id = messages.sender_id
    WHERE messages.conversation_id = $1
      AND messages.deleted_at IS NULL
    ORDER BY messages.created_at ASC, messages.id ASC
    LIMIT $2
    `,
    [conversationId, limit],
  );

  return rows.map((row) => ({
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    senderUsername: row.sender_username,
    senderName: row.sender_name,
    senderAvatarUrl: row.sender_avatar_url,
    body: row.body,
    createdAt: row.created_at,
    isMine: row.sender_id === userId,
  }));
}

export async function sendDirectMessage(input: {
  senderId: number;
  recipientUsername?: string;
  conversationId?: number;
  body: string;
}) {
  const body = normalizeMessageBody(input.body);

  if (!body) {
    throw new Error("Message body is required.");
  }

  const now = new Date().toISOString();
  const result = await withTransaction(async (client) => {
    const sender = await client.query<UserLookupRow>(
      "SELECT id, username, display_name, avatar_url FROM users WHERE id = $1 AND status = 'active' LIMIT 1",
      [input.senderId],
    );
    const senderUser = sender.rows[0];

    if (!senderUser) {
      throw new Error("Sender is unavailable.");
    }

    const recipient = input.conversationId
      ? await findConversationRecipient(client, input.senderId, input.conversationId)
      : await findRecipientByUsername(client, input.senderId, input.recipientUsername || "");

    if (!recipient) {
      throw new Error("Recipient is unavailable.");
    }

    await assertNotBlocked(client, input.senderId, recipient.id);

    const key = buildConversationKey(input.senderId, recipient.id);
    const conversation = await client.query<{ id: number }>(
      `
      INSERT INTO direct_conversations (conversation_key, created_at, updated_at)
      VALUES ($1, $2, $2)
      ON CONFLICT (conversation_key) DO UPDATE SET updated_at = EXCLUDED.updated_at
      RETURNING id
      `,
      [key, now],
    );
    const conversationId = conversation.rows[0]?.id;

    if (!conversationId) {
      throw new Error("Conversation is unavailable.");
    }

    await client.query(
      `
      INSERT INTO direct_conversation_participants (conversation_id, user_id, created_at)
      VALUES ($1, $2, $3), ($1, $4, $3)
      ON CONFLICT (conversation_id, user_id) DO UPDATE SET archived_at = NULL
      `,
      [conversationId, input.senderId, now, recipient.id],
    );

    const message = await client.query<{ id: number }>(
      `
      INSERT INTO direct_messages (conversation_id, sender_id, body, created_at)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [conversationId, input.senderId, body, now],
    );

    await client.query(
      "UPDATE direct_conversation_participants SET last_read_at = $1 WHERE conversation_id = $2 AND user_id = $3",
      [now, conversationId, input.senderId],
    );

    return {
      conversationId,
      messageId: message.rows[0]?.id || 0,
      sender: senderUser,
      recipient,
      body,
    };
  });

  await createNotification({
    userId: result.recipient.id,
    actorId: result.sender.id,
    type: "direct_message",
    targetType: "direct_conversation",
    targetId: result.conversationId,
    title: `${result.sender.display_name} 给你发来私信`,
    body: buildSnippet(result.body),
    href: `/notifications?tab=messages&conversation=${result.conversationId}`,
  });

  return result;
}

export async function markConversationRead(userId: number, conversationId: number) {
  await query(
    `
    UPDATE direct_conversation_participants
    SET last_read_at = $1
    WHERE user_id = $2
      AND conversation_id = $3
    `,
    [new Date().toISOString(), userId, conversationId],
  );

  await markNotificationsReadByTarget(userId, "direct_conversation", conversationId);
}

export async function countUnreadDirectMessages(userId: number) {
  const row = await queryOne<{ count: string }>(
    `
    SELECT COUNT(*)::text AS count
    FROM direct_conversation_participants participants
    INNER JOIN direct_messages messages ON messages.conversation_id = participants.conversation_id
    WHERE participants.user_id = $1
      AND messages.sender_id <> $1
      AND messages.deleted_at IS NULL
      AND (
        participants.last_read_at IS NULL
        OR messages.created_at > participants.last_read_at
      )
    `,
    [userId],
  );

  return Number(row?.count || 0);
}

async function isConversationParticipant(userId: number, conversationId: number) {
  const row = await queryOne<{ conversation_id: number }>(
    `
    SELECT conversation_id
    FROM direct_conversation_participants
    WHERE conversation_id = $1
      AND user_id = $2
      AND archived_at IS NULL
    LIMIT 1
    `,
    [conversationId, userId],
  );

  return Boolean(row);
}

async function findConversationRecipient(
  client: PoolClient,
  senderId: number,
  conversationId: number | undefined,
) {
  if (!conversationId || !Number.isFinite(conversationId) || conversationId <= 0) {
    return undefined;
  }

  const rows = await client.query<UserLookupRow>(
    `
    SELECT users.id, users.username, users.display_name, users.avatar_url
    FROM direct_conversation_participants sender_participant
    INNER JOIN direct_conversation_participants recipient_participant
      ON recipient_participant.conversation_id = sender_participant.conversation_id
     AND recipient_participant.user_id <> sender_participant.user_id
    INNER JOIN users ON users.id = recipient_participant.user_id
    WHERE sender_participant.conversation_id = $1
      AND sender_participant.user_id = $2
      AND users.status = 'active'
    LIMIT 1
    `,
    [conversationId, senderId],
  );

  return rows.rows[0];
}

async function findRecipientByUsername(client: PoolClient, senderId: number, username: string) {
  const normalized = username.trim().replace(/^@/, "");

  if (!normalized) {
    return undefined;
  }

  const rows = await client.query<UserLookupRow>(
    `
    SELECT id, username, display_name, avatar_url
    FROM users
    WHERE lower(username) = lower($1)
      AND status = 'active'
      AND id <> $2
    LIMIT 1
    `,
    [normalized, senderId],
  );

  return rows.rows[0];
}

async function assertNotBlocked(client: PoolClient, senderId: number, recipientId: number) {
  const blocked = await client.query<{ id: number }>(
    `
    SELECT id
    FROM user_blocks
    WHERE (blocker_id = $1 AND blocked_user_id = $2)
       OR (blocker_id = $2 AND blocked_user_id = $1)
    LIMIT 1
    `,
    [senderId, recipientId],
  );

  if (blocked.rows[0]) {
    throw new Error("This conversation is unavailable.");
  }
}

function buildConversationKey(a: number, b: number) {
  return [a, b].sort((left, right) => left - right).join(":");
}

function normalizeMessageBody(value: string) {
  return value.replace(/\r\n/g, "\n").trim().slice(0, 4000);
}

function buildSnippet(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 120);
}
