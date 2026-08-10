import { createConnection } from "node:net";
import { config } from "../config";

export class MediaScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaScanError";
  }
}

export function classifyClamAvResponse(response: string): "clean" | "infected" | "error" {
  if (/\bFOUND\b/.test(response)) return "infected";
  if (/\bOK\b/.test(response)) return "clean";
  return "error";
}

async function scanWithClamAv(buffer: Buffer): Promise<void> {
  const host = config.CLAMAV_HOST;
  if (!host) throw new MediaScanError("ClamAV 主机未配置");
  const response = await new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host, port: config.CLAMAV_PORT });
    const chunks: Buffer[] = [];
    const timeout = setTimeout(() => socket.destroy(new Error("ClamAV scan timed out")), 15_000);
    socket.on("connect", () => {
      socket.write("zINSTREAM\0");
      for (let offset = 0; offset < buffer.byteLength; offset += 64 * 1024) {
        const chunk = buffer.subarray(offset, Math.min(offset + 64 * 1024, buffer.byteLength));
        const length = Buffer.allocUnsafe(4);
        length.writeUInt32BE(chunk.byteLength);
        socket.write(length);
        socket.write(chunk);
      }
      socket.end(Buffer.alloc(4));
    });
    socket.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    socket.on("error", reject);
    socket.on("close", () => {
      clearTimeout(timeout);
      resolve(Buffer.concat(chunks).toString("utf8").replaceAll("\0", "").trim());
    });
  });
  const result = classifyClamAvResponse(response);
  if (result === "infected") throw new MediaScanError("附件未通过安全扫描，已拒绝保存");
  if (result !== "clean") throw new MediaScanError(`附件扫描服务返回异常：${response || "empty response"}`);
}

export const mediaScanner = {
  async scan(buffer: Buffer): Promise<void> {
    if (config.MEDIA_SCAN_MODE === "off") return;
    await scanWithClamAv(buffer);
  },
};
