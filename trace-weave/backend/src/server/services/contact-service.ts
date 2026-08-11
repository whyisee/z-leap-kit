import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";

const schema = quoteIdentifier(config.DB_SCHEMA);

export type ContactRelationship = "none" | "friend" | "incoming" | "outgoing";

export class ContactError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 409 | 429 = 400,
    readonly code = "CONTACT_ERROR",
  ) {
    super(message);
    this.name = "ContactError";
  }
}

async function assertNoBlock(client: PoolClient, userId: string, otherUserId: string): Promise<void> {
  const blocked = await client.query(
    `SELECT 1 FROM ${schema}.social_blocks
     WHERE (blocker_user_id = $1 AND blocked_user_id = $2)
        OR (blocker_user_id = $2 AND blocked_user_id = $1)
     LIMIT 1`,
    [userId, otherUserId],
  );
  if (blocked.rows[0]) throw new ContactError("你与该用户当前无法建立联系", 403, "CONTACT_BLOCKED");
}

async function ensureConversation(client: PoolClient, userId: string, otherUserId: string): Promise<string> {
  const result = await client.query<{ id: string }>(
    `INSERT INTO ${schema}.direct_conversations (id, user_low_id, user_high_id)
     VALUES ($1, LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid))
     ON CONFLICT (user_low_id, user_high_id) DO UPDATE
       SET updated_at = now()
     RETURNING id`,
    [randomUUID(), userId, otherUserId],
  );
  const conversationId = result.rows[0]!.id;
  await client.query(
    `INSERT INTO ${schema}.direct_conversation_members (conversation_id, user_id)
     VALUES ($1, $2), ($1, $3)
     ON CONFLICT (conversation_id, user_id) DO UPDATE
       SET hidden_at = NULL, updated_at = now()`,
    [conversationId, userId, otherUserId],
  );
  return conversationId;
}

async function hasActiveConnection(client: PoolClient, userId: string, otherUserId: string): Promise<boolean> {
  const result = await client.query(
    `SELECT 1 FROM ${schema}.social_connections
     WHERE user_low_id = LEAST($1::uuid, $2::uuid)
       AND user_high_id = GREATEST($1::uuid, $2::uuid)
       AND status IN ('active', 'muted')`,
    [userId, otherUserId],
  );
  return Boolean(result.rows[0]);
}

export async function getContactOverview(client: PoolClient, userId: string) {
  const contacts = await client.query(
    `SELECT
       connection.id AS "connectionId",
       connection.source,
       connection.status,
       connection.connected_at AS "connectedAt",
       other_user.id AS "userId",
       other_user.username,
       other_user.display_name AS "displayName",
       other_user.created_at AS "userCreatedAt",
       conversation.id AS "conversationId",
       latest.id AS "lastMessageId",
       latest.content AS "lastMessageContent",
       latest.sender_user_id AS "lastMessageSenderId",
       latest.created_at AS "lastMessageAt",
       count(unread.id)::int AS "unreadCount"
     FROM ${schema}.social_connections connection
     JOIN ${schema}.users other_user
       ON other_user.id = CASE WHEN connection.user_low_id = $1 THEN connection.user_high_id ELSE connection.user_low_id END
     LEFT JOIN ${schema}.direct_conversations conversation
       ON conversation.user_low_id = connection.user_low_id AND conversation.user_high_id = connection.user_high_id
     LEFT JOIN ${schema}.direct_conversation_members membership
       ON membership.conversation_id = conversation.id AND membership.user_id = $1
     LEFT JOIN LATERAL (
       SELECT message.id, message.content, message.sender_user_id, message.created_at
       FROM ${schema}.direct_messages message
       WHERE message.conversation_id = conversation.id AND message.deleted_at IS NULL
       ORDER BY message.created_at DESC, message.id DESC LIMIT 1
     ) latest ON true
     LEFT JOIN ${schema}.direct_messages unread
       ON unread.conversation_id = conversation.id
      AND unread.sender_user_id <> $1
      AND unread.deleted_at IS NULL
      AND unread.created_at > COALESCE(membership.last_read_at, '-infinity'::timestamptz)
     WHERE (connection.user_low_id = $1 OR connection.user_high_id = $1)
       AND connection.status IN ('active', 'muted')
       AND other_user.status = 'active'
       AND NOT EXISTS (
         SELECT 1 FROM ${schema}.social_blocks block
         WHERE (block.blocker_user_id = $1 AND block.blocked_user_id = other_user.id)
            OR (block.blocker_user_id = other_user.id AND block.blocked_user_id = $1)
       )
     GROUP BY connection.id, other_user.id, conversation.id, latest.id, latest.content, latest.sender_user_id, latest.created_at
     ORDER BY COALESCE(latest.created_at, connection.connected_at) DESC`,
    [userId],
  );

  const requests = await client.query(
    `SELECT
       request.id,
       request.sender_user_id AS "senderUserId",
       request.recipient_user_id AS "recipientUserId",
       request.message,
       request.status,
       request.created_at AS "createdAt",
       request.responded_at AS "respondedAt",
       other_user.id AS "userId",
       other_user.username,
       other_user.display_name AS "displayName",
       other_user.created_at AS "userCreatedAt"
     FROM ${schema}.friend_requests request
     JOIN ${schema}.users other_user
       ON other_user.id = CASE WHEN request.sender_user_id = $1 THEN request.recipient_user_id ELSE request.sender_user_id END
     WHERE (request.sender_user_id = $1 OR request.recipient_user_id = $1)
       AND request.status = 'pending'
       AND other_user.status = 'active'
     ORDER BY request.created_at DESC`,
    [userId],
  );

  const normalizedContacts = contacts.rows.map((row) => ({
    connectionId: row.connectionId,
    source: row.source,
    status: row.status,
    connectedAt: row.connectedAt,
    user: { id: row.userId, username: row.username, displayName: row.displayName, createdAt: row.userCreatedAt },
    conversationId: row.conversationId ?? null,
    unreadCount: row.unreadCount,
    lastMessage: row.lastMessageId ? {
      id: row.lastMessageId,
      content: row.lastMessageContent,
      senderId: row.lastMessageSenderId,
      createdAt: row.lastMessageAt,
    } : null,
  }));
  const normalizedRequests = requests.rows.map((row) => ({
    id: row.id,
    direction: row.recipientUserId === userId ? "incoming" as const : "outgoing" as const,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
    respondedAt: row.respondedAt,
    user: { id: row.userId, username: row.username, displayName: row.displayName, createdAt: row.userCreatedAt },
  }));
  const unreadTotal = normalizedContacts.reduce((sum, contact) => sum + Number(contact.unreadCount), 0);
  return {
    contacts: normalizedContacts,
    incomingRequests: normalizedRequests.filter((request) => request.direction === "incoming"),
    outgoingRequests: normalizedRequests.filter((request) => request.direction === "outgoing"),
    unreadTotal,
  };
}

export async function searchContactUsers(client: PoolClient, userId: string, query: string) {
  const normalized = query.trim().toLocaleLowerCase("zh-CN");
  if (!normalized) return { users: [] };
  const result = await client.query(
    `SELECT
       candidate.id,
       candidate.username,
       candidate.display_name AS "displayName",
       candidate.created_at AS "createdAt",
       CASE
         WHEN connection.status IN ('active', 'muted') THEN 'friend'
         WHEN request.recipient_user_id = $1 THEN 'incoming'
         WHEN request.sender_user_id = $1 THEN 'outgoing'
         ELSE 'none'
       END AS relationship
     FROM ${schema}.users candidate
     LEFT JOIN ${schema}.social_connections connection
       ON connection.user_low_id = LEAST($1::uuid, candidate.id)
      AND connection.user_high_id = GREATEST($1::uuid, candidate.id)
     LEFT JOIN ${schema}.friend_requests request
       ON request.sender_user_id = LEAST($1::uuid, candidate.id)
          AND request.recipient_user_id = GREATEST($1::uuid, candidate.id)
          AND request.status = 'pending'
       OR request.sender_user_id = GREATEST($1::uuid, candidate.id)
          AND request.recipient_user_id = LEAST($1::uuid, candidate.id)
          AND request.status = 'pending'
     WHERE candidate.id <> $1 AND candidate.status = 'active'
       AND (lower(candidate.username) LIKE $2 OR lower(candidate.display_name) LIKE $3)
       AND NOT EXISTS (
         SELECT 1 FROM ${schema}.social_blocks block
         WHERE (block.blocker_user_id = $1 AND block.blocked_user_id = candidate.id)
            OR (block.blocker_user_id = candidate.id AND block.blocked_user_id = $1)
       )
     ORDER BY lower(candidate.username) = $4 DESC, lower(candidate.username) LIKE $5 DESC, candidate.username
     LIMIT 20`,
    [userId, `${normalized}%`, `%${normalized}%`, normalized, `${normalized}%`],
  );
  return { users: result.rows };
}

export async function createFriendRequest(
  client: PoolClient,
  senderUserId: string,
  recipientUserId: string,
  message?: string,
) {
  if (senderUserId === recipientUserId) throw new ContactError("不能添加自己为好友");
  const target = await client.query<{ id: string; username: string; displayName: string }>(
    `SELECT id, username, display_name AS "displayName" FROM ${schema}.users
     WHERE id = $1 AND status = 'active'`,
    [recipientUserId],
  );
  if (!target.rows[0]) throw new ContactError("用户不存在", 404, "USER_NOT_FOUND");
  await assertNoBlock(client, senderUserId, recipientUserId);
  if (await hasActiveConnection(client, senderUserId, recipientUserId)) {
    throw new ContactError("你们已经是好友", 409, "ALREADY_FRIENDS");
  }
  const incoming = await client.query(
    `SELECT 1 FROM ${schema}.friend_requests
     WHERE sender_user_id = $2 AND recipient_user_id = $1 AND status = 'pending'`,
    [senderUserId, recipientUserId],
  );
  if (incoming.rows[0]) throw new ContactError("对方已经向你发送好友申请，请直接处理", 409, "INCOMING_REQUEST_EXISTS");
  const recent = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${schema}.friend_requests
     WHERE sender_user_id = $1 AND created_at >= now() - interval '24 hours'`,
    [senderUserId],
  );
  if (Number(recent.rows[0]?.count ?? 0) >= 30) {
    throw new ContactError("今天发送的好友申请过多，请稍后再试", 429, "FRIEND_REQUEST_RATE_LIMIT");
  }
  const requestId = randomUUID();
  try {
    await client.query(
      `INSERT INTO ${schema}.friend_requests (id, sender_user_id, recipient_user_id, message)
       VALUES ($1, $2, $3, $4)`,
      [requestId, senderUserId, recipientUserId, message?.trim() || null],
    );
  } catch (error) {
    if ((error as { code?: string }).code === "23505") {
      throw new ContactError("好友申请已经发送，请等待对方处理", 409, "REQUEST_EXISTS");
    }
    throw error;
  }
  const sender = await client.query<{ displayName: string }>(
    `SELECT display_name AS "displayName" FROM ${schema}.users WHERE id = $1`,
    [senderUserId],
  );
  await client.query(
    `INSERT INTO ${schema}.notifications (
       id, owner_user_id, notification_type, resource_type, resource_id, title, body, scheduled_at
     ) VALUES ($1, $2, 'friend_request', 'friend_request', $3, '收到新的好友申请', $4, now())
     ON CONFLICT (owner_user_id, notification_type, resource_type, resource_id) DO NOTHING`,
    [randomUUID(), recipientUserId, requestId, `${sender.rows[0]?.displayName ?? "一位用户"}希望添加你为好友。`],
  );
  return { requestId, status: "pending" as const };
}

export async function decideFriendRequest(
  client: PoolClient,
  userId: string,
  requestId: string,
  decision: "accept" | "reject" | "cancel",
) {
  const result = await client.query<{
    senderUserId: string;
    recipientUserId: string;
    status: string;
  }>(
    `SELECT sender_user_id AS "senderUserId", recipient_user_id AS "recipientUserId", status
     FROM ${schema}.friend_requests WHERE id = $1 FOR UPDATE`,
    [requestId],
  );
  const request = result.rows[0];
  if (!request || request.status !== "pending") throw new ContactError("好友申请不存在或已经处理", 404, "REQUEST_NOT_FOUND");
  if (decision === "cancel") {
    if (request.senderUserId !== userId) throw new ContactError("只能撤回自己发送的申请", 403);
    await client.query(
      `UPDATE ${schema}.friend_requests SET status = 'cancelled', responded_at = now(), updated_at = now() WHERE id = $1`,
      [requestId],
    );
    await client.query(
      `UPDATE ${schema}.notifications SET status = 'dismissed', updated_at = now()
       WHERE owner_user_id = $1 AND notification_type = 'friend_request'
         AND resource_type = 'friend_request' AND resource_id = $2
         AND status IN ('pending', 'delivered')`,
      [request.recipientUserId, requestId],
    );
    return { requestId, status: "cancelled" as const, conversationId: null };
  }
  if (request.recipientUserId !== userId) throw new ContactError("只能处理发送给你的好友申请", 403);
  if (decision === "reject") {
    await client.query(
      `UPDATE ${schema}.friend_requests SET status = 'rejected', responded_at = now(), updated_at = now() WHERE id = $1`,
      [requestId],
    );
    await client.query(
      `UPDATE ${schema}.notifications SET status = 'read', read_at = COALESCE(read_at, now()), updated_at = now()
       WHERE owner_user_id = $1 AND notification_type = 'friend_request'
         AND resource_type = 'friend_request' AND resource_id = $2
         AND status IN ('pending', 'delivered')`,
      [userId, requestId],
    );
    return { requestId, status: "rejected" as const, conversationId: null };
  }
  await assertNoBlock(client, request.senderUserId, request.recipientUserId);
  await client.query(
    `UPDATE ${schema}.friend_requests SET status = 'accepted', responded_at = now(), updated_at = now() WHERE id = $1`,
    [requestId],
  );
  await client.query(
    `UPDATE ${schema}.notifications SET status = 'read', read_at = COALESCE(read_at, now()), updated_at = now()
     WHERE owner_user_id = $1 AND notification_type = 'friend_request'
       AND resource_type = 'friend_request' AND resource_id = $2
       AND status IN ('pending', 'delivered')`,
    [userId, requestId],
  );
  await client.query(
    `INSERT INTO ${schema}.social_connections (
       id, match_id, user_low_id, user_high_id, status, source
     ) VALUES ($1, NULL, LEAST($2::uuid, $3::uuid), GREATEST($2::uuid, $3::uuid), 'active', 'friend_request')
     ON CONFLICT (user_low_id, user_high_id) DO UPDATE
       SET status = 'active',
           source = CASE WHEN ${schema}.social_connections.match_id IS NULL THEN 'friend_request' ELSE ${schema}.social_connections.source END,
           connected_at = now(), ended_at = NULL`,
    [randomUUID(), request.senderUserId, request.recipientUserId],
  );
  const conversationId = await ensureConversation(client, request.senderUserId, request.recipientUserId);
  const recipient = await client.query<{ displayName: string }>(
    `SELECT display_name AS "displayName" FROM ${schema}.users WHERE id = $1`,
    [request.recipientUserId],
  );
  await client.query(
    `INSERT INTO ${schema}.notifications (
       id, owner_user_id, notification_type, resource_type, resource_id, title, body, scheduled_at
     ) VALUES ($1, $2, 'friend_request_accepted', 'friend_request', $3, '好友申请已通过', $4, now())
     ON CONFLICT (owner_user_id, notification_type, resource_type, resource_id) DO NOTHING`,
    [randomUUID(), request.senderUserId, requestId, `你和${recipient.rows[0]?.displayName ?? "对方"}现在可以私聊了。`],
  );
  return { requestId, status: "accepted" as const, conversationId };
}

export async function removeContact(client: PoolClient, userId: string, otherUserId: string) {
  const result = await client.query<{ matchId: string | null }>(
    `UPDATE ${schema}.social_connections
     SET status = 'ended', ended_at = now()
     WHERE user_low_id = LEAST($1::uuid, $2::uuid)
       AND user_high_id = GREATEST($1::uuid, $2::uuid)
       AND status IN ('active', 'muted')
     RETURNING match_id AS "matchId"`,
    [userId, otherUserId],
  );
  if (!result.rows[0]) throw new ContactError("好友关系不存在", 404, "CONTACT_NOT_FOUND");
  if (result.rows[0].matchId) {
    await client.query(
      `UPDATE ${schema}.match_consents
       SET status = 'revoked', decided_at = now()
       WHERE match_id = $1 AND user_id = $2 AND consent_type IN ('connect', 'reveal_identity')`,
      [result.rows[0].matchId, userId],
    );
    await client.query(
      `UPDATE ${schema}.social_matches SET status = 'anonymous_candidate', updated_at = now() WHERE id = $1`,
      [result.rows[0].matchId],
    );
  }
  return { status: "removed" as const };
}

export async function openConversation(client: PoolClient, userId: string, otherUserId: string) {
  await assertNoBlock(client, userId, otherUserId);
  if (!(await hasActiveConnection(client, userId, otherUserId))) {
    throw new ContactError("只有好友之间可以发起私聊", 403, "FRIENDSHIP_REQUIRED");
  }
  return { conversationId: await ensureConversation(client, userId, otherUserId) };
}

export async function listConversations(client: PoolClient, userId: string) {
  const result = await client.query(
    `SELECT
       conversation.id,
       conversation.created_at AS "createdAt",
       COALESCE(conversation.last_message_at, conversation.created_at) AS "updatedAt",
       other_user.id AS "otherUserId",
       other_user.username AS "otherUsername",
       other_user.display_name AS "otherDisplayName",
       other_user.created_at AS "otherCreatedAt",
       latest.id AS "lastMessageId",
       latest.content AS "lastMessageContent",
       latest.sender_user_id AS "lastMessageSenderId",
       latest.created_at AS "lastMessageAt",
       count(unread.id)::int AS "unreadCount",
       connection.status IN ('active', 'muted') AS "canSend"
     FROM ${schema}.direct_conversations conversation
     JOIN ${schema}.direct_conversation_members membership
       ON membership.conversation_id = conversation.id AND membership.user_id = $1 AND membership.hidden_at IS NULL
     JOIN ${schema}.users other_user
       ON other_user.id = CASE WHEN conversation.user_low_id = $1 THEN conversation.user_high_id ELSE conversation.user_low_id END
     LEFT JOIN ${schema}.social_connections connection
       ON connection.user_low_id = conversation.user_low_id AND connection.user_high_id = conversation.user_high_id
     LEFT JOIN LATERAL (
       SELECT message.id, message.content, message.sender_user_id, message.created_at
       FROM ${schema}.direct_messages message
       WHERE message.conversation_id = conversation.id AND message.deleted_at IS NULL
       ORDER BY message.created_at DESC, message.id DESC LIMIT 1
     ) latest ON true
     LEFT JOIN ${schema}.direct_messages unread
       ON unread.conversation_id = conversation.id AND unread.sender_user_id <> $1
      AND unread.deleted_at IS NULL AND unread.created_at > membership.last_read_at
     GROUP BY conversation.id, other_user.id, latest.id, latest.content, latest.sender_user_id, latest.created_at, connection.status
     ORDER BY COALESCE(conversation.last_message_at, conversation.created_at) DESC`,
    [userId],
  );
  return {
    conversations: result.rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      otherUser: { id: row.otherUserId, username: row.otherUsername, displayName: row.otherDisplayName, createdAt: row.otherCreatedAt },
      lastMessage: row.lastMessageId ? { id: row.lastMessageId, content: row.lastMessageContent, senderId: row.lastMessageSenderId, createdAt: row.lastMessageAt } : null,
      unreadCount: row.unreadCount,
      canSend: row.canSend,
    })),
    unreadTotal: result.rows.reduce((sum, row) => sum + Number(row.unreadCount), 0),
  };
}

async function getConversationAccess(client: PoolClient, userId: string, conversationId: string) {
  const result = await client.query<{
    otherUserId: string;
    canSend: boolean;
    otherUsername: string;
    otherDisplayName: string;
    otherCreatedAt: string;
  }>(
    `SELECT
       other_user.id AS "otherUserId",
       other_user.username AS "otherUsername",
       other_user.display_name AS "otherDisplayName",
       other_user.created_at AS "otherCreatedAt",
       connection.status IN ('active', 'muted')
         AND NOT EXISTS (
           SELECT 1 FROM ${schema}.social_blocks block
           WHERE (block.blocker_user_id = $2 AND block.blocked_user_id = other_user.id)
              OR (block.blocker_user_id = other_user.id AND block.blocked_user_id = $2)
         ) AS "canSend"
     FROM ${schema}.direct_conversations conversation
     JOIN ${schema}.direct_conversation_members membership
       ON membership.conversation_id = conversation.id AND membership.user_id = $2
     JOIN ${schema}.users other_user
       ON other_user.id = CASE WHEN conversation.user_low_id = $2 THEN conversation.user_high_id ELSE conversation.user_low_id END
     LEFT JOIN ${schema}.social_connections connection
       ON connection.user_low_id = conversation.user_low_id AND connection.user_high_id = conversation.user_high_id
     WHERE conversation.id = $1`,
    [conversationId, userId],
  );
  const access = result.rows[0];
  if (!access) throw new ContactError("会话不存在", 404, "CONVERSATION_NOT_FOUND");
  return access;
}

export async function getConversationMessages(
  client: PoolClient,
  userId: string,
  conversationId: string,
  before?: string,
  limit = 50,
) {
  const access = await getConversationAccess(client, userId, conversationId);
  const result = await client.query(
    `SELECT id, conversation_id AS "conversationId", sender_user_id AS "senderId", content,
            created_at AS "createdAt", edited_at AS "editedAt", deleted_at AS "deletedAt"
     FROM ${schema}.direct_messages
     WHERE conversation_id = $1
       AND ($2::timestamptz IS NULL OR created_at < $2::timestamptz)
     ORDER BY created_at DESC, id DESC
     LIMIT $3`,
    [conversationId, before ?? null, limit + 1],
  );
  const hasMore = result.rows.length > limit;
  const page = result.rows.slice(0, limit);
  const nextCursor = hasMore ? page.at(-1)?.createdAt ?? null : null;
  return {
    conversation: {
      id: conversationId,
      otherUser: { id: access.otherUserId, username: access.otherUsername, displayName: access.otherDisplayName, createdAt: access.otherCreatedAt },
      canSend: access.canSend,
    },
    messages: page.reverse().map((message) => ({ ...message, content: message.deletedAt ? "消息已删除" : message.content })),
    nextCursor,
  };
}

export async function sendDirectMessage(
  client: PoolClient,
  userId: string,
  conversationId: string,
  content: string,
  clientMessageId?: string,
) {
  const access = await getConversationAccess(client, userId, conversationId);
  if (!access.canSend) throw new ContactError("好友关系已解除或账号已被屏蔽，无法继续发送", 403, "MESSAGING_NOT_ALLOWED");
  const normalizedContent = content.trim();
  if (!normalizedContent) throw new ContactError("消息内容不能为空");

  if (clientMessageId) {
    const existing = await client.query(
      `SELECT id, conversation_id AS "conversationId", sender_user_id AS "senderId", content, created_at AS "createdAt",
              edited_at AS "editedAt", deleted_at AS "deletedAt"
       FROM ${schema}.direct_messages WHERE sender_user_id = $1 AND client_message_id = $2`,
      [userId, clientMessageId],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].conversationId !== conversationId) throw new ContactError("消息去重标识已经被使用", 409);
      return { message: existing.rows[0] };
    }
  }

  const recent = await client.query<{ count: string }>(
    `SELECT count(*)::text AS count FROM ${schema}.direct_messages
     WHERE sender_user_id = $1 AND created_at >= now() - interval '1 minute'`,
    [userId],
  );
  if (Number(recent.rows[0]?.count ?? 0) >= 120) {
    throw new ContactError("消息发送过于频繁，请稍后再试", 429, "MESSAGE_RATE_LIMIT");
  }
  const messageId = randomUUID();
  const inserted = await client.query(
    `INSERT INTO ${schema}.direct_messages (id, conversation_id, sender_user_id, client_message_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, conversation_id AS "conversationId", sender_user_id AS "senderId", content,
               created_at AS "createdAt", edited_at AS "editedAt", deleted_at AS "deletedAt"`,
    [messageId, conversationId, userId, clientMessageId ?? null, normalizedContent],
  );
  await client.query(
    `UPDATE ${schema}.direct_conversations SET last_message_at = now(), updated_at = now() WHERE id = $1`,
    [conversationId],
  );
  await client.query(
    `UPDATE ${schema}.direct_conversation_members
     SET hidden_at = NULL, updated_at = now(), last_read_at = CASE WHEN user_id = $2 THEN now() ELSE last_read_at END
     WHERE conversation_id = $1`,
    [conversationId, userId],
  );
  const sender = await client.query<{ displayName: string }>(
    `SELECT display_name AS "displayName" FROM ${schema}.users WHERE id = $1`, [userId],
  );
  await client.query(
    `INSERT INTO ${schema}.notifications (
       id, owner_user_id, notification_type, resource_type, resource_id, title, body, scheduled_at
     ) VALUES ($1, $2, 'direct_message', 'direct_message', $3, $4, $5, now())
     ON CONFLICT (owner_user_id, notification_type, resource_type, resource_id) DO NOTHING`,
    [randomUUID(), access.otherUserId, messageId, `${sender.rows[0]?.displayName ?? "好友"}发来一条消息`, normalizedContent.slice(0, 120)],
  );
  return { message: inserted.rows[0] };
}

export async function markConversationRead(client: PoolClient, userId: string, conversationId: string) {
  await getConversationAccess(client, userId, conversationId);
  await client.query(
    `UPDATE ${schema}.direct_conversation_members SET last_read_at = now(), updated_at = now()
     WHERE conversation_id = $1 AND user_id = $2`,
    [conversationId, userId],
  );
  await client.query(
    `UPDATE ${schema}.notifications notification
     SET status = 'read', read_at = COALESCE(read_at, now()), updated_at = now()
     WHERE notification.owner_user_id = $2 AND notification.notification_type = 'direct_message'
       AND notification.resource_id IN (
         SELECT message.id FROM ${schema}.direct_messages message
         WHERE message.conversation_id = $1 AND message.sender_user_id <> $2
       ) AND notification.status IN ('pending', 'delivered')`,
    [conversationId, userId],
  );
  return { status: "read" as const };
}
