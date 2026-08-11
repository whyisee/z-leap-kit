import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { extname, isAbsolute, relative, resolve, sep } from "node:path";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "../config";
import { mediaScanner } from "./media-scanner";

export type MediaKind = "voice" | "image" | "screenshot" | "video" | "file";

const allowedAudioMimeTypes = new Set([
  "audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav",
  "audio/aac", "audio/flac",
]);
const allowedImageMimeTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "image/avif",
]);
const allowedVideoMimeTypes = new Set([
  "video/mp4", "video/webm", "video/quicktime", "video/x-m4v", "video/mpeg", "video/3gpp",
]);
const mimeExtensions: Record<string, string> = {
  "audio/webm": ".webm", "audio/ogg": ".ogg", "audio/mp4": ".m4a", "audio/mpeg": ".mp3",
  "audio/wav": ".wav", "audio/x-wav": ".wav", "audio/aac": ".aac", "audio/flac": ".flac",
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif",
  "image/heic": ".heic", "image/heif": ".heif", "image/avif": ".avif",
  "video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov",
  "video/x-m4v": ".m4v", "video/mpeg": ".mpeg", "video/3gpp": ".3gp",
};

const envelopeMagic = Buffer.from("TWENC1", "ascii");

type EnvelopeHeader = {
  version: 1;
  keyId: string;
  wrapIv: string;
  wrapTag: string;
  wrappedKey: string;
  contentIv: string;
  contentTag: string;
  plaintextSize: number;
};

export class MediaValidationError extends Error {
  constructor(message: string, readonly statusCode = 400) {
    super(message);
    this.name = "MediaValidationError";
  }
}

function sanitizeExtension(filename: string | undefined, mimeType: string): string {
  const normalizedMimeType = mimeType.toLowerCase().split(";", 1)[0];
  const expected = mimeExtensions[normalizedMimeType];
  if (expected) return expected;
  const candidate = filename ? extname(filename).toLowerCase() : "";
  if (/^\.[a-z0-9]{1,8}$/.test(candidate)) return candidate;
  return ".media";
}

function masterKeys(): Map<string, Buffer> {
  const keys = new Map<string, Buffer>();
  if (config.MEDIA_ENCRYPTION_KEYRING) {
    for (const [keyId, encoded] of Object.entries(JSON.parse(config.MEDIA_ENCRYPTION_KEYRING) as Record<string, string>)) keys.set(keyId, Buffer.from(encoded, "base64"));
  }
  if (config.MEDIA_ENCRYPTION_KEY) keys.set(config.MEDIA_ENCRYPTION_KEY_ID, Buffer.from(config.MEDIA_ENCRYPTION_KEY, "base64"));
  return keys;
}

function envelopeKeyId(blob: Buffer): string | null {
  if (!blob.subarray(0, envelopeMagic.byteLength).equals(envelopeMagic)) return null;
  const headerLength = blob.readUInt32BE(envelopeMagic.byteLength);
  const start = envelopeMagic.byteLength + 4;
  const header = JSON.parse(blob.subarray(start, start + headerLength).toString("utf8")) as EnvelopeHeader;
  return header.keyId;
}

export function encryptMediaEnvelope(
  plaintext: Buffer,
  storageKey: string,
  key: Buffer,
  keyId: string,
): Buffer {
  const dataKey = randomBytes(32);
  const wrapIv = randomBytes(12);
  const wrapCipher = createCipheriv("aes-256-gcm", key, wrapIv);
  wrapCipher.setAAD(Buffer.from(keyId));
  const wrappedKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
  const wrapTag = wrapCipher.getAuthTag();

  const contentIv = randomBytes(12);
  const contentCipher = createCipheriv("aes-256-gcm", dataKey, contentIv);
  contentCipher.setAAD(Buffer.from(storageKey));
  const ciphertext = Buffer.concat([contentCipher.update(plaintext), contentCipher.final()]);
  const header: EnvelopeHeader = {
    version: 1,
    keyId,
    wrapIv: wrapIv.toString("base64"),
    wrapTag: wrapTag.toString("base64"),
    wrappedKey: wrappedKey.toString("base64"),
    contentIv: contentIv.toString("base64"),
    contentTag: contentCipher.getAuthTag().toString("base64"),
    plaintextSize: plaintext.byteLength,
  };
  const headerBytes = Buffer.from(JSON.stringify(header));
  const headerLength = Buffer.allocUnsafe(4);
  headerLength.writeUInt32BE(headerBytes.byteLength);
  return Buffer.concat([envelopeMagic, headerLength, headerBytes, ciphertext]);
}

export function decryptMediaEnvelope(blob: Buffer, storageKey: string, key: Buffer): Buffer {
  if (!blob.subarray(0, envelopeMagic.byteLength).equals(envelopeMagic)) return blob;
  if (blob.byteLength < envelopeMagic.byteLength + 4) throw new Error("Invalid encrypted media envelope");
  const headerLength = blob.readUInt32BE(envelopeMagic.byteLength);
  const headerStart = envelopeMagic.byteLength + 4;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd > blob.byteLength) throw new Error("Invalid encrypted media header");
  const header = JSON.parse(blob.subarray(headerStart, headerEnd).toString("utf8")) as EnvelopeHeader;
  if (header.version !== 1) throw new Error(`Unsupported media envelope version: ${header.version}`);

  const wrapDecipher = createDecipheriv("aes-256-gcm", key, Buffer.from(header.wrapIv, "base64"));
  wrapDecipher.setAAD(Buffer.from(header.keyId));
  wrapDecipher.setAuthTag(Buffer.from(header.wrapTag, "base64"));
  const dataKey = Buffer.concat([
    wrapDecipher.update(Buffer.from(header.wrappedKey, "base64")),
    wrapDecipher.final(),
  ]);
  const contentDecipher = createDecipheriv("aes-256-gcm", dataKey, Buffer.from(header.contentIv, "base64"));
  contentDecipher.setAAD(Buffer.from(storageKey));
  contentDecipher.setAuthTag(Buffer.from(header.contentTag, "base64"));
  const plaintext = Buffer.concat([contentDecipher.update(blob.subarray(headerEnd)), contentDecipher.final()]);
  if (plaintext.byteLength !== header.plaintextSize) throw new Error("Encrypted media size verification failed");
  return plaintext;
}

interface PrivateObjectStore {
  readonly provider: "local" | "s3";
  put(storageKey: string, body: Buffer, mimeType: string, encrypted: boolean): Promise<void>;
  get(storageKey: string): Promise<Buffer>;
  delete(storageKey: string): Promise<void>;
}

class LocalPrivateObjectStore implements PrivateObjectStore {
  readonly provider = "local" as const;
  private readonly root = resolve(config.MEDIA_LOCAL_DIR);

  private absolutePath(storageKey: string): string {
    if (isAbsolute(storageKey)) throw new Error("Invalid absolute storage key");
    const target = resolve(this.root, storageKey);
    const rootPrefix = this.root.endsWith(sep) ? this.root : `${this.root}${sep}`;
    if (!target.startsWith(rootPrefix)) throw new Error("Storage key escapes media root");
    return target;
  }

  async put(storageKey: string, body: Buffer): Promise<void> {
    const target = this.absolutePath(storageKey);
    await mkdir(resolve(target, ".."), { recursive: true });
    await writeFile(target, body, { flag: "wx", mode: 0o600 });
  }

  async get(storageKey: string): Promise<Buffer> {
    return readFile(this.absolutePath(storageKey));
  }

  async delete(storageKey: string): Promise<void> {
    const target = this.absolutePath(storageKey);
    await rm(target, { force: true });
    const entryDirectory = resolve(target, "..");
    const relativeEntryDirectory = relative(this.root, entryDirectory);
    if (relativeEntryDirectory && !relativeEntryDirectory.startsWith("..")) {
      await rm(entryDirectory, { recursive: false, force: true }).catch(() => undefined);
    }
  }
}

class S3PrivateObjectStore implements PrivateObjectStore {
  readonly provider = "s3" as const;
  private readonly bucket = config.MEDIA_S3_BUCKET!;
  private readonly client = new S3Client({
    region: config.MEDIA_S3_REGION,
    endpoint: config.MEDIA_S3_ENDPOINT,
    forcePathStyle: config.MEDIA_S3_FORCE_PATH_STYLE,
    credentials: config.MEDIA_S3_ACCESS_KEY_ID && config.MEDIA_S3_SECRET_ACCESS_KEY
      ? { accessKeyId: config.MEDIA_S3_ACCESS_KEY_ID, secretAccessKey: config.MEDIA_S3_SECRET_ACCESS_KEY }
      : undefined,
  });

  async put(storageKey: string, body: Buffer, mimeType: string, encrypted: boolean): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: storageKey,
      Body: body,
      ContentType: encrypted ? "application/octet-stream" : mimeType,
      ServerSideEncryption: config.MEDIA_S3_KMS_KEY_ID ? "aws:kms" : "AES256",
      SSEKMSKeyId: config.MEDIA_S3_KMS_KEY_ID,
      Metadata: { traceweaveEncrypted: encrypted ? "true" : "false" },
    }));
  }

  async get(storageKey: string): Promise<Buffer> {
    const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: storageKey }));
    if (!result.Body) throw new Error("Media object has no body");
    return Buffer.from(await result.Body.transformToByteArray());
  }

  async delete(storageKey: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: storageKey }));
  }
}

class PrivateMediaStorage {
  private readonly store: PrivateObjectStore = config.MEDIA_STORAGE_PROVIDER === "s3"
    ? new S3PrivateObjectStore()
    : new LocalPrivateObjectStore();

  assertAudio(mimeType: string, byteSize: number): void {
    this.assertMedia("voice", mimeType, byteSize);
  }

  assertMedia(kind: MediaKind, mimeType: string, byteSize: number): void {
    const normalizedMimeType = mimeType.toLowerCase().split(";", 1)[0];
    const allowed = kind === "voice" ? allowedAudioMimeTypes : kind === "video" ? allowedVideoMimeTypes : allowedImageMimeTypes;
    const kindLabel = kind === "voice" ? "录音" : kind === "video" ? "视频" : kind === "screenshot" ? "截图" : kind === "file" ? "文件" : "图片";
    if (kind !== "file" && !allowed.has(normalizedMimeType)) throw new MediaValidationError(`不支持的${kindLabel}格式：${mimeType || "未知格式"}`);
    if (byteSize === 0) throw new MediaValidationError(`${kindLabel}内容为空`);
    if (byteSize > config.MEDIA_MAX_BYTES) {
      throw new MediaValidationError(`单个附件不能超过 ${Math.floor(config.MEDIA_MAX_BYTES / 1024 / 1024)} MB`, 413);
    }
  }

  async saveVoice(input: {
    ownerUserId: string; rawEntryId: string; attachmentId: string;
    filename?: string; mimeType: string; buffer: Buffer;
  }) {
    return this.save({ ...input, kind: "voice" as const });
  }

  async save(input: {
    ownerUserId: string; rawEntryId: string; attachmentId: string;
    filename?: string; mimeType: string; buffer: Buffer; kind: MediaKind;
  }): Promise<{
    storageKey: string;
    sha256: string;
    byteSize: number;
    encryptionKeyRef: string | null;
    storageProvider: "local" | "s3";
  }> {
    this.assertMedia(input.kind, input.mimeType, input.buffer.byteLength);
    await mediaScanner.scan(input.buffer);
    const extension = sanitizeExtension(input.filename, input.mimeType);
    const storageKey = `${input.ownerUserId}/${input.rawEntryId}/${input.attachmentId}${extension}`;
    const key = masterKeys().get(config.MEDIA_ENCRYPTION_KEY_ID) ?? null;
    const body = key
      ? encryptMediaEnvelope(input.buffer, storageKey, key, config.MEDIA_ENCRYPTION_KEY_ID)
      : input.buffer;
    await this.store.put(storageKey, body, input.mimeType, Boolean(key));
    return {
      storageKey,
      sha256: createHash("sha256").update(input.buffer).digest("hex"),
      byteSize: input.buffer.byteLength,
      encryptionKeyRef: key ? config.MEDIA_ENCRYPTION_KEY_ID : null,
      storageProvider: this.store.provider,
    };
  }

  async open(storageKey: string): Promise<{ stream: Readable; size: number }> {
    const stored = await this.store.get(storageKey);
    const encrypted = stored.subarray(0, envelopeMagic.byteLength).equals(envelopeMagic);
    const keyId = encrypted ? envelopeKeyId(stored) : null;
    const key = keyId ? masterKeys().get(keyId) ?? null : null;
    if (encrypted && !key) throw new Error("Encrypted media key is unavailable");
    const plaintext = encrypted ? decryptMediaEnvelope(stored, storageKey, key!) : stored;
    return { stream: Readable.from(plaintext), size: plaintext.byteLength };
  }

  async delete(storageKey: string): Promise<void> {
    await this.store.delete(storageKey);
  }
}

export const mediaStorage = new PrivateMediaStorage();
