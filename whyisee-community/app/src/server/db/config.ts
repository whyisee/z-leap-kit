export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  schema: string;
}

export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 15432),
    database: process.env.DB_NAME || "zi",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "123456",
    schema: process.env.DB_SCHEMA || "ws",
  };
}

export function getDatabaseLabel() {
  const config = getDatabaseConfig();
  return `${config.user}@${config.host}:${config.port}/${config.database}?schema=${config.schema}`;
}

export function getDbSchema() {
  return getDatabaseConfig().schema;
}

export function quoteIdentifier(value: string) {
  return `"${getSafeIdentifier(value).replace(/"/g, '""')}"`;
}

export function getSafeIdentifier(value: string) {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value)) {
    throw new Error(`Invalid PostgreSQL identifier: ${value}`);
  }

  return value;
}
