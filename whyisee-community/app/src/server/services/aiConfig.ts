import { query, queryOne, withTransaction } from "../db/client.ts";

export interface AiModelConfig {
  id: number;
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKeyConfigured: boolean;
  isDefault: boolean;
  isEnabled: boolean;
  temperature: number;
  maxTokens: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiModelRuntimeConfig extends AiModelConfig {
  apiKey: string;
}

export interface AiModelConfigInput {
  name: string;
  provider: string;
  model: string;
  baseUrl: string;
  apiKey: string;
  clearApiKey?: boolean;
  isDefault: boolean;
  isEnabled: boolean;
  temperature: number;
  maxTokens: number;
  notes: string;
}

const providerBaseUrls: Record<string, string> = {
  deepseek: "https://api.deepseek.com",
  openai: "https://api.openai.com/v1",
  anthropic: "https://api.anthropic.com",
  google: "https://generativelanguage.googleapis.com/v1beta",
  custom: "",
};

export function getDefaultBaseUrl(provider: string) {
  return providerBaseUrls[provider] ?? "";
}

export async function listAiModelConfigs(): Promise<AiModelConfig[]> {
  const rows = await query<AiModelConfigRow>(
    `
    SELECT
      id,
      name,
      provider,
      model,
      base_url,
      api_key <> '' AS api_key_configured,
      is_default,
      is_enabled,
      temperature::text,
      max_tokens,
      notes,
      created_at,
      updated_at
    FROM ai_model_configs
    ORDER BY is_default DESC, is_enabled DESC, provider ASC, id DESC
    `,
  );

  return rows.map(mapAiModelConfigRow);
}

export async function getDefaultAiModelConfig(): Promise<AiModelConfig | undefined> {
  const row = await queryOne<AiModelConfigRow>(
    `
    SELECT
      id,
      name,
      provider,
      model,
      base_url,
      api_key <> '' AS api_key_configured,
      is_default,
      is_enabled,
      temperature::text,
      max_tokens,
      notes,
      created_at,
      updated_at
    FROM ai_model_configs
    WHERE is_default = TRUE AND is_enabled = TRUE
    LIMIT 1
    `,
  );

  return row ? mapAiModelConfigRow(row) : undefined;
}

export async function getDefaultAiModelRuntimeConfig(): Promise<AiModelRuntimeConfig | undefined> {
  const row = await queryOne<AiModelRuntimeConfigRow>(
    `
    SELECT
      id,
      name,
      provider,
      model,
      base_url,
      api_key,
      api_key <> '' AS api_key_configured,
      is_default,
      is_enabled,
      temperature::text,
      max_tokens,
      notes,
      created_at,
      updated_at
    FROM ai_model_configs
    WHERE is_default = TRUE AND is_enabled = TRUE
    LIMIT 1
    `,
  );

  return row ? mapAiModelRuntimeConfigRow(row) : undefined;
}

export async function createAiModelConfig(input: AiModelConfigInput) {
  const normalized = normalizeInput(input);
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    const countResult = await client.query<{ count: string }>("SELECT COUNT(*)::text AS count FROM ai_model_configs");
    const shouldDefault = normalized.isDefault || Number(countResult.rows[0]?.count || 0) === 0;
    const shouldEnable = shouldDefault || normalized.isEnabled;

    if (shouldDefault) {
      await client.query("UPDATE ai_model_configs SET is_default = FALSE");
    }

    await client.query(
      `
      INSERT INTO ai_model_configs (
        name, provider, model, base_url, api_key, is_default, is_enabled,
        temperature, max_tokens, notes, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11)
      `,
      [
        normalized.name,
        normalized.provider,
        normalized.model,
        normalized.baseUrl,
        normalized.apiKey,
        shouldDefault,
        shouldEnable,
        normalized.temperature,
        normalized.maxTokens,
        normalized.notes,
        now,
      ],
    );

    await ensureDefaultAiModel(client);
  });
}

export async function updateAiModelConfig(id: number, input: AiModelConfigInput) {
  const normalized = normalizeInput(input);
  const now = new Date().toISOString();

  await withTransaction(async (client) => {
    if (normalized.isDefault) {
      await client.query("UPDATE ai_model_configs SET is_default = FALSE WHERE id <> $1", [id]);
    }

    await client.query(
      `
      UPDATE ai_model_configs
      SET name = $1,
          provider = $2,
          model = $3,
          base_url = $4,
          api_key = CASE
            WHEN $5 = TRUE THEN ''
            WHEN $6 <> '' THEN $6
            ELSE api_key
          END,
          is_default = $7,
          is_enabled = $8,
          temperature = $9,
          max_tokens = $10,
          notes = $11,
          updated_at = $12
      WHERE id = $13
      `,
      [
        normalized.name,
        normalized.provider,
        normalized.model,
        normalized.baseUrl,
        Boolean(input.clearApiKey),
        normalized.apiKey,
        normalized.isDefault,
        normalized.isEnabled,
        normalized.temperature,
        normalized.maxTokens,
        normalized.notes,
        now,
        id,
      ],
    );

    await ensureDefaultAiModel(client);
  });
}

export function mapAiModelConfigForm(formData: FormData): AiModelConfigInput {
  const provider = String(formData.get("provider") || "deepseek").trim().toLowerCase();
  return {
    name: String(formData.get("name") || ""),
    provider,
    model: String(formData.get("model") || ""),
    baseUrl: String(formData.get("baseUrl") || getDefaultBaseUrl(provider)),
    apiKey: String(formData.get("apiKey") || ""),
    clearApiKey: formData.get("clearApiKey") === "1",
    isDefault: formData.get("isDefault") === "1",
    isEnabled: formData.get("isEnabled") === "1",
    temperature: Number(formData.get("temperature") || 0.7),
    maxTokens: Number(formData.get("maxTokens") || 4096),
    notes: String(formData.get("notes") || ""),
  };
}

function normalizeInput(input: AiModelConfigInput): AiModelConfigInput {
  const provider = (input.provider || "deepseek").trim().toLowerCase();
  const name = input.name.trim();
  const model = input.model.trim();
  const baseUrl = input.baseUrl.trim() || getDefaultBaseUrl(provider);

  if (!name) {
    throw new Error("AI config name is required.");
  }

  if (!model) {
    throw new Error("AI model is required.");
  }

  if (!baseUrl) {
    throw new Error("AI base URL is required.");
  }

  return {
    name,
    provider,
    model,
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiKey: input.apiKey.trim(),
    clearApiKey: input.clearApiKey,
    isDefault: input.isDefault,
    isEnabled: input.isDefault || input.isEnabled,
    temperature: clampNumber(input.temperature, 0, 2, 0.7),
    maxTokens: Math.round(clampNumber(input.maxTokens, 128, 200000, 4096)),
    notes: input.notes.trim(),
  };
}

async function ensureDefaultAiModel(client: { query: (sql: string, values?: unknown[]) => Promise<unknown> }) {
  const defaultResult = await client.query("SELECT id FROM ai_model_configs WHERE is_default = TRUE AND is_enabled = TRUE LIMIT 1") as {
    rows?: Array<{ id: number }>;
  };

  if (defaultResult.rows?.[0]) {
    return;
  }

  await client.query(
    `
    UPDATE ai_model_configs
    SET is_default = TRUE, is_enabled = TRUE
    WHERE id = (
      SELECT id
      FROM ai_model_configs
      ORDER BY is_enabled DESC, updated_at DESC, id DESC
      LIMIT 1
    )
    `,
  );
}

function clampNumber(value: number, min: number, max: number, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, value));
}

function mapAiModelConfigRow(row: AiModelConfigRow): AiModelConfig {
  return {
    id: row.id,
    name: row.name,
    provider: row.provider,
    model: row.model,
    baseUrl: row.base_url,
    apiKeyConfigured: row.api_key_configured,
    isDefault: row.is_default,
    isEnabled: row.is_enabled,
    temperature: Number(row.temperature),
    maxTokens: row.max_tokens,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapAiModelRuntimeConfigRow(row: AiModelRuntimeConfigRow): AiModelRuntimeConfig {
  return {
    ...mapAiModelConfigRow(row),
    apiKey: row.api_key,
  };
}

interface AiModelConfigRow {
  id: number;
  name: string;
  provider: string;
  model: string;
  base_url: string;
  api_key_configured: boolean;
  is_default: boolean;
  is_enabled: boolean;
  temperature: string;
  max_tokens: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

interface AiModelRuntimeConfigRow extends AiModelConfigRow {
  api_key: string;
}
