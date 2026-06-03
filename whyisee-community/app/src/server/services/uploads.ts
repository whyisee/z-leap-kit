import { randomBytes } from "node:crypto";
import path from "node:path";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { query } from "@server/db/client";

const allowedImageTypes = new Map([
  ["image/jpeg", ".jpg"],
  ["image/png", ".png"],
  ["image/webp", ".webp"],
  ["image/gif", ".gif"],
]);

const maxImageBytes = Number(process.env.WHYISEE_UPLOAD_MAX_BYTES || 5 * 1024 * 1024);

export interface UploadedImage {
  id: number;
  url: string;
  markdown: string;
  originalName: string;
  sizeBytes: number;
  mimeType: string;
}

export async function saveImageUpload(file: File, userId: number): Promise<UploadedImage> {
  if (!file || file.size <= 0) {
    throw new Error("请选择图片文件。");
  }

  if (file.size > maxImageBytes) {
    throw new Error(`图片不能超过 ${Math.round(maxImageBytes / 1024 / 1024)}MB。`);
  }

  const extension = allowedImageTypes.get(file.type);

  if (!extension) {
    throw new Error("仅支持 JPG、PNG、WebP 和 GIF 图片。");
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  if (!looksLikeImage(buffer, file.type)) {
    throw new Error("图片内容和文件类型不匹配。");
  }

  const now = new Date();
  const year = String(now.getFullYear());
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const filename = `${now.getTime()}-${randomBytes(8).toString("hex")}${extension}`;
  const storedPath = path.posix.join("images", year, month, filename);
  const diskPath = getUploadDiskPath(storedPath);

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, buffer, { flag: "wx" });

  const publicUrl = `/uploads/${storedPath}`;
  const rows = await query<{ id: number }>(
    `
    INSERT INTO uploaded_files (user_id, original_name, stored_path, public_url, mime_type, size_bytes, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING id
    `,
    [userId, sanitizeOriginalName(file.name), storedPath, publicUrl, file.type, file.size, now.toISOString()],
  );

  const originalName = sanitizeOriginalName(file.name);

  return {
    id: rows[0]?.id || 0,
    url: publicUrl,
    markdown: `![${originalName}](${publicUrl})`,
    originalName,
    sizeBytes: file.size,
    mimeType: file.type,
  };
}

export async function readUploadedFile(storedPath: string) {
  const cleanPath = normalizeStoredPath(storedPath);
  const diskPath = getUploadDiskPath(cleanPath);
  const fileStat = await stat(diskPath);

  if (!fileStat.isFile()) {
    throw new Error("Upload is not a file.");
  }

  return {
    bytes: await readFile(diskPath),
    mimeType: contentTypeFromPath(cleanPath),
  };
}

function getUploadRoot() {
  return path.resolve(process.env.WHYISEE_UPLOAD_DIR || "./uploads");
}

function getUploadDiskPath(storedPath: string) {
  const cleanPath = normalizeStoredPath(storedPath);
  const root = getUploadRoot();
  const diskPath = path.resolve(root, cleanPath);

  if (!diskPath.startsWith(root + path.sep)) {
    throw new Error("Invalid upload path.");
  }

  return diskPath;
}

function normalizeStoredPath(value: string) {
  const normalized = value.replaceAll("\\", "/").replace(/^\/+/, "");

  if (!normalized || normalized.includes("..")) {
    throw new Error("Invalid upload path.");
  }

  return normalized;
}

function contentTypeFromPath(value: string) {
  const extension = path.extname(value).toLowerCase();

  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".webp") return "image/webp";
  if (extension === ".gif") return "image/gif";

  return "application/octet-stream";
}

function sanitizeOriginalName(value: string) {
  return (value || "image").replace(/[^\w.\-\u4e00-\u9fa5]+/g, "-").slice(0, 120) || "image";
}

function looksLikeImage(buffer: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }

  if (mimeType === "image/webp") {
    return buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }

  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }

  return false;
}
