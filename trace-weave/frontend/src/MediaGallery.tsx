import type { MediaAttachment } from "./api";
import type { PendingMediaAttachment } from "./useMediaAttachments";

const kindLabels = {
  voice: "语音",
  image: "图片",
  screenshot: "截图",
  video: "视频",
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
}: {
  attachments: PendingMediaAttachment[];
  onRemove: (id: string) => void;
  onMove?: (id: string, direction: -1 | 1) => void;
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
          <div className="pending-media-actions">
            {onMove ? <button type="button" disabled={index === 0} onClick={() => onMove(attachment.id, -1)}>前移</button> : null}
            {onMove ? <button type="button" disabled={index === attachments.length - 1} onClick={() => onMove(attachment.id, 1)}>后移</button> : null}
            <button type="button" onClick={() => onRemove(attachment.id)} aria-label={`移除${attachment.file.name}`}>移除</button>
          </div>
        </figure>
      ))}
    </div>
  );
}
