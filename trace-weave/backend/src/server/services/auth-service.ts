import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from "node:crypto";
import type { FastifyReply, FastifyRequest } from "fastify";
import type { PoolClient } from "pg";
import { config, quoteIdentifier } from "../config";
import { pool } from "../db/pool";

const schema = quoteIdentifier(config.DB_SCHEMA);
const sessionCookieName = "traceweave_session";
const scryptParameters = { N: 16_384, r: 8, p: 1, keyLength: 64 } as const;

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  createdAt: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    readonly statusCode: 401 | 403 | 409 = 401,
    readonly code = "AUTH_REQUIRED",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

function derivePassword(password: string, saltHex: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      Buffer.from(saltHex, "hex"),
      scryptParameters.keyLength,
      { N: scryptParameters.N, r: scryptParameters.r, p: scryptParameters.p, maxmem: 64 * 1024 * 1024 },
      (error, derivedKey) => (error ? reject(error) : resolve(derivedKey)),
    );
  });
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await derivePassword(password, salt)).toString("hex");
  return { hash, salt };
}

export async function verifyPassword(
  password: string,
  expectedHash: string,
  salt: string,
): Promise<boolean> {
  const actual = await derivePassword(password, salt);
  const expected = Buffer.from(expectedHash, "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return Object.fromEntries(
    header.split(";").flatMap((part) => {
      const separator = part.indexOf("=");
      if (separator < 1) return [];
      const key = part.slice(0, separator).trim();
      const value = part.slice(separator + 1).trim();
      try {
        return [[key, decodeURIComponent(value)]];
      } catch {
        return [];
      }
    }),
  );
}

function sessionCookie(token: string, maxAgeSeconds: number): string {
  const secure = config.AUTH_COOKIE_SECURE ? "; Secure" : "";
  return `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`;
}

export function clearSessionCookie(reply: FastifyReply): void {
  reply.header("Set-Cookie", sessionCookie("", 0));
}

export function requestSessionToken(request: FastifyRequest): string | null {
  return parseCookies(request.headers.cookie)[sessionCookieName] ?? null;
}

export async function createSession(
  client: PoolClient,
  userId: string,
  request: FastifyRequest,
): Promise<{ token: string; maxAgeSeconds: number }> {
  const token = randomBytes(32).toString("base64url");
  const maxAgeSeconds = config.AUTH_SESSION_DAYS * 24 * 60 * 60;
  await client.query(
    `
      INSERT INTO ${schema}.user_sessions (
        id, user_id, token_hash, expires_at, user_agent, ip_address
      ) VALUES ($1, $2, $3, now() + ($4 * interval '1 second'), $5, $6)
    `,
    [
      randomUUID(),
      userId,
      tokenHash(token),
      maxAgeSeconds,
      request.headers["user-agent"] ?? null,
      request.ip,
    ],
  );
  return { token, maxAgeSeconds };
}

export function setSessionCookie(
  reply: FastifyReply,
  session: { token: string; maxAgeSeconds: number },
): void {
  reply.header("Set-Cookie", sessionCookie(session.token, session.maxAgeSeconds));
}

export async function authenticateRequest(request: FastifyRequest): Promise<void> {
  const token = requestSessionToken(request);
  if (!token) throw new AuthError("请先登录");

  const result = await pool.query<AuthUser>(
    `
      SELECT
        u.id,
        u.username,
        u.display_name AS "displayName",
        u.created_at AS "createdAt"
      FROM ${schema}.user_sessions s
      JOIN ${schema}.users u ON u.id = s.user_id
      WHERE s.token_hash = $1
        AND s.revoked_at IS NULL
        AND s.expires_at > now()
        AND u.status = 'active'
      LIMIT 1
    `,
    [tokenHash(token)],
  );

  const user = result.rows[0];
  if (!user) throw new AuthError("登录状态已过期，请重新登录", 401, "SESSION_EXPIRED");
  request.authUser = user;
  void pool.query(
    `
      UPDATE ${schema}.user_sessions
      SET last_seen_at = now()
      WHERE token_hash = $1 AND last_seen_at < now() - interval '5 minutes'
    `,
    [tokenHash(token)],
  );
}

export async function revokeRequestSession(request: FastifyRequest): Promise<void> {
  const token = requestSessionToken(request);
  if (!token) return;
  await pool.query(
    `UPDATE ${schema}.user_sessions SET revoked_at = now() WHERE token_hash = $1 AND revoked_at IS NULL`,
    [tokenHash(token)],
  );
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}
