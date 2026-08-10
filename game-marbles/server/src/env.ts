import fs from "node:fs";
import path from "node:path";

export type ServerEnv = {
  siteUrl: string;
  port: number;
  adminUsername: string;
  adminPassword: string;
  adminNickname: string;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSchema: string;
  configEnvironment: string;
  corsOrigins: string[];
};

const processEnvKeys = new Set(Object.keys(process.env));

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(trimmed);
    if (!match) continue;
    const key = match[1];
    if (processEnvKeys.has(key)) continue;
    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function loadLocalEnv() {
  const root = process.env.BACKEND_ROOT || process.cwd();
  loadEnvFile(path.join(root, ".env"));
  loadEnvFile(path.join(root, ".env.local"));
}

loadLocalEnv();

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function schemaEnv(value: string | undefined) {
  const schema = value || "ws";
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(schema)) {
    throw new Error(`Invalid DB_SCHEMA: ${schema}`);
  }
  return schema;
}

function portFromSiteUrl(siteUrl: string) {
  try {
    const url = new URL(siteUrl);
    return Number(url.port) || (url.protocol === "https:" ? 443 : 80);
  } catch {
    return 4325;
  }
}

const siteUrl = process.env.SITE_URL || "http://localhost:4325";

export const env: ServerEnv = {
  siteUrl,
  port: numberEnv("PORT", portFromSiteUrl(siteUrl)),
  adminUsername: process.env.ADMIN_USERNAME || "admin",
  adminPassword: process.env.ADMIN_PASSWORD || "Admin@2026",
  adminNickname: process.env.ADMIN_NICKNAME || "管理员",
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: numberEnv("DB_PORT", 5432),
  dbName: process.env.DB_NAME || "game_marbles",
  dbUser: process.env.DB_USER || "postgres",
  dbPassword: process.env.DB_PASSWORD || "",
  dbSchema: schemaEnv(process.env.DB_SCHEMA),
  configEnvironment: process.env.CONFIG_ENV || "test",
  corsOrigins: [
    siteUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...(process.env.CORS_ORIGINS || "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  ],
};
