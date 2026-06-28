export type ServerEnv = {
  siteUrl: string;
  port: number;
  dbHost: string;
  dbPort: number;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbSchema: string;
  corsOrigins: string[];
};

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
  dbHost: process.env.DB_HOST || "127.0.0.1",
  dbPort: numberEnv("DB_PORT", 5432),
  dbName: process.env.DB_NAME || "game_marbles",
  dbUser: process.env.DB_USER || "postgres",
  dbPassword: process.env.DB_PASSWORD || "",
  dbSchema: schemaEnv(process.env.DB_SCHEMA),
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
