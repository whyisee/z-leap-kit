import { useCallback, useEffect, useRef, useState } from "react";
import type { MediaKind } from "./api";

export type SupplementalMediaKind = Exclude<MediaKind, "voice">;

export type PendingMediaAttachment = {
  id: string;
  kind: SupplementalMediaKind;
  file: File;
  previewUrl: string;
};

const maxSupplementalFiles = 11;
const maxTotalBytes = 100 * 1024 * 1024;

const inferredMimeTypes: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  m4v: "video/x-m4v",
  mpeg: "video/mpeg",
  mpg: "video/mpeg",
  "3gp": "video/3gpp",
};

function normalizeFile(file: File): File {
  if (file.type) return file;
  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const inferred = inferredMimeTypes[extension];
  return inferred ? new File([file], file.name, { type: inferred, lastModified: file.lastModified }) : file;
}

function kindAcceptsFile(kind: SupplementalMediaKind, file: File): boolean {
  return kind === "video" ? file.type.startsWith("video/") : file.type.startsWith("image/");
}

export function useMediaAttachments() {
  const [items, setItems] = useState<PendingMediaAttachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const add = useCallback((files: FileList | File[], kind: SupplementalMediaKind) => {
    const normalized = Array.from(files).map(normalizeFile);
    const invalid = normalized.find((file) => !kindAcceptsFile(kind, file));
    if (invalid) {
      setError(kind === "video" ? "视频入口只能添加视频文件" : "图片入口只能添加图片文件");
      return;
    }

    setItems((current) => {
      if (current.length + normalized.length > maxSupplementalFiles) {
        setError(`每条记录最多添加 ${maxSupplementalFiles} 个图片、截图或视频附件`);
        return current;
      }
      const nextBytes = [...current.map((item) => item.file), ...normalized].reduce(
        (sum, file) => sum + file.size,
        0,
      );
      if (nextBytes > maxTotalBytes) {
        setError("单条记录的附件总大小不能超过 100 MB");
        return current;
      }
      setError(null);
      return [
        ...current,
        ...normalized.map((file) => ({
          id: crypto.randomUUID(),
          kind,
          file,
          previewUrl: URL.createObjectURL(file),
        })),
      ];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setItems((current) => {
      const removed = current.find((item) => item.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return current.filter((item) => item.id !== id);
    });
    setError(null);
  }, []);

  const reset = useCallback(() => {
    setItems((current) => {
      current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
      return [];
    });
    setError(null);
  }, []);

  const move = useCallback((id: string, direction: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
    },
    [],
  );

  return {
    items,
    error,
    totalBytes: items.reduce((sum, item) => sum + item.file.size, 0),
    add,
    remove,
    move,
    reset,
  };
}
