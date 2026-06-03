import { getDefaultAiModelRuntimeConfig, type AiModelRuntimeConfig } from "./aiConfig";

export interface AiGenerateInput {
  system: string;
  prompt: string;
  maxTokens?: number;
}

export interface AiGenerateResult {
  text: string;
  provider: string;
  model: string;
  configName: string;
}

export async function generateAiText(input: AiGenerateInput): Promise<AiGenerateResult> {
  const config = await getDefaultAiModelRuntimeConfig();

  if (!config) {
    throw new AiServiceError("ai_not_configured", "No enabled default AI model is configured.");
  }

  if (!config.apiKey) {
    throw new AiServiceError("ai_key_missing", "Default AI model is missing an API key.");
  }

  const text = await requestAiProvider(config, input);

  if (!text.trim()) {
    throw new AiServiceError("ai_empty_result", "AI provider returned an empty result.");
  }

  return {
    text: text.trim(),
    provider: config.provider,
    model: config.model,
    configName: config.name,
  };
}

export class AiServiceError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function requestAiProvider(config: AiModelRuntimeConfig, input: AiGenerateInput) {
  const provider = config.provider.toLowerCase();

  if (provider === "anthropic") {
    return requestAnthropic(config, input);
  }

  if (provider === "google") {
    return requestGemini(config, input);
  }

  return requestOpenAiCompatible(config, input);
}

async function requestOpenAiCompatible(config: AiModelRuntimeConfig, input: AiGenerateInput) {
  const json = await requestJson<OpenAiChatResponse>({
    url: `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: {
      model: config.model,
      temperature: config.temperature,
      max_tokens: Math.min(input.maxTokens || config.maxTokens, config.maxTokens),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.prompt },
      ],
    },
  });

  return json.choices?.[0]?.message?.content || "";
}

async function requestAnthropic(config: AiModelRuntimeConfig, input: AiGenerateInput) {
  const json = await requestJson<AnthropicResponse>({
    url: `${config.baseUrl.replace(/\/+$/, "")}/v1/messages`,
    headers: {
      "x-api-key": config.apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: {
      model: config.model,
      system: input.system,
      temperature: config.temperature,
      max_tokens: Math.min(input.maxTokens || config.maxTokens, config.maxTokens),
      messages: [{ role: "user", content: input.prompt }],
    },
  });

  return json.content?.map((part) => part.text || "").join("\n").trim() || "";
}

async function requestGemini(config: AiModelRuntimeConfig, input: AiGenerateInput) {
  const endpoint = `${config.baseUrl.replace(/\/+$/, "")}/models/${encodeURIComponent(config.model)}:generateContent`;
  const url = `${endpoint}?key=${encodeURIComponent(config.apiKey)}`;
  const json = await requestJson<GeminiResponse>({
    url,
    headers: {
      "Content-Type": "application/json",
    },
    body: {
      systemInstruction: {
        parts: [{ text: input.system }],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: input.prompt }],
        },
      ],
      generationConfig: {
        temperature: config.temperature,
        maxOutputTokens: Math.min(input.maxTokens || config.maxTokens, config.maxTokens),
      },
    },
  });

  return json.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || "";
}

async function requestJson<T>(input: { url: string; headers: Record<string, string>; body: unknown }): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(input.url, {
      method: "POST",
      headers: input.headers,
      body: JSON.stringify(input.body),
      signal: controller.signal,
    });

    const text = await response.text();

    if (!response.ok) {
      throw new AiServiceError("ai_provider_error", `AI provider request failed: ${response.status} ${text.slice(0, 240)}`);
    }

    return JSON.parse(text) as T;
  } catch (error) {
    if (error instanceof AiServiceError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new AiServiceError("ai_timeout", "AI provider request timed out.");
    }

    throw new AiServiceError("ai_provider_error", error instanceof Error ? error.message : "AI provider request failed.");
  } finally {
    clearTimeout(timeout);
  }
}

interface OpenAiChatResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

interface AnthropicResponse {
  content?: Array<{
    text?: string;
  }>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
      }>;
    };
  }>;
}
