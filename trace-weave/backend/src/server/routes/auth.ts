import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";
import { withTransaction } from "../db/transaction";
import {
  AuthError,
  authenticateRequest,
  clearSessionCookie,
  createSession,
  hashPassword,
  revokeRequestSession,
  setSessionCookie,
  verifyPassword,
} from "../services/auth-service";

const schema = quoteIdentifier(config.DB_SCHEMA);
const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(40)
  .regex(/^[\p{L}\p{N}_-]+$/u, "用户名只能包含文字、数字、下划线和短横线");

const registerSchema = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(80),
  password: z.string().min(8).max(128),
});

const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1).max(128),
});

export const authRoutes: FastifyPluginAsync = async (app) => {
  app.post("/api/auth/register", async (request, reply) => {
    const body = registerSchema.parse(request.body);
    const username = body.username.toLocaleLowerCase("zh-CN");
    const password = await hashPassword(body.password);

    const result = await withTransaction(async (client) => {
      const existing = await client.query<{
        id: string;
        username: string;
        displayName: string;
        hasCredentials: boolean;
      }>(
        `
          SELECT
            u.id,
            u.username,
            u.display_name AS "displayName",
            (uc.user_id IS NOT NULL) AS "hasCredentials"
          FROM ${schema}.users u
          LEFT JOIN ${schema}.user_credentials uc ON uc.user_id = u.id
          WHERE lower(u.username) = $1
          FOR UPDATE OF u
        `,
        [username],
      );

      let user = existing.rows[0];
      if (user?.hasCredentials) {
        throw new AuthError("用户名已经存在", 409, "USERNAME_TAKEN");
      }
      if (user && config.APP_ENV !== "development") {
        throw new AuthError("用户名已经存在", 409, "USERNAME_TAKEN");
      }

      if (!user) {
        const userId = randomUUID();
        await client.query(
          `
            INSERT INTO ${schema}.users (id, username, display_name, status)
            VALUES ($1, $2, $3, 'active')
          `,
          [userId, username, body.displayName],
        );
        await client.query(
          `
            INSERT INTO ${schema}.privacy_policies (
              id, owner_user_id, policy_level, subject_key, content_visibility,
              allow_anonymous_stats, allow_matching, allow_identity_disclosure,
              allow_shared_occurrence, version
            ) VALUES ($1, $2, 'user_default', '*', 'private', false, false, false, false, 1)
          `,
          [randomUUID(), userId],
        );
        user = { id: userId, username, displayName: body.displayName, hasCredentials: false };
      } else {
        await client.query(
          `UPDATE ${schema}.users SET display_name = $2, updated_at = now() WHERE id = $1`,
          [user.id, body.displayName],
        );
        user.displayName = body.displayName;
      }

      await client.query(
        `
          INSERT INTO ${schema}.user_credentials (
            user_id, password_hash, password_salt, algorithm, parameters
          ) VALUES ($1, $2, $3, 'scrypt-v1', $4::jsonb)
        `,
        [user.id, password.hash, password.salt, JSON.stringify({ N: 16384, r: 8, p: 1, keyLength: 64 })],
      );
      const session = await createSession(client, user.id, request);
      return { user, session };
    });

    setSessionCookie(reply, result.session);
    return reply.code(201).send({
      user: {
        id: result.user.id,
        username: result.user.username,
        displayName: result.user.displayName,
      },
    });
  });

  app.post("/api/auth/login", async (request, reply) => {
    const body = loginSchema.parse(request.body);
    const result = await pool.query<{
      id: string;
      username: string;
      displayName: string;
      passwordHash: string;
      passwordSalt: string;
    }>(
      `
        SELECT
          u.id,
          u.username,
          u.display_name AS "displayName",
          uc.password_hash AS "passwordHash",
          uc.password_salt AS "passwordSalt"
        FROM ${schema}.users u
        JOIN ${schema}.user_credentials uc ON uc.user_id = u.id
        WHERE lower(u.username) = $1 AND u.status = 'active'
        LIMIT 1
      `,
      [body.username.toLocaleLowerCase("zh-CN")],
    );

    const user = result.rows[0];
    const valid = user
      ? await verifyPassword(body.password, user.passwordHash, user.passwordSalt)
      : await verifyPassword(body.password, "0".repeat(128), "0".repeat(32));
    if (!user || !valid) {
      throw new AuthError("用户名或密码不正确", 401, "INVALID_CREDENTIALS");
    }

    const session = await withTransaction((client) => createSession(client, user.id, request));
    setSessionCookie(reply, session);
    return { user: { id: user.id, username: user.username, displayName: user.displayName } };
  });

  app.post(
    "/api/auth/logout",
    { preHandler: authenticateRequest },
    async (request, reply) => {
      await revokeRequestSession(request);
      clearSessionCookie(reply);
      return reply.code(204).send();
    },
  );

  app.get(
    "/api/auth/me",
    { preHandler: authenticateRequest },
    async (request) => ({ user: request.authUser }),
  );
};
