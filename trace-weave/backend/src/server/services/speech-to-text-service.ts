import { config } from "../config";

export class SpeechToTextError extends Error {
  constructor(message: string, readonly statusCode: 400 | 503 = 503) {
    super(message);
    this.name = "SpeechToTextError";
  }
}

export const speechToTextService = {
  configured: config.STT_PROVIDER === "openai_compatible" && Boolean(config.STT_API_KEY),
  provider: config.STT_PROVIDER,
  model: config.STT_MODEL,
  async transcribe(input: { buffer: Buffer; mimeType: string; filename: string; language?: string }): Promise<{ text: string; provider: string; model: string }> {
    if (!this.configured) throw new SpeechToTextError("后端语音转写尚未配置；可继续使用浏览器实时转写或手动填写文字");
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.STT_TIMEOUT_MS);
    try {
      const form = new FormData();
      const bytes = new Uint8Array(new ArrayBuffer(input.buffer.byteLength));
      bytes.set(input.buffer);
      form.append("file", new Blob([bytes], { type: input.mimeType }), input.filename);
      form.append("model", config.STT_MODEL);
      if (input.language) form.append("language", input.language.split("-")[0]);
      form.append("response_format", "json");
      const response = await fetch(`${config.STT_BASE_URL.replace(/\/$/, "")}/audio/transcriptions`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.STT_API_KEY}` },
        body: form,
        signal: controller.signal,
      });
      if (!response.ok) throw new SpeechToTextError(`语音转写服务返回 ${response.status}`);
      const payload = await response.json() as { text?: unknown };
      if (typeof payload.text !== "string" || !payload.text.trim()) throw new SpeechToTextError("语音转写服务没有返回文字");
      return { text: payload.text.trim(), provider: config.STT_PROVIDER, model: config.STT_MODEL };
    } catch (error) {
      if (error instanceof SpeechToTextError) throw error;
      throw new SpeechToTextError(error instanceof Error && error.name === "AbortError" ? "语音转写超时" : "语音转写暂时不可用");
    } finally {
      clearTimeout(timeout);
    }
  },
};
