import type { APIContext } from "astro";
import { createHmac, timingSafeEqual } from "node:crypto";

export const authCookieName = "whyisee_session";

const sessionMaxAgeSeconds = 60 * 60 * 24 * 7;

export interface AuthSession {
  username: string;
  displayName: string;
  role: "admin";
  expiresAt: number;
}

export function getAuthConfig() {
  const configuredUsername = process.env.WHYISEE_ADMIN_USERNAME || process.env.ADMIN_USERNAME || "whyisee";
  const configuredPassword = process.env.WHYISEE_ADMIN_PASSWORD || process.env.ADMIN_PASSWORD;
  const devPassword = import.meta.env.PROD ? "" : "whyisee";
  const password = configuredPassword || devPassword;

  return {
    username: configuredUsername,
    password,
    isConfigured: Boolean(password),
    usesDevPassword: !configuredPassword && Boolean(devPassword),
  };
}

export function getSessionMaxAgeSeconds() {
  return sessionMaxAgeSeconds;
}

export function authenticateAdmin(username: string, password: string): AuthSession | undefined {
  const config = getAuthConfig();

  if (!config.isConfigured) {
    return undefined;
  }

  if (!safeEqual(username.trim(), config.username) || !safeEqual(password, config.password)) {
    return undefined;
  }

  return {
    username: config.username,
    displayName: config.username,
    role: "admin",
    expiresAt: Date.now() + sessionMaxAgeSeconds * 1000,
  };
}

export function createSessionToken(session: AuthSession) {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = signPayload(payload);

  return `${payload}.${signature}`;
}

export function readSessionToken(token: string | undefined): AuthSession | undefined {
  if (!token) {
    return undefined;
  }

  const [payload, signature] = token.split(".");

  if (!payload || !signature || !safeEqual(signature, signPayload(payload))) {
    return undefined;
  }

  try {
    const session = JSON.parse(fromBase64Url(payload)) as AuthSession;

    if (session.role !== "admin" || Date.now() > session.expiresAt) {
      return undefined;
    }

    return session;
  } catch {
    return undefined;
  }
}

export function getSessionFromAstro(astro: Pick<APIContext, "cookies">): AuthSession | undefined {
  return readSessionToken(astro.cookies.get(authCookieName)?.value);
}

export function safeRedirectPath(value: FormDataEntryValue | string | null | undefined, fallback = "/admin") {
  const target = String(value || fallback);

  if (!target.startsWith("/") || target.startsWith("//")) {
    return fallback;
  }

  return target;
}

function signPayload(payload: string) {
  return createHmac("sha256", getAuthSecret()).update(payload).digest("base64url");
}

function getAuthSecret() {
  return process.env.WHYISEE_AUTH_SECRET || process.env.AUTH_SECRET || getAuthConfig().password || "whyisee-dev-secret";
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}
