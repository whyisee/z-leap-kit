import type { MediaAttachment } from "./api";
import type { PendingMediaAttachment } from "./useMediaAttachments";

const kindLabels = {
  voice: "语音",
  image: "图片",
  screenshot: "截图",
  video: "视频",
  file: "文件",
} as const;

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function MediaPreview({
  kind,
  url,
  name,
}: {
  kind: MediaAttachment["kind"];
  url: string;
  name: string;
}) {
  if (kind === "voice") return <audio controls preload="metadata" src={url} />;
  if (kind === "video") return <video controls preload="metadata" src={url} aria-label={name} />;
  if (kind === "file") return (
    <a className="media-file-preview" href={url} download={name} aria-label={`下载文件：${name}`}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M6.5 3.5h7l4 4v13h-11z" />
        <path d="M13.5 3.5v4h4M9 13h6M9 16h4" />
      </svg>
      <span>下载文件</span>
    </a>
  );
  return <img src={url} alt={name} loading="lazy" />;
}

export function StoredMediaGallery({
  attachments,
  compact = false,
}: {
  attachments: MediaAttachment[];
  compact?: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <div className={`media-gallery ${compact ? "compact" : ""}`}>
      {attachments.map((attachment) => (
        <figure className={`media-item ${attachment.kind}`} key={attachment.id}>
          <MediaPreview
            kind={attachment.kind}
            url={attachment.url || `/api/media/${attachment.id}`}
            name={attachment.originalFilename || kindLabels[attachment.kind]}
          />
          <figcaption>
            <strong>{kindLabels[attachment.kind]}</strong>
            <span>{attachment.originalFilename || "未命名附件"} · {formatBytes(attachment.byteSize)}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

export function PendingMediaGallery({
  attachments,
  onRemove,
  onMove,
  readOnly = false,
}: {
  attachments: PendingMediaAttachment[];
  onRemove?: (id: string) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
  readOnly?: boolean;
}) {
  if (!attachments.length) return null;
  return (
    <div className="media-gallery pending">
      {attachments.map((attachment, index) => (
        <figure className={`media-item ${attachment.kind}`} key={attachment.id}>
          <MediaPreview
            kind={attachment.kind}
            url={attachment.previewUrl}
            name={attachment.file.name || kindLabels[attachment.kind]}
          />
          <figcaption>
            <strong>{kindLabels[attachment.kind]}</strong>
            <span>{attachment.file.name || "未命名附件"} · {formatBytes(attachment.file.size)}</span>
          </figcaption>
          {!readOnly ? (
            <div className="pending-media-actions">
              {onMove ? <button type="button" disabled={index === 0} onClick={() => onMove(attachment.id, -1)}>前移</button> : null}
              {onMove ? <button type="button" disabled={index === attachments.length - 1} onClick={() => onMove(attachment.id, 1)}>后移</button> : null}
              {onRemove ? <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`移除${attachment.file.name}`}>移除</button> : null}
            </div>
          ) : null}
        </figure>
      ))}
    </div>
  );
}
