import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  api,
  type AppNotification,
  type AuthUser,
  type CandidateRecord,
  type CandidateEntity,
  type CandidateParticipant,
  type Draft,
  type EntityMemory,
  type EventDetail,
  type EventPrivacySettings,
  type HealthStatus,
  type LocationObservation,
  type MediaAttachment,
  type NotificationPreferences,
  type GlobalGraph,
  type PersonalGraph,
  type SocialDiscovery,
  type SharedParticipantInvite,
  type SharedOccurrence,
  type SharedFactPermissions,
  type TimelineEvent,
} from "./api";
import { AuthScreen } from "./AuthScreen";
import { DataGovernanceView } from "./DataGovernanceView";
import { EntityMemoryView } from "./EntityMemoryView";
import { GraphView } from "./GraphView";
import { PendingMediaGallery, StoredMediaGallery } from "./MediaGallery";
import { ReviewView } from "./ReviewView";
import { PrivacySettingsView } from "./PrivacySettingsView";
import { SocialDiscoveryView } from "./SocialDiscoveryView";
import { useLocationCapture } from "./useLocationCapture";
import { useMediaAttachments } from "./useMediaAttachments";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { mergeCandidatePayloads, prepareCandidates } from "./candidate-resolution";
import "./styles.css";

type View = "record" | "drafts" | "timeline" | "review" | "graph" | "discover" | "memory" | "privacy" | "data" | "notifications";

const eventTypeLabels: Record<string, string> = {
  activity: "一般活动",
  eat: "饮食",
  drink: "饮品",
  read: "阅读",
  listen: "收听",
  watch: "观看",
  play: "游玩",
  purchase: "消费",
  visit: "到访",
};

const factualStatusLabels: Record<string, string> = {
  occurred: "已经发生",
  ongoing: "正在发生",
  planned: "计划事项",
  cancelled: "已经取消",
  negated: "没有发生",
  uncertain: "不确定",
  inferred: "系统推断",
};

function formatDate(value: string | null): string {
  if (!value) return "时间未识别";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatDay(value: string | null): string {
  if (!value) return "日期未识别";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(value));
}

function toDateTimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function optionalNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function JsonRecordEditor({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(JSON.stringify(value, null, 2)), [value]);

  return (
    <label className="field candidate-json-field">
      <span>{label}</span>
      <textarea
        value={text}
        rows={3}
        onChange={(event) => {
          const next = event.target.value;
          setText(next);
          try {
            const parsed = JSON.parse(next) as unknown;
            if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error();
            setError(null);
            onChange(parsed as Record<string, unknown>);
          } catch {
            setError("请输入 JSON 对象");
          }
        }}
      />
      {error ? <small className="field-error">{error}</small> : null}
    </label>
  );
}

function CandidateEditor({
  candidate,
  onChange,
  location,
  entityMemory,
  index,
  canMergePrevious,
  onSplit,
  onMergePrevious,
  onReject,
}: {
  candidate: CandidateRecord;
  onChange: (next: CandidateRecord) => void;
  location: LocationObservation | null;
  entityMemory: EntityMemory[];
  index: number;
  canMergePrevious: boolean;
  onSplit: () => void;
  onMergePrevious: () => void;
  onReject: () => void;
}) {
  const updatePayload = (patch: Partial<CandidateRecord["payload"]>) =>
    onChange({ ...candidate, payload: { ...candidate.payload, ...patch } });

  return (
    <section className="candidate-card">
      <div className="candidate-heading">
        <div>
          <span className="eyebrow">
            {candidate.parserProvider === "deepseek"
              ? `DeepSeek 解析 · ${candidate.parserModelVersion ?? ""}`
              : "开发规则解析 · 非 AI"}
          </span>
          <h2>请确认第 {index + 1} 件事</h2>
        </div>
        <div className="candidate-resolution-actions">
          <span className="confidence">置信度 {Math.round(candidate.payload.confidence * 100)}%</span>
          <button className="text-button" type="button" onClick={onSplit}>拆成两件</button>
          {canMergePrevious ? <button className="text-button" type="button" onClick={onMergePrevious}>并入上一件</button> : null}
          <button className="text-button danger" type="button" onClick={onReject}>不记录</button>
        </div>
      </div>

      <label className="field field-wide">
        <span>事件描述</span>
        <textarea
          value={candidate.payload.title}
          onChange={(event) => updatePayload({ title: event.target.value })}
          rows={3}
        />
      </label>

      <div className="field-grid">
        <label className="field">
          <span>活动类型</span>
          <select
            value={candidate.payload.eventType}
            onChange={(event) => updatePayload({ eventType: event.target.value })}
          >
            {Object.entries(eventTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>事实状态</span>
          <select
            value={candidate.payload.factualStatus}
            onChange={(event) =>
              updatePayload({
                factualStatus: event.target.value as CandidateRecord["payload"]["factualStatus"],
              })
            }
          >
            {Object.entries(factualStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>开始时间</span>
          <input
            type="datetime-local"
            value={toDateTimeLocal(candidate.payload.time.start)}
            onChange={(event) =>
              updatePayload({
                time: {
                  ...candidate.payload.time,
                  start: event.target.value ? new Date(event.target.value).toISOString() : null,
                  precision: event.target.value ? "minute" : "unknown",
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>结束时间</span>
          <input
            type="datetime-local"
            value={toDateTimeLocal(candidate.payload.time.end)}
            onChange={(event) =>
              updatePayload({
                time: {
                  ...candidate.payload.time,
                  end: event.target.value ? new Date(event.target.value).toISOString() : null,
                },
              })
            }
          />
        </label>
        <label className="field">
          <span>时间精度</span>
          <select
            value={candidate.payload.time.precision}
            onChange={(event) => updatePayload({ time: { ...candidate.payload.time, precision: event.target.value } })}
          >
            <option value="minute">分钟</option>
            <option value="hour">小时</option>
            <option value="day">天</option>
            <option value="week">周</option>
            <option value="month">月</option>
            <option value="year">年</option>
            <option value="approximate">大约</option>
            <option value="unknown">未知</option>
          </select>
        </label>
        <label className="field">
          <span>时区</span>
          <input
            value={candidate.payload.time.timezone ?? ""}
            placeholder="Asia/Shanghai"
            onChange={(event) => updatePayload({ time: { ...candidate.payload.time, timezone: event.target.value || null } })}
          />
        </label>
        <label className="field field-wide">
          <span>原始时间表达</span>
          <input
            value={candidate.payload.time.sourceExpression ?? ""}
            placeholder="例如：今天中午、上周末"
            onChange={(event) => updatePayload({ time: { ...candidate.payload.time, sourceExpression: event.target.value || null } })}
          />
        </label>
      </div>

      <div className="candidate-structured-editor">
        <div className="structured-editor-heading">
          <div><span className="field-caption">参与人</span><small>“我”与其他同行人都会进入事件关系。</small></div>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              updatePayload({
                participants: [
                  ...candidate.payload.participants,
                  { mention: "", role: "companion", isCurrentUser: false, confidence: 1 },
                ],
              })
            }
          >
            添加参与人
          </button>
        </div>
        <div className="candidate-record-list">
          {candidate.payload.participants.map((participant, index) => (
            <div className="candidate-record-row participant-row" key={`participant-${index}`}>
              <label className="field">
                <span>称呼</span>
                <input
                  value={participant.mention}
                  placeholder={participant.isCurrentUser ? "我" : "姓名或称呼"}
                  onChange={(event) => {
                    const participants = [...candidate.payload.participants];
                    participants[index] = { ...participant, mention: event.target.value };
                    updatePayload({ participants });
                  }}
                />
              </label>
              <label className="field">
                <span>角色</span>
                <input
                  value={participant.role}
                  placeholder="actor / companion"
                  onChange={(event) => {
                    const participants = [...candidate.payload.participants];
                    participants[index] = { ...participant, role: event.target.value };
                    updatePayload({ participants });
                  }}
                />
              </label>
              {!participant.isCurrentUser ? (
                <label className="field">
                  <span>长期人物</span>
                  <select
                    value={participant.resolvedUserEntityId ?? ""}
                    onChange={(event) => {
                      const participants = [...candidate.payload.participants];
                      participants[index] = { ...participant, resolvedUserEntityId: event.target.value || undefined };
                      updatePayload({ participants });
                    }}
                  >
                    <option value="">按名称自动识别</option>
                    {entityMemory.filter((item) => item.entityType === "person").map((item) => (
                      <option key={item.id} value={item.id}>{item.displayName}</option>
                    ))}
                  </select>
                </label>
              ) : <span />}
              <label className="candidate-inline-check">
                <input
                  type="checkbox"
                  checked={participant.isCurrentUser}
                  onChange={(event) => {
                    const participants = [...candidate.payload.participants];
                    participants[index] = {
                      ...participant,
                      isCurrentUser: event.target.checked,
                      mention: event.target.checked && !participant.mention ? "我" : participant.mention,
                      resolvedUserEntityId: event.target.checked ? undefined : participant.resolvedUserEntityId,
                    };
                    updatePayload({ participants });
                  }}
                />
                <span>这是我</span>
              </label>
              <button
                className="text-button danger"
                type="button"
                onClick={() => updatePayload({ participants: candidate.payload.participants.filter((_, itemIndex) => itemIndex !== index) })}
              >删除</button>
            </div>
          ))}
          {!candidate.payload.participants.length ? <span className="empty-inline">没有参与人，可手动添加。</span> : null}
        </div>

        <div className="structured-editor-heading entity-heading">
          <div><span className="field-caption">实体、数量与金额</span><small>食物、地点、App、视频、游戏、书、歌等都在这里修正。</small></div>
          <button
            className="text-button"
            type="button"
            onClick={() =>
              updatePayload({
                entities: [
                  ...candidate.payload.entities,
                  { mention: "", entityType: "object", role: "object", confidence: 1, attributes: {} },
                ],
              })
            }
          >
            添加实体
          </button>
        </div>
        <div className="candidate-entity-list">
          {candidate.payload.entities.map((entity, index) => {
            const updateEntity = (patch: Partial<typeof entity>) => {
              const entities = [...candidate.payload.entities];
              entities[index] = { ...entity, ...patch };
              updatePayload({ entities });
            };
            return (
              <div className="candidate-entity-row" key={`entity-${index}`}>
                <div className="candidate-entity-fields">
                  <label className="field"><span>名称</span><input value={entity.mention} onChange={(event) => updateEntity({ mention: event.target.value })} /></label>
                  <label className="field"><span>类型</span><input value={entity.entityType} placeholder="food / place / app / book" onChange={(event) => updateEntity({ entityType: event.target.value, resolvedUserEntityId: undefined })} /></label>
                  <label className="field">
                    <span>长期实体</span>
                    <select value={entity.resolvedUserEntityId ?? ""} onChange={(event) => updateEntity({ resolvedUserEntityId: event.target.value || undefined })}>
                      <option value="">按名称/别名自动识别</option>
                      {entityMemory.filter((item) => item.entityType === entity.entityType).map((item) => (
                        <option key={item.id} value={item.id}>{item.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field"><span>关系角色</span><input value={entity.role} placeholder="object / place / consumed" onChange={(event) => updateEntity({ role: event.target.value })} /></label>
                  <label className="field"><span>数量</span><input type="number" step="any" value={entity.quantity ?? ""} onChange={(event) => updateEntity({ quantity: optionalNumber(event.target.value) })} /></label>
                  <label className="field"><span>单位</span><input value={entity.unit ?? ""} onChange={(event) => updateEntity({ unit: event.target.value || undefined })} /></label>
                  <label className="field"><span>金额</span><input type="number" step="any" value={entity.amount ?? ""} onChange={(event) => updateEntity({ amount: optionalNumber(event.target.value) })} /></label>
                  <label className="field"><span>币种</span><input maxLength={3} value={entity.currency ?? ""} placeholder="CNY" onChange={(event) => updateEntity({ currency: event.target.value.toUpperCase() || undefined })} /></label>
                </div>
                <JsonRecordEditor label="扩展属性（JSON）" value={entity.attributes} onChange={(attributes) => updateEntity({ attributes })} />
                <button
                  className="text-button danger"
                  type="button"
                  onClick={() => updatePayload({ entities: candidate.payload.entities.filter((_, itemIndex) => itemIndex !== index) })}
                >删除实体</button>
              </div>
            );
          })}
          {!candidate.payload.entities.length ? <span className="empty-inline">暂未识别到实体，可手动添加。</span> : null}
        </div>

        <div className="candidate-json-grid">
          <JsonRecordEditor label="主观感受（JSON）" value={candidate.payload.subjectiveExperience} onChange={(subjectiveExperience) => updatePayload({ subjectiveExperience })} />
          <JsonRecordEditor label="事件扩展字段（JSON）" value={candidate.payload.extensions} onChange={(extensions) => updatePayload({ extensions })} />
        </div>
        <label className="field candidate-confidence-field">
          <span>确认后的整体置信度：{Math.round(candidate.payload.confidence * 100)}%</span>
          <input type="range" min="0" max="1" step="0.01" value={candidate.payload.confidence} onChange={(event) => updatePayload({ confidence: Number(event.target.value) })} />
        </label>
      </div>

      {location ? (
        <div className="candidate-location">
          <div>
            <span className="field-caption">这件事与定位的关系</span>
            <strong>{location.label || "已附加的坐标位置"}</strong>
            <small>
              {location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}
              {location.accuracyM !== null ? ` · 精度约 ${Math.round(location.accuracyM)} 米` : ""}
            </small>
          </div>
          <select
            aria-label="事件定位关系"
            value={candidate.location?.role ?? "none"}
            onChange={(event) => {
              const role = event.target.value;
              onChange({
                ...candidate,
                location:
                  role === "none"
                    ? undefined
                    : {
                        observationId: location.id,
                        role: role as "occurred_at" | "recorded_at",
                      },
              });
            }}
          >
            <option value="occurred_at">事情发生在这里</option>
            <option value="recorded_at">只是在这里记录</option>
            <option value="none">与这件事无关</option>
          </select>
        </div>
      ) : null}
    </section>
  );
}

function ParticipantLinkControl({
  eventId,
  participant,
  busy,
  onInvite,
  onRevoke,
}: {
  eventId: string;
  participant: TimelineEvent["participants"][number];
  busy: boolean;
  onInvite: (eventId: string, participantId: string, username: string) => Promise<boolean>;
  onRevoke: (inviteId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");

  if (participant.isCurrentUser) {
    return <span className="participant-account-chip current">我<small>{participant.role}</small></span>;
  }
  if (participant.link) {
    return (
      <div className={`participant-link-chip ${participant.link.status}`}>
        <span>
          <strong>{participant.link.displayName}</strong>
          <small>
            @{participant.link.username} · {participant.link.status === "accepted" ? "已确认共同经历" : "等待确认"}
          </small>
        </span>
        <button type="button" disabled={busy} onClick={() => void onRevoke(participant.link!.inviteId)}>
          {participant.link.status === "accepted" ? "解除" : "撤回"}
        </button>
      </div>
    );
  }
  if (participant.isAccount) {
    return <span className="participant-account-chip">{participant.name}<small>{participant.role}</small></span>;
  }
  if (!editing) {
    return (
      <button className="participant-unlinked" type="button" onClick={() => setEditing(true)}>
        <span>{participant.name}<small>{participant.role}</small></span>
        <strong>关联账户</strong>
      </button>
    );
  }
  return (
    <form
      className="participant-link-form"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        if (!username.trim() || busy) return;
        void onInvite(eventId, participant.id, username.trim()).then((success) => {
          if (success) {
            setUsername("");
            setEditing(false);
          }
        });
      }}
    >
      <label>
        <span>将“{participant.name}”关联到用户名</span>
        <input
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="输入对方完整用户名"
          autoComplete="off"
        />
      </label>
      <button className="text-button" type="button" onClick={() => setEditing(false)}>取消</button>
      <button className="secondary-button" type="submit" disabled={busy || !username.trim()}>发送确认</button>
    </form>
  );
}

function EventProvenancePanel({ detail, onClose }: { detail: EventDetail; onClose: () => void }) {
  return (
    <section className="event-provenance-panel">
      <div className="structured-editor-heading">
        <div><strong>原始记录与修改历史</strong><small>结构化事件始终可以追溯到用户主动提交的原文、转写和附件。</small></div>
        <button className="text-button" type="button" onClick={onClose}>收起</button>
      </div>
      <div className="event-source-contents">
        {detail.source.contents.map((content) => (
          <div key={content.id}>
            <span>{content.position + 1}. {content.kind}</span>
            {content.text ? <p>{content.text}</p> : null}
            {content.transcript ? <p>{content.transcript}<small>转写：{content.transcriptProvider ?? "未知"}</small></p> : null}
            {content.attachment ? <a href={content.attachment.url} target="_blank" rel="noreferrer">查看附件：{content.attachment.filename ?? content.attachment.kind}</a> : null}
          </div>
        ))}
      </div>
      <div className="event-revision-list">
        {detail.revisions.map((revision) => (
          <div key={revision.version}>
            <strong>v{revision.version} · {revision.operation === "created" ? "创建" : revision.operation === "updated" ? "修改" : "删除"}</strong>
            <span>{formatDate(revision.createdAt)}</span>
            <small>{revision.changedFields.length ? `变更字段：${revision.changedFields.join("、")}` : "初始确认版本"}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelineEventEditor({
  event,
  busy,
  onCancel,
  onSave,
  onDelete,
  onSavePrivacy,
  entityMemory,
  onSaveRelations,
}: {
  event: TimelineEvent;
  busy: boolean;
  onCancel: () => void;
  onSave: (
    event: TimelineEvent,
    input: {
      title: string;
      eventType: string;
      factualStatus: string;
      occurredStart: string | null;
      occurredEnd: string | null;
    },
  ) => Promise<void>;
  onDelete: (event: TimelineEvent) => Promise<void>;
  onSavePrivacy: (
    event: TimelineEvent,
    privacy: EventPrivacySettings,
  ) => Promise<EventPrivacySettings | null>;
  entityMemory: EntityMemory[];
  onSaveRelations: (event: TimelineEvent, input: {
    participants: Array<import("./api").CandidateParticipant & { existingParticipantId?: string }>;
    entities: import("./api").CandidateEntity[];
    location: { observationId: string; role: "occurred_at" | "recorded_at" } | null;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(event.title);
  const [eventType, setEventType] = useState(event.eventType);
  const [factualStatus, setFactualStatus] = useState(event.factualStatus);
  const [occurredStart, setOccurredStart] = useState(toDateTimeLocal(event.occurredStart));
  const [occurredEnd, setOccurredEnd] = useState(toDateTimeLocal(event.occurredEnd));
  const [participants, setParticipants] = useState<Array<CandidateParticipant & { existingParticipantId?: string }>>(() => event.participants.map((participant) => ({
    existingParticipantId: participant.id,
    mention: participant.name,
    role: participant.role,
    isCurrentUser: participant.isCurrentUser,
    confidence: 1,
    resolvedUserEntityId: participant.userEntityId ?? undefined,
  })));
  const [entities, setEntities] = useState<CandidateEntity[]>(() => event.entities.map((entity) => ({
    mention: entity.name,
    entityType: entity.type,
    role: entity.role,
    quantity: entity.quantity,
    unit: entity.unit,
    amount: entity.amount,
    currency: entity.currency,
    confidence: 1,
    attributes: entity.attributes ?? {},
    resolvedUserEntityId: entity.id,
  })));
  const [locationRole, setLocationRole] = useState<"occurred_at" | "recorded_at" | "none">(event.location?.role ?? "none");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [privacy, setPrivacy] = useState<EventPrivacySettings | null>(null);
  const [privacyError, setPrivacyError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api
      .getEventPrivacy(event.id)
      .then((settings) => {
        if (active) setPrivacy(settings);
      })
      .catch((error: Error) => {
        if (active) setPrivacyError(error.message);
      });
    return () => {
      active = false;
    };
  }, [event.id]);

  return (
    <form
      className="timeline-event-editor"
      onSubmit={(submitEvent) => {
        submitEvent.preventDefault();
        if (!title.trim() || busy) return;
        void onSave(event, {
          title: title.trim(),
          eventType,
          factualStatus,
          occurredStart: occurredStart ? new Date(occurredStart).toISOString() : null,
          occurredEnd: occurredEnd ? new Date(occurredEnd).toISOString() : null,
        });
      }}
    >
      <div className="field-grid">
        <label className="field field-wide">
          <span>事件描述</span>
          <textarea value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} rows={2} />
        </label>
        <label className="field">
          <span>活动类型</span>
          <select value={eventType} onChange={(changeEvent) => setEventType(changeEvent.target.value)}>
            {!eventTypeLabels[eventType] ? <option value={eventType}>{eventType}</option> : null}
            {Object.entries(eventTypeLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>事实状态</span>
          <select value={factualStatus} onChange={(changeEvent) => setFactualStatus(changeEvent.target.value)}>
            {Object.entries(factualStatusLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>开始时间</span>
          <input
            type="datetime-local"
            value={occurredStart}
            onChange={(changeEvent) => setOccurredStart(changeEvent.target.value)}
          />
        </label>
        <label className="field">
          <span>结束时间</span>
          <input
            type="datetime-local"
            min={occurredStart || undefined}
            value={occurredEnd}
            onChange={(changeEvent) => setOccurredEnd(changeEvent.target.value)}
          />
        </label>
      </div>
      <section className="event-privacy-editor">
        <div className="event-privacy-heading">
          <div>
            <strong>这条事件的隐私边界</strong>
            <small>原文和附件始终只对你可见；这里控制派生内容能否参与统计、匹配或共同经历。</small>
          </div>
          {privacy?.hasOverride ? <span>事件级策略 v{privacy.policyVersion}</span> : <span>继承默认策略</span>}
        </div>
        {privacy ? (
          <>
            <label className="field">
              <span>内容可见范围</span>
              <select
                value={privacy.contentVisibility}
                onChange={(changeEvent) => {
                  const contentVisibility = changeEvent.target.value as EventPrivacySettings["contentVisibility"];
                  setPrivacy({
                    ...privacy,
                    contentVisibility,
                    ...(contentVisibility === "isolated"
                      ? {
                          allowAnonymousStats: false,
                          allowMatching: false,
                          allowIdentityDisclosure: false,
                          allowSharedOccurrence: false,
                          effectiveMatching: false,
                        }
                      : {}),
                  });
                }}
              >
                <option value="private">仅自己</option>
                <option value="friends">好友可见</option>
                <option value="circle">圈子可见</option>
                <option value="public">公开可见</option>
                <option value="isolated">完全隔离</option>
              </select>
            </label>
            <div className="event-privacy-options">
              <label>
                <input
                  type="checkbox"
                  checked={privacy.allowAnonymousStats}
                  disabled={privacy.contentVisibility === "isolated"}
                  onChange={(changeEvent) =>
                    setPrivacy({ ...privacy, allowAnonymousStats: changeEvent.target.checked })
                  }
                />
                允许匿名统计
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={privacy.allowMatching}
                  disabled={privacy.contentVisibility === "isolated"}
                  onChange={(changeEvent) =>
                    setPrivacy({ ...privacy, allowMatching: changeEvent.target.checked })
                  }
                />
                允许匿名关系匹配
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={privacy.allowIdentityDisclosure}
                  disabled={privacy.contentVisibility === "isolated"}
                  onChange={(changeEvent) =>
                    setPrivacy({ ...privacy, allowIdentityDisclosure: changeEvent.target.checked })
                  }
                />
                允许匹配双方同意后披露身份
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={privacy.allowSharedOccurrence}
                  disabled={privacy.contentVisibility === "isolated"}
                  onChange={(changeEvent) =>
                    setPrivacy({ ...privacy, allowSharedOccurrence: changeEvent.target.checked })
                  }
                />
                允许共同经历邀请
              </label>
            </div>
            <div className="event-privacy-footer">
              <small>
                {privacy.discoveryEnabled
                  ? privacy.effectiveMatching
                    ? "这条事件当前可以生成最小化匿名匹配证据。"
                    : "这条事件当前不会参与匿名匹配。"
                  : "全局关系发现尚未开启，因此不会生成匹配证据。"}
              </small>
              <button
                className="text-button"
                type="button"
                disabled={busy}
                onClick={() => {
                  void onSavePrivacy(event, privacy).then((saved) => {
                    if (saved) setPrivacy(saved);
                  });
                }}
              >
                保存隐私设置
              </button>
            </div>
          </>
        ) : (
          <div className="privacy-loading">{privacyError ?? "正在读取隐私设置…"}</div>
        )}
      </section>
      <section className="event-relations-editor">
        <div className="structured-editor-heading">
          <div><strong>参与者、事物与定位</strong><small>确认后仍可修正图谱关系；保存后会生成新事件版本。</small></div>
          <button className="text-button" type="button" onClick={() => setParticipants((items) => [...items, { mention: "", role: "companion", isCurrentUser: false, confidence: 1 }])}>添加参与者</button>
        </div>
        <div className="event-relation-rows">
          {participants.map((participant, index) => (
            <div key={participant.existingParticipantId ?? `new-${index}`}>
              <input value={participant.mention} placeholder="称呼" onChange={(changeEvent) => setParticipants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, mention: changeEvent.target.value } : item))} />
              <input value={participant.role} placeholder="角色" onChange={(changeEvent) => setParticipants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, role: changeEvent.target.value } : item))} />
              {!participant.isCurrentUser ? <select value={participant.resolvedUserEntityId ?? ""} onChange={(changeEvent) => setParticipants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, resolvedUserEntityId: changeEvent.target.value || undefined } : item))}><option value="">自动识别</option>{entityMemory.filter((item) => item.entityType === "person").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select> : <span>当前用户</span>}
              <button className="text-button danger" type="button" onClick={() => setParticipants((items) => items.filter((_, itemIndex) => itemIndex !== index))}>删除</button>
            </div>
          ))}
        </div>
        <div className="structured-editor-heading entity-heading">
          <strong>事件实体</strong>
          <button className="text-button" type="button" onClick={() => setEntities((items) => [...items, { mention: "", entityType: "object", role: "object", confidence: 1, attributes: {} }])}>添加实体</button>
        </div>
        <div className="event-relation-rows">
          {entities.map((entity, index) => (
            <div key={`${entity.resolvedUserEntityId ?? "new"}-${index}`}>
              <input value={entity.mention} placeholder="名称" onChange={(changeEvent) => setEntities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, mention: changeEvent.target.value } : item))} />
              <input value={entity.entityType} placeholder="类型" onChange={(changeEvent) => setEntities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, entityType: changeEvent.target.value, resolvedUserEntityId: undefined } : item))} />
              <input value={entity.role} placeholder="关系" onChange={(changeEvent) => setEntities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, role: changeEvent.target.value } : item))} />
              <button className="text-button danger" type="button" onClick={() => setEntities((items) => items.filter((_, itemIndex) => itemIndex !== index))}>删除</button>
            </div>
          ))}
        </div>
        {event.location ? <label className="field"><span>定位关系</span><select value={locationRole} onChange={(changeEvent) => setLocationRole(changeEvent.target.value as typeof locationRole)}><option value="occurred_at">事情发生地</option><option value="recorded_at">仅记录地点</option><option value="none">解除定位关系</option></select></label> : null}
        <button className="secondary-button" type="button" disabled={busy || participants.some((item) => !item.mention.trim() || !item.role.trim()) || entities.some((item) => !item.mention.trim() || !item.entityType.trim() || !item.role.trim())} onClick={() => void onSaveRelations(event, {
          participants,
          entities,
          location: event.location && locationRole !== "none" ? { observationId: event.location.id, role: locationRole } : null,
        })}>保存图谱关系</button>
      </section>
      {confirmingDelete ? (
        <div className="event-delete-confirmation">
          <span>删除后会同步撤销共同经历、图谱和社交匹配证据；仅属于这条原始记录的附件也会清理。</span>
          <button type="button" className="text-button" onClick={() => setConfirmingDelete(false)}>取消删除</button>
          <button type="button" className="danger-button" disabled={busy} onClick={() => void onDelete(event)}>
            确认删除
          </button>
        </div>
      ) : (
        <div className="event-editor-actions">
          <button type="button" className="text-button danger" onClick={() => setConfirmingDelete(true)}>
            删除事件
          </button>
          <span />
          <button type="button" className="text-button" onClick={onCancel}>取消</button>
          <button type="submit" className="secondary-button" disabled={busy || !title.trim()}>
            {busy ? "正在保存…" : "保存修改"}
          </button>
        </div>
      )}
    </form>
  );
}

function WorkspaceApp({
  user,
  onLogout,
  onAccountDeleted,
}: {
  user: AuthUser;
  onLogout: () => Promise<void>;
  onAccountDeleted: () => void;
}) {
  const [view, setView] = useState<View>(() =>
    new URLSearchParams(window.location.search).get("view") === "drafts" ? "drafts" : "record",
  );
  const [text, setText] = useState("");
  const [additionalTexts, setAdditionalTexts] = useState<string[]>([]);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CandidateRecord[]>([]);
  const [sourceCandidates, setSourceCandidates] = useState<CandidateRecord[]>([]);
  const [rejectedCandidateIds, setRejectedCandidateIds] = useState<string[]>([]);
  const [draftAppendText, setDraftAppendText] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [timelineTotal, setTimelineTotal] = useState(0);
  const [timelinePage, setTimelinePage] = useState(1);
  const [timelineQuery, setTimelineQuery] = useState("");
  const [timelineEventType, setTimelineEventType] = useState("");
  const [timelineEntityId, setTimelineEntityId] = useState("");
  const [timelinePersonId, setTimelinePersonId] = useState("");
  const [timelinePlaceId, setTimelinePlaceId] = useState("");
  const [timelineFrom, setTimelineFrom] = useState("");
  const [timelineTo, setTimelineTo] = useState("");
  const [eventDetails, setEventDetails] = useState<Record<string, EventDetail>>({});
  const [graph, setGraph] = useState<PersonalGraph | null>(null);
  const [globalGraph, setGlobalGraph] = useState<GlobalGraph | null>(null);
  const [social, setSocial] = useState<SocialDiscovery | null>(null);
  const [sharedInvites, setSharedInvites] = useState<SharedParticipantInvite[]>([]);
  const [sharedOccurrences, setSharedOccurrences] = useState<SharedOccurrence[]>([]);
  const [entityMemory, setEntityMemory] = useState<EntityMemory[]>([]);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationPreferences, setNotificationPreferences] = useState<NotificationPreferences>({
    browserNotificationsEnabled: false,
    draftReminderDelayMinutes: 1440,
  });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [existingMediaAttachments, setExistingMediaAttachments] = useState<MediaAttachment[]>([]);
  const [persistedLocation, setPersistedLocation] = useState<LocationObservation | null>(null);
  const voice = useVoiceRecorder();
  const media = useMediaAttachments();
  const locationCapture = useLocationCapture();
  const notifyingIds = useRef(new Set<string>());

  const loadData = useCallback(async () => {
    const [draftResult, timelineResult, healthResult, graphResult, globalGraphResult, socialResult, inviteResult, occurrenceResult, notificationResult, entityResult] = await Promise.all([
      api.getDrafts(),
      api.getTimeline(),
      api.getHealth(),
      api.getGraph(),
      api.getGlobalGraph(),
      api.getSocial(),
      api.getSharedInvites(),
      api.getSharedOccurrences(),
      api.getNotifications(),
      api.getEntityMemory(),
    ]);
    setDrafts(draftResult.drafts);
    setTimeline(timelineResult.events);
    setTimelineTotal(timelineResult.total);
    setHealth(healthResult);
    setGraph(graphResult);
    setGlobalGraph(globalGraphResult);
    setSocial(socialResult);
    setSharedInvites(inviteResult.invites);
    setSharedOccurrences(occurrenceResult.occurrences);
    setNotifications(notificationResult.notifications);
    setNotificationPreferences(notificationResult.preferences);
    setEntityMemory(entityResult.entities);
  }, []);

  useEffect(() => {
    loadData().catch((error: Error) => setMessage(error.message));
  }, [loadData]);

  const loadNotificationsOnly = useCallback(async () => {
    const result = await api.getNotifications();
    setNotifications(result.notifications);
    setNotificationPreferences(result.preferences);
  }, []);

  async function loadTimelinePage(page: number) {
    setBusy(true);
    setMessage(null);
    try {
      const toExclusive = timelineTo
        ? new Date(new Date(`${timelineTo}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const result = await api.getTimeline({
        q: timelineQuery.trim() || undefined,
        eventType: timelineEventType || undefined,
        entityId: timelineEntityId || undefined,
        personId: timelinePersonId || undefined,
        placeId: timelinePlaceId || undefined,
        from: timelineFrom ? new Date(`${timelineFrom}T00:00:00`).toISOString() : undefined,
        to: toExclusive,
        page,
        limit: 30,
      });
      setTimeline(result.events);
      setTimelineTotal(result.total);
      setTimelinePage(result.page);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法筛选时间线");
    } finally {
      setBusy(false);
    }
  }

  async function toggleEventDetail(eventId: string) {
    if (eventDetails[eventId]) {
      setEventDetails((details) => {
        const next = { ...details };
        delete next[eventId];
        return next;
      });
      return;
    }
    try {
      const detail = await api.getEventDetail(eventId);
      setEventDetails((details) => ({ ...details, [eventId]: detail }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法读取事件来源");
    }
  }

  useEffect(() => {
    const timer = window.setInterval(() => {
      void loadNotificationsOnly().catch(() => undefined);
    }, 60_000);
    return () => window.clearInterval(timer);
  }, [loadNotificationsOnly]);

  useEffect(() => {
    if (
      !notificationPreferences.browserNotificationsEnabled ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    for (const notification of notifications.filter((item) => item.status === "pending")) {
      if (notifyingIds.current.has(notification.id)) continue;
      notifyingIds.current.add(notification.id);
      void (async () => {
        try {
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(notification.title, {
              body: notification.body,
              tag: `traceweave-${notification.id}`,
              data: { url: "/?view=drafts" },
            });
          } else {
            new Notification(notification.title, { body: notification.body });
          }
          await api.updateNotification(notification.id, "delivered");
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id ? { ...item, status: "delivered" } : item,
            ),
          );
        } catch {
          // The in-app notification remains available even if the browser blocks system delivery.
        } finally {
          notifyingIds.current.delete(notification.id);
        }
      })();
    }
  }, [notificationPreferences.browserNotificationsEnabled, notifications]);

  const draftCountLabel = useMemo(() => `${drafts.length}/30`, [drafts.length]);
  const unreadNotificationCount = useMemo(
    () => notifications.filter((notification) => notification.status !== "read").length,
    [notifications],
  );

  async function submitEntry() {
    const textBlocks = [text, ...additionalTexts].map((block) => block.trim()).filter(Boolean);
    const aggregateText = textBlocks.join("\n");
    if (!aggregateText || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const result = voice.audioBlob || media.items.length || textBlocks.length > 1
        ? await api.createMixedEntry({
            text: aggregateText,
            textBlocks,
            audio: voice.audioBlob
              ? {
                  blob: voice.audioBlob,
                  filename: voice.audioFilename,
                  durationMs: voice.durationMs,
                }
              : undefined,
            attachments: media.items.map((item) => ({ file: item.file, kind: item.kind })),
            transcriptProvider: voice.transcribedByBrowser ? "browser-web-speech" : "manual",
            location: locationCapture.location ?? undefined,
          })
        : await api.createEntry(aggregateText, locationCapture.location ?? undefined);
      setEntryId(result.entry.id);
      setPersistedLocation(result.location);
      const parsedCandidates = result.candidates.map((candidate) => ({
          ...candidate,
          parserProvider: candidate.parserProvider ?? result.parser.provider,
          parserModelVersion: candidate.parserModelVersion ?? result.parser.model,
          location: result.location
            ? {
                observationId: result.location.id,
                role: result.location.defaultEventRole,
              }
            : undefined,
        }));
      const preparedCandidates = prepareCandidates(parsedCandidates);
      setCandidates(preparedCandidates);
      setSourceCandidates(parsedCandidates);
      setRejectedCandidateIds([]);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "记录失败");
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!entryId || (!candidates.length && !rejectedCandidateIds.length) || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      await api.confirmEntry(entryId, candidates, rejectedCandidateIds);
      setText("");
      setAdditionalTexts([]);
      setEntryId(null);
      setCandidates([]);
      setSourceCandidates([]);
      setRejectedCandidateIds([]);
      setExistingMediaAttachments([]);
      setPersistedLocation(null);
      voice.reset();
      media.reset();
      locationCapture.reset();
      setMessage("已经正式记入你的生活流水");
      await loadData();
      setView("timeline");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "确认失败");
    } finally {
      setBusy(false);
    }
  }

  function resumeDraft(draft: Draft) {
    voice.reset();
    media.reset();
    setText(draft.text ?? "");
    setAdditionalTexts([]);
    setEntryId(draft.id);
    const draftSourceCandidates = draft.candidates.map((candidate) => ({
        ...candidate,
        location: draft.location
          ? {
              observationId: draft.location.id,
              role: draft.location.defaultEventRole,
            }
          : undefined,
      }));
    setCandidates(prepareCandidates(draftSourceCandidates));
    setSourceCandidates(draftSourceCandidates);
    setRejectedCandidateIds([]);
    setExistingMediaAttachments(draft.attachments);
    setPersistedLocation(draft.location);
    locationCapture.reset();
    setView("record");
    setMessage(null);
  }

  function splitCandidate(index: number) {
    setCandidates((current) => {
      const source = current[index];
      if (!source || current.length >= 20) return current;
      const clone: CandidateRecord = {
        ...source,
        resolutionId: crypto.randomUUID(),
        sourceCandidateIds: [...(source.sourceCandidateIds ?? [source.id])],
        payload: structuredClone(source.payload),
      };
      return [...current.slice(0, index + 1), clone, ...current.slice(index + 1)];
    });
  }

  function mergeCandidateWithPrevious(index: number) {
    if (index < 1) return;
    setCandidates((current) => {
      const previous = current[index - 1];
      const candidate = current[index];
      if (!previous || !candidate) return current;
      const merged: CandidateRecord = {
        ...previous,
        resolutionId: crypto.randomUUID(),
        sourceCandidateIds: [...new Set([
          ...(previous.sourceCandidateIds ?? [previous.id]),
          ...(candidate.sourceCandidateIds ?? [candidate.id]),
        ])],
        payload: mergeCandidatePayloads(previous.payload, candidate.payload),
        location: previous.location ?? candidate.location,
      };
      return [...current.slice(0, index - 1), merged, ...current.slice(index + 1)];
    });
  }

  function rejectCandidate(index: number) {
    setCandidates((current) => {
      const rejected = current[index];
      if (!rejected) return current;
      const next = current.filter((_, candidateIndex) => candidateIndex !== index);
      const stillUsed = new Set(next.flatMap((candidate) => candidate.sourceCandidateIds ?? [candidate.id]));
      const newlyRejected = (rejected.sourceCandidateIds ?? [rejected.id]).filter((id) => !stillUsed.has(id));
      if (newlyRejected.length) {
        setRejectedCandidateIds((ids) => [...new Set([...ids, ...newlyRejected])]);
      }
      return next;
    });
  }

  function restoreRejectedCandidate(sourceId: string) {
    const source = sourceCandidates.find((candidate) => candidate.id === sourceId);
    if (!source) return;
    setRejectedCandidateIds((ids) => ids.filter((id) => id !== sourceId));
    setCandidates((current) => [
      ...current,
      { ...source, resolutionId: crypto.randomUUID(), sourceCandidateIds: [source.id], payload: structuredClone(source.payload) },
    ]);
  }

  async function appendDraftTextBlock() {
    if (!entryId || !draftAppendText.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.appendDraftText(entryId, draftAppendText.trim());
      const sources = result.candidates.map((candidate) => ({
        ...candidate,
        parserProvider: candidate.parserProvider ?? result.parser.provider,
        parserModelVersion: candidate.parserModelVersion ?? result.parser.model,
        location: persistedLocation ? { observationId: persistedLocation.id, role: persistedLocation.defaultEventRole } : undefined,
      }));
      setText(result.entry.text);
      setDraftAppendText("");
      setSourceCandidates(sources);
      setCandidates(prepareCandidates(sources));
      setRejectedCandidateIds([]);
      setMessage("补充内容已经加入草稿，AI 已基于完整内容重新解析");
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法补充草稿内容");
    } finally {
      setBusy(false);
    }
  }

  async function deleteDraft(draftId: string) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deleteDraft(draftId);
      if (entryId === draftId) {
        setEntryId(null);
        setCandidates([]);
        setSourceCandidates([]);
        setRejectedCandidateIds([]);
        setAdditionalTexts([]);
        setExistingMediaAttachments([]);
        setPersistedLocation(null);
        voice.reset();
        media.reset();
        locationCapture.reset();
      }
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSocialDiscovery(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setSocial(await api.setSocialDiscovery(enabled));
      const [nextPersonalGraph, nextGlobalGraph] = await Promise.all([api.getGraph(), api.getGlobalGraph()]);
      setGraph(nextPersonalGraph);
      setGlobalGraph(nextGlobalGraph);
      setMessage(enabled ? "已经开启匿名关系发现" : "已经关闭关系发现并撤销匹配投影");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法更新关系发现设置");
    } finally {
      setBusy(false);
    }
  }

  async function decideSocialMatch(
    matchId: string,
    decision: "connect" | "dismiss" | "disconnect",
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      setSocial(await api.decideSocialMatch(matchId, decision));
      const [nextPersonalGraph, nextGlobalGraph] = await Promise.all([api.getGraph(), api.getGlobalGraph()]);
      setGraph(nextPersonalGraph);
      setGlobalGraph(nextGlobalGraph);
      setMessage(
        decision === "connect"
          ? "你的意愿已经保存；双方同意后才会显示身份"
          : decision === "disconnect"
            ? "连接已经断开"
            : "以后不会再推荐这条关系",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法处理关系操作");
    } finally {
      setBusy(false);
    }
  }

  async function inviteParticipantAccount(
    eventId: string,
    participantId: string,
    username: string,
  ): Promise<boolean> {
    if (busy) return false;
    setBusy(true);
    setMessage(null);
    try {
      await api.inviteEventParticipant(eventId, participantId, username);
      await loadData();
      setMessage("共同经历确认已经发送；对方接受前不会建立账户关系");
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法发送共同经历确认");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function decideSharedInvite(
    inviteId: string,
    decision: "accept" | "decline" | "revoke",
    options?: { linkedEventId?: string; permissions?: SharedFactPermissions },
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.decideSharedInvite(inviteId, decision, options);
      await loadData();
      setMessage(
        decision === "accept"
          ? "共同经历已确认，并进入双方的图谱"
          : decision === "decline"
            ? "已经拒绝共同经历确认"
            : "共同经历关联已经撤销",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法处理共同经历确认");
    } finally {
      setBusy(false);
    }
  }

  async function saveTimelineEvent(
    event: TimelineEvent,
    input: {
      title: string;
      eventType: string;
      factualStatus: string;
      occurredStart: string | null;
      occurredEnd: string | null;
    },
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.updateEvent(event.id, {
        expectedVersion: event.version,
        ...input,
        timePrecision: input.occurredStart ? "minute" : "unknown",
        timezone: event.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
        sourceTimeExpression: event.sourceTimeExpression,
      });
      setEditingEventId(null);
      await loadData();
      setMessage("事件修改已保存，相关图谱和共享关系已经同步刷新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "事件修改失败");
    } finally {
      setBusy(false);
    }
  }

  async function removeTimelineEvent(event: TimelineEvent) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.deleteEvent(event.id, event.version);
      setEditingEventId(null);
      await loadData();
      setMessage("事件及其派生图谱、共同经历和社交证据已经删除");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "事件删除失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveEventRelations(
    event: TimelineEvent,
    input: {
      participants: Array<import("./api").CandidateParticipant & { existingParticipantId?: string }>;
      entities: import("./api").CandidateEntity[];
      location: { observationId: string; role: "occurred_at" | "recorded_at" } | null;
    },
  ) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      await api.updateEventRelations(event.id, { expectedVersion: event.version, ...input });
      setEditingEventId(null);
      await loadData();
      setMessage("参与者、实体和定位关系已经更新，图谱与社交证据已重新计算");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "图谱关系修改失败");
    } finally {
      setBusy(false);
    }
  }

  async function saveEventPrivacy(
    event: TimelineEvent,
    privacy: EventPrivacySettings,
  ): Promise<EventPrivacySettings | null> {
    if (busy) return null;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api.setEventPrivacy(event.id, {
        expectedEventVersion: event.version,
        contentVisibility: privacy.contentVisibility,
        allowAnonymousStats: privacy.allowAnonymousStats,
        allowMatching: privacy.allowMatching,
        allowIdentityDisclosure: privacy.allowIdentityDisclosure,
        allowSharedOccurrence: privacy.allowSharedOccurrence,
      });
      await loadData();
      setMessage(
        saved.contentVisibility === "isolated"
          ? "事件已完全隔离，现有共同经历和匿名匹配证据已经撤销"
          : "事件级隐私设置已经生效",
      );
      return saved;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法保存隐私设置");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function enableBrowserNotifications() {
    if (busy) return;
    if (typeof Notification === "undefined") {
      setMessage("当前浏览器不支持系统通知，但应用内提醒仍然可用");
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Notification.requestPermission();
      let enabled = permission === "granted";
      if (enabled && "serviceWorker" in navigator) {
        const pushConfig = await api.getPushConfig();
        if (pushConfig.configured && pushConfig.publicKey) {
          const registration = await navigator.serviceWorker.ready;
          const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToBytes(pushConfig.publicKey),
          });
          await api.savePushSubscription(subscription.toJSON());
        } else {
          enabled = false;
          setMessage("服务器尚未配置 VAPID 密钥，暂时只能使用应用内提醒");
        }
      }
      const saved = await api.setNotificationPreferences({
        ...notificationPreferences,
        browserNotificationsEnabled: enabled,
      });
      setNotificationPreferences(saved);
      if (enabled) setMessage(
        enabled
          ? "离线系统通知已开启；即使网页关闭，草稿到期也会提醒"
          : "没有获得系统通知权限，仍会在应用内保留提醒",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法更新通知权限");
    } finally {
      setBusy(false);
    }
  }

  async function transcribeCurrentAudio() {
    if (!voice.audioBlob || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await api.transcribeAudio(voice.audioBlob, voice.audioFilename);
      setText(result.text);
      setMessage(`后端语音转写完成 · ${result.provider} / ${result.model}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "后端语音转写失败");
    } finally {
      setBusy(false);
    }
  }

  async function updateReminderDelay(minutes: number) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await api.setNotificationPreferences({
        ...notificationPreferences,
        draftReminderDelayMinutes: minutes,
      });
      setNotificationPreferences(saved);
      setMessage("草稿提醒时间已经更新，现有待确认草稿也会使用新设置");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法更新提醒时间");
    } finally {
      setBusy(false);
    }
  }

  async function handleNotification(
    notificationId: string,
    action: "read" | "dismiss",
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateNotification(notificationId, action);
      if (action === "dismiss") {
        setNotifications((current) => current.filter((item) => item.id !== notificationId));
      } else {
        setNotifications((current) =>
          current.map((item) => (item.id === notificationId ? { ...item, status: "read" } : item)),
        );
        setView("drafts");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法处理提醒");
    } finally {
      setBusy(false);
    }
  }

  const existingVoice = existingMediaAttachments.find((attachment) => attachment.kind === "voice") ?? null;
  const existingSupplementalMedia = existingMediaAttachments.filter(
    (attachment) => attachment.kind !== "voice",
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView("record")}>
          <span className="brand-mark">TW</span>
          <span>
            <strong>TraceWeave</strong>
            <small>把生活织成可以回看的脉络</small>
          </span>
        </button>

        <div className="topbar-actions">
          <nav aria-label="主要页面">
            <button className={view === "record" ? "active" : ""} onClick={() => setView("record")}>
              记录
            </button>
            <button className={view === "graph" ? "active" : ""} onClick={() => setView("graph")}>
              关系图
            </button>
            <button className={view === "drafts" ? "active" : ""} onClick={() => setView("drafts")}>
              待确认 <span className="count">{draftCountLabel}</span>
            </button>
            <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>
              时间线
            </button>
            <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>
              发现{(social?.matches.length ?? 0) + sharedInvites.length > 0 ? (
                <span className="count">{(social?.matches.length ?? 0) + sharedInvites.length}</span>
              ) : null}
            </button>
            <details className="nav-more">
              <summary className={["review", "memory", "privacy", "data", "notifications"].includes(view) ? "active" : ""}>
                更多{unreadNotificationCount ? <span className="count">{unreadNotificationCount}</span> : null}
              </summary>
              <div className="nav-more-menu">
                <button className={view === "review" ? "active" : ""} onClick={(event) => { setView("review"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>回顾与洞察</button>
                <button className={view === "memory" ? "active" : ""} onClick={(event) => { setView("memory"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>实体记忆</button>
                <button className={view === "notifications" ? "active" : ""} onClick={(event) => { setView("notifications"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>提醒{unreadNotificationCount ? <span className="count">{unreadNotificationCount}</span> : null}</button>
                <button className={view === "privacy" ? "active" : ""} onClick={(event) => { setView("privacy"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>隐私设置</button>
                <button className={view === "data" ? "active" : ""} onClick={(event) => { setView("data"); event.currentTarget.closest("details")?.removeAttribute("open"); }}>数据管理</button>
              </div>
            </details>
          </nav>
          <div className="account-menu">
            <span>
              <strong>{user.displayName}</strong>
              <small>@{user.username}</small>
            </span>
            <button type="button" onClick={() => void onLogout()}>退出</button>
          </div>
        </div>
      </header>

      <main className={view === "graph" ? "graph-main" : undefined}>
        {message ? <div className="message">{message}</div> : null}

        {view === "record" ? (
          <div className="record-layout">
            <section className="intro-panel">
              <span className="eyebrow">主动记录</span>
              <h1>刚刚发生了什么？</h1>
              <p>像和自己说话一样写下来。系统只理解你主动提交的内容，确认以后才会正式入账。</p>
              <div
                className={`ai-status ${health?.ai.configured ? "configured" : "not-configured"}`}
              >
                <span className="ai-status-dot" />
                {health?.ai.provider === "deepseek" && health.ai.configured
                  ? `DeepSeek 已连接 · ${health.ai.model}`
                  : health?.ai.provider === "mock"
                    ? "当前为开发规则模式，不是真实 AI"
                    : "DeepSeek Key 尚未配置"}
              </div>
              <div className="privacy-note">
                <span aria-hidden="true">◇</span>
                <div>
                  <strong>默认只对你可见</strong>
                  <small>未确认内容不会进入统计、图谱或关系匹配。</small>
                </div>
              </div>
            </section>

            <section className="record-panel">
              <div className="composer">
                <div className="input-mode-row">
                  <span>
                    {media.items.length || existingSupplementalMedia.length
                      ? "组合记录"
                      : voice.audioBlob || voice.phase === "recording" || existingVoice
                        ? "语音记录"
                        : "文字记录"}
                  </span>
                  <div className="voice-actions">
                    {voice.phase === "recording" ? (
                      <button className="recording-button" type="button" onClick={voice.stop}>
                        <span className="recording-dot" />
                        结束录音 {Math.floor(voice.durationMs / 1000)}s
                      </button>
                    ) : (
                      <button
                        className="voice-button"
                        type="button"
                        onClick={() => voice.start(setText, text)}
                        disabled={busy || Boolean(entryId) || !voice.recordingSupported}
                      >
                        <span aria-hidden="true">●</span>
                        {voice.audioBlob ? "重新录音" : "开始录音"}
                      </button>
                    )}
                    <label className={`upload-audio-button ${entryId ? "disabled" : ""}`}>
                      选择录音
                      <input
                        type="file"
                        accept="audio/*"
                        capture="user"
                        disabled={busy || Boolean(entryId) || voice.phase === "recording"}
                        onChange={(event) => {
                          const file = event.target.files?.[0];
                          if (file) voice.selectFile(file);
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <button
                      className="location-button"
                      type="button"
                      onClick={locationCapture.capture}
                      disabled={
                        busy ||
                        Boolean(entryId) ||
                        locationCapture.busy ||
                        !locationCapture.supported
                      }
                    >
                      <span aria-hidden="true">⌖</span>
                      {locationCapture.busy
                        ? "定位中…"
                        : locationCapture.location
                          ? "更新定位"
                          : "添加位置"}
                    </button>
                  </div>
                </div>
                <div className="attachment-action-row">
                  <div>
                    <strong>补充附件</strong>
                    <small>附件不会发送给 AI，只保存为这条生活记录的原始证据。</small>
                  </div>
                  <div className="attachment-buttons">
                    <label className={entryId ? "disabled" : ""}>
                      照片 / 相册
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={busy || Boolean(entryId)}
                        onChange={(event) => {
                          if (event.target.files) media.add(event.target.files, "image");
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <label className={entryId ? "disabled" : ""}>
                      截图
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={busy || Boolean(entryId)}
                        onChange={(event) => {
                          if (event.target.files) media.add(event.target.files, "screenshot");
                          event.target.value = "";
                        }}
                      />
                    </label>
                    <label className={entryId ? "disabled" : ""}>
                      视频
                      <input
                        type="file"
                        accept="video/*"
                        multiple
                        disabled={busy || Boolean(entryId)}
                        onChange={(event) => {
                          if (event.target.files) media.add(event.target.files, "video");
                          event.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <textarea
                  aria-label="生活记录"
                  placeholder={
                    voice.phase === "recording"
                      ? "正在转写，也可以等录音结束后手动修订……"
                      : "例如：今天中午我和小王在商店 A 花了 8 元吃了两个猪肉包子……"
                  }
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  disabled={Boolean(entryId)}
                  rows={6}
                />
                <div className="text-block-editor">
                  {additionalTexts.map((block, index) => (
                    <div className="text-block" key={index}>
                      <div><strong>文字段 {index + 2}</strong><small>AI 会按当前顺序与第一段一起理解。</small></div>
                      <textarea value={block} rows={3} disabled={Boolean(entryId)} onChange={(event) => setAdditionalTexts((items) => items.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                      <div>
                        <button className="text-button" type="button" disabled={index === 0} onClick={() => setAdditionalTexts((items) => { const next = [...items]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>前移</button>
                        <button className="text-button" type="button" disabled={index === additionalTexts.length - 1} onClick={() => setAdditionalTexts((items) => { const next = [...items]; [next[index], next[index + 1]] = [next[index + 1], next[index]]; return next; })}>后移</button>
                        <button className="text-button danger" type="button" onClick={() => setAdditionalTexts((items) => items.filter((_, itemIndex) => itemIndex !== index))}>删除</button>
                      </div>
                    </div>
                  ))}
                  {!entryId ? <button className="text-button add-text-block" type="button" disabled={additionalTexts.length >= 19} onClick={() => setAdditionalTexts((items) => [...items, ""])}>＋ 添加一段文字</button> : null}
                </div>
                {voice.audioUrl || existingVoice ? (
                  <div className="audio-preview">
                    <div>
                      <strong>原始录音</strong>
                      <small>确认前可反复播放；DeepSeek 只接收上方转写文字。</small>
                    </div>
                    <audio
                      controls
                      preload="metadata"
                      src={
                        voice.audioUrl ??
                        existingVoice?.url ??
                        (existingVoice ? `/api/media/${existingVoice.id}` : undefined)
                      }
                    />
                    {!entryId && voice.audioUrl ? (
                      <div className="audio-preview-actions">
                        <button className="text-button" type="button" disabled={busy} onClick={() => void transcribeCurrentAudio()}>后端转写</button>
                        <button className="text-button danger" type="button" onClick={voice.reset}>移除</button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <PendingMediaGallery attachments={media.items} onRemove={media.remove} onMove={media.move} />
                <StoredMediaGallery attachments={existingSupplementalMedia} />
                {voice.error ? <div className="voice-message">{voice.error}</div> : null}
                {media.error ? <div className="voice-message">{media.error}</div> : null}
                {locationCapture.location || persistedLocation ? (
                  <div className="location-card">
                    <div className="location-card-heading">
                      <div>
                        <strong>已附加位置</strong>
                        <small>
                          {(locationCapture.location ?? persistedLocation)!.latitude.toFixed(5)}, {" "}
                          {(locationCapture.location ?? persistedLocation)!.longitude.toFixed(5)}
                          {(locationCapture.location ?? persistedLocation)!.accuracyM !== null
                            ? ` · 精度约 ${Math.round((locationCapture.location ?? persistedLocation)!.accuracyM!)} 米`
                            : ""}
                        </small>
                      </div>
                      {!entryId ? (
                        <button
                          className="text-button danger"
                          type="button"
                          onClick={locationCapture.reset}
                        >
                          移除
                        </button>
                      ) : null}
                    </div>
                    {!entryId && locationCapture.location ? (
                      <>
                        <input
                          aria-label="地点名称"
                          placeholder="给这个位置起个名字，例如：商店 A、公司"
                          value={locationCapture.location.label ?? ""}
                          onChange={(event) =>
                            locationCapture.update({ label: event.target.value || null })
                          }
                        />
                        <div className="location-options">
                          <label>
                            <span>默认关联方式</span>
                            <select
                              value={locationCapture.location.defaultEventRole}
                              onChange={(event) =>
                                locationCapture.update({
                                  defaultEventRole: event.target.value as
                                    | "occurred_at"
                                    | "recorded_at",
                                  socialMatching:
                                    event.target.value === "occurred_at"
                                      ? locationCapture.location?.socialMatching
                                      : false,
                                })
                              }
                            >
                              <option value="occurred_at">事情发生在这里</option>
                              <option value="recorded_at">只是在这里记录</option>
                            </select>
                          </label>
                          <label className="location-consent">
                            <input
                              type="checkbox"
                              checked={locationCapture.location.socialMatching}
                              disabled={locationCapture.location.defaultEventRole !== "occurred_at"}
                              onChange={(event) =>
                                locationCapture.update({ socialMatching: event.target.checked })
                              }
                            />
                            <span>
                              允许匿名地点匹配
                              <small>只使用约 1 公里范围，不公开精确坐标</small>
                            </span>
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className="saved-location-label">
                        {(persistedLocation?.label || "未命名位置") +
                          (persistedLocation?.socialMatching ? " · 已允许匿名粗粒度匹配" : " · 仅私密保存")}
                      </div>
                    )}
                  </div>
                ) : null}
                {locationCapture.error ? (
                  <div className="location-message">{locationCapture.error}</div>
                ) : null}
                <div className="composer-footer">
                  <span>
                    {[text, ...additionalTexts].reduce((count, block) => count + block.length, 0).toLocaleString()} 字 · {1 + additionalTexts.length + (voice.audioBlob ? 1 : 0) + media.items.length} 个内容块
                    {voice.audioBlob ? ` · 录音 ${Math.max(1, Math.round(voice.durationMs / 1000))} 秒` : ""}
                    {media.items.length ? ` · ${media.items.length} 个附件` : ""}
                  </span>
                  <button
                    className="primary-button"
                    type="button"
                    onClick={submitEntry}
                    disabled={
                      ![text, ...additionalTexts].some((block) => block.trim()) ||
                      busy ||
                      Boolean(entryId) ||
                      voice.phase === "recording"
                    }
                  >
                    {busy && !entryId ? "正在理解…" : "解析这条记录"}
                  </button>
                </div>
              </div>

              {candidates.map((candidate, index) => (
                <CandidateEditor
                  key={candidate.resolutionId ?? candidate.id}
                  candidate={candidate}
                  index={index}
                  canMergePrevious={index > 0}
                  location={persistedLocation}
                  entityMemory={entityMemory}
                  onSplit={() => splitCandidate(index)}
                  onMergePrevious={() => mergeCandidateWithPrevious(index)}
                  onReject={() => rejectCandidate(index)}
                  onChange={(next) =>
                    setCandidates((current) => current.map((item, itemIndex) => (itemIndex === index ? next : item)))
                  }
                />
              ))}

              {rejectedCandidateIds.length ? (
                <section className="rejected-candidates-card">
                  <div>
                    <span className="eyebrow">不会入账</span>
                    <strong>已拒绝 {rejectedCandidateIds.length} 个 AI 候选</strong>
                  </div>
                  <div className="rejected-candidate-list">
                    {rejectedCandidateIds.map((sourceId) => {
                      const source = sourceCandidates.find((candidate) => candidate.id === sourceId);
                      return (
                        <button className="text-button" type="button" key={sourceId} onClick={() => restoreRejectedCandidate(sourceId)}>
                          恢复“{source?.payload.title ?? "候选事件"}”
                        </button>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {entryId ? (
                <section className="draft-append-card">
                  <div><strong>还想补充一段？</strong><small>追加内容会保留原草稿，并用全部文字重新生成候选事件。</small></div>
                  <textarea rows={2} value={draftAppendText} placeholder="补充遗漏的人、地点、金额或另一件事……" onChange={(event) => setDraftAppendText(event.target.value)} />
                  <button className="secondary-button" type="button" disabled={busy || !draftAppendText.trim()} onClick={() => void appendDraftTextBlock()}>追加并重新解析</button>
                </section>
              ) : null}

              {entryId ? (
                <div className="confirmation-actions">
                  <button className="secondary-button" type="button" onClick={() => setView("drafts")}>
                    稍后处理
                  </button>
                  <button className="primary-button" type="button" disabled={busy} onClick={confirm}>
                    {busy ? "正在处理…" : candidates.length ? `确认并入账 ${candidates.length} 件` : "确认不记录这些事件"}
                  </button>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}

        {view === "drafts" ? (
          <section className="list-page">
            <div className="page-heading">
              <div>
                <span className="eyebrow">确认之后才算数</span>
                <h1>待确认草稿</h1>
              </div>
              <span className="large-count">{draftCountLabel}</span>
            </div>
            <div className="card-list">
              {drafts.map((draft) => (
                <article className="list-card" key={draft.id}>
                  <div>
                    <time>{formatDate(draft.createdAt)}</time>
                    <h2>{draft.text || "语音或附件记录"}</h2>
                    {draft.location ? (
                      <div className="draft-location">
                        ⌖ {draft.location.label || "已附加位置"}
                        {draft.location.accuracyM !== null
                          ? ` · 精度约 ${Math.round(draft.location.accuracyM)} 米`
                          : ""}
                      </div>
                    ) : null}
                    <StoredMediaGallery attachments={draft.attachments} compact />
                    <p>{draft.status === "failed" ? "解析失败，可以稍后重试" : "等待你确认 AI 的理解"}</p>
                  </div>
                  <div className="list-actions">
                    <button className="text-button danger" onClick={() => deleteDraft(draft.id)}>
                      删除
                    </button>
                    <button className="secondary-button" onClick={() => resumeDraft(draft)} disabled={!draft.candidates.length}>
                      继续确认
                    </button>
                  </div>
                </article>
              ))}
              {!drafts.length ? <div className="empty-state">没有待确认记录。现在记下刚刚发生的事吧。</div> : null}
            </div>
          </section>
        ) : null}

        {view === "notifications" ? (
          <section className="list-page notification-page">
            <div className="page-heading">
              <div>
                <span className="eyebrow">到期以后再提醒你</span>
                <h1>草稿提醒</h1>
              </div>
              <span className="large-count">{unreadNotificationCount} 条未读</span>
            </div>
            <div className="notification-settings-card">
              <div>
                <strong>浏览器系统通知</strong>
                <small>只有点击开启后才会申请权限；不开启也能在这里看到应用内提醒。</small>
              </div>
              <button
                type="button"
                className="secondary-button"
                disabled={busy || notificationPreferences.browserNotificationsEnabled}
                onClick={() => void enableBrowserNotifications()}
              >
                {notificationPreferences.browserNotificationsEnabled ? "已开启" : "开启系统通知"}
              </button>
              <label>
                <span>草稿多久后提醒</span>
                <select
                  value={notificationPreferences.draftReminderDelayMinutes}
                  disabled={busy}
                  onChange={(changeEvent) => void updateReminderDelay(Number(changeEvent.target.value))}
                >
                  <option value={60}>1 小时</option>
                  <option value={360}>6 小时</option>
                  <option value={1440}>24 小时</option>
                  <option value={4320}>3 天</option>
                  <option value={10080}>7 天</option>
                </select>
              </label>
            </div>
            <div className="card-list notification-list">
              {notifications.map((notification) => (
                <article className={`list-card notification-card ${notification.status}`} key={notification.id}>
                  <div>
                    <time>{formatDate(notification.createdAt)}</time>
                    <h2>{notification.title}</h2>
                    <p>{notification.body}</p>
                  </div>
                  <div className="list-actions">
                    <button
                      type="button"
                      className="text-button danger"
                      disabled={busy}
                      onClick={() => void handleNotification(notification.id, "dismiss")}
                    >
                      忽略
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => void handleNotification(notification.id, "read")}
                    >
                      去处理草稿
                    </button>
                  </div>
                </article>
              ))}
              {!notifications.length ? (
                <div className="empty-state">没有到期提醒。待确认草稿会按你设置的时间出现在这里。</div>
              ) : null}
            </div>
          </section>
        ) : null}

        {view === "timeline" ? (
          <section className="list-page timeline-page">
            <div className="page-heading">
              <div>
                <span className="eyebrow">已经确认的生活</span>
                <h1>时间线</h1>
              </div>
              <span className="large-count">{timelineTotal} 件事</span>
            </div>
            <form className="timeline-filters" onSubmit={(event) => { event.preventDefault(); void loadTimelinePage(1); }}>
              <label className="field field-wide"><span>搜索事件、原文、人物或事物</span><input value={timelineQuery} placeholder="例如：包子、王哥、美团" onChange={(event) => setTimelineQuery(event.target.value)} /></label>
              <label className="field"><span>活动类型</span><select value={timelineEventType} onChange={(event) => setTimelineEventType(event.target.value)}><option value="">全部</option>{Object.entries(eventTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="field"><span>任意实体</span><select value={timelineEntityId} onChange={(event) => setTimelineEntityId(event.target.value)}><option value="">全部</option>{entityMemory.filter((item) => item.entityType !== "person" && item.entityType !== "place").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              <label className="field"><span>人物</span><select value={timelinePersonId} onChange={(event) => setTimelinePersonId(event.target.value)}><option value="">全部</option>{entityMemory.filter((item) => item.entityType === "person").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              <label className="field"><span>地点</span><select value={timelinePlaceId} onChange={(event) => setTimelinePlaceId(event.target.value)}><option value="">全部</option>{entityMemory.filter((item) => item.entityType === "place").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
              <label className="field"><span>开始日期</span><input type="date" value={timelineFrom} onChange={(event) => setTimelineFrom(event.target.value)} /></label>
              <label className="field"><span>结束日期</span><input type="date" value={timelineTo} onChange={(event) => setTimelineTo(event.target.value)} /></label>
              <button className="secondary-button" type="submit" disabled={busy}>筛选</button>
            </form>
            <div className="timeline">
              {timeline.map((event) => (
                <article className="timeline-item" key={event.id}>
                  <div className="timeline-dot" />
                  <div className="timeline-card">
                    <div className="timeline-meta">
                      <span>
                        {eventTypeLabels[event.eventType] ?? event.eventType}
                        {!event.isOwned ? ` · ${event.owner.displayName} 分享的共同经历` : ""}
                      </span>
                      <time>
                        {event.isOwned
                          ? formatDate(event.occurredStart ?? event.createdAt)
                          : formatDay(event.occurredStart ?? event.createdAt)}
                      </time>
                    </div>
                    <h2>{event.title}</h2>
                    {event.isOwned && editingEventId !== event.id ? (
                      <div className="timeline-card-actions">
                        <button type="button" className="timeline-edit-button" onClick={() => void toggleEventDetail(event.id)}>来源与版本</button>
                        <button type="button" className="timeline-edit-button" onClick={() => setEditingEventId(event.id)}>编辑事件</button>
                      </div>
                    ) : null}
                    {event.participants.length ? (
                      <div className="timeline-participants">
                        <span>参与者</span>
                        <div>
                          {event.participants.map((participant) => (
                            <ParticipantLinkControl
                              key={participant.id}
                              eventId={event.id}
                              participant={participant}
                              busy={busy}
                              onInvite={inviteParticipantAccount}
                              onRevoke={(inviteId) => decideSharedInvite(inviteId, "revoke")}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                    <div className="entity-list">
                      {event.entities.map((entity) => (
                        <span className="entity-chip" key={`${event.id}-${entity.id}-${entity.role}`}>
                          {entity.name}
                          <small>{entity.role}</small>
                        </span>
                      ))}
                    </div>
                    {event.location ? (
                      <div className="timeline-location">
                        ⌖ {event.location.label || "已附加位置"}
                        <small>
                          {event.location.role === "occurred_at" ? "事情发生地" : "记录时位置"}
                        </small>
                      </div>
                    ) : null}
                    {event.isOwned ? (
                      <StoredMediaGallery attachments={event.attachments} compact />
                    ) : null}
                    {event.isOwned && editingEventId === event.id ? (
                      <TimelineEventEditor
                        key={`${event.id}-${event.version}`}
                        event={event}
                        busy={busy}
                        onCancel={() => setEditingEventId(null)}
                        onSave={saveTimelineEvent}
                        onDelete={removeTimelineEvent}
                        onSavePrivacy={saveEventPrivacy}
                        entityMemory={entityMemory}
                        onSaveRelations={saveEventRelations}
                      />
                    ) : null}
                    {event.isOwned && eventDetails[event.id] ? (
                      <EventProvenancePanel detail={eventDetails[event.id]} onClose={() => void toggleEventDetail(event.id)} />
                    ) : null}
                  </div>
                </article>
              ))}
              {!timeline.length ? <div className="empty-state">确认第一条记录后，生活时间线会从这里开始。</div> : null}
            </div>
            {timelineTotal > 30 ? (
              <div className="timeline-pagination">
                <button className="secondary-button" type="button" disabled={busy || timelinePage <= 1} onClick={() => void loadTimelinePage(timelinePage - 1)}>上一页</button>
                <span>第 {timelinePage} / {Math.ceil(timelineTotal / 30)} 页</span>
                <button className="secondary-button" type="button" disabled={busy || timelinePage * 30 >= timelineTotal} onClick={() => void loadTimelinePage(timelinePage + 1)}>下一页</button>
              </div>
            ) : null}
          </section>
        ) : null}

        {view === "review" ? <ReviewView /> : null}

        {view === "graph" && graph && globalGraph ? <GraphView personal={graph} global={globalGraph} /> : null}

        {view === "discover" && social ? (
          <SocialDiscoveryView
            data={social}
            sharedInvites={sharedInvites}
            sharedOccurrences={sharedOccurrences}
            busy={busy}
            onToggle={(enabled) => void toggleSocialDiscovery(enabled)}
            onDecision={(matchId, decision) => void decideSocialMatch(matchId, decision)}
            onSharedInviteDecision={(inviteId, decision) => void decideSharedInvite(inviteId, decision)}
            onSharedInviteDecisionWithOptions={(inviteId, decision, options) => void decideSharedInvite(inviteId, decision, options)}
            onOccurrencePermissions={async (occurrenceId, permissions) => {
              setBusy(true);
              try {
                await api.updateSharedOccurrencePermissions(occurrenceId, permissions);
                await loadData();
              } catch (error) {
                setMessage(error instanceof Error ? error.message : "无法更新共同经历权限");
              } finally {
                setBusy(false);
              }
            }}
            onSafetyChanged={() => void loadData()}
          />
        ) : null}

        {view === "privacy" ? <PrivacySettingsView /> : null}

        {view === "memory" ? <EntityMemoryView entities={entityMemory} onChanged={setEntityMemory} /> : null}

        {view === "data" ? <DataGovernanceView user={user} onAccountDeleted={onAccountDeleted} /> : null}
      </main>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined);
  const [startupError, setStartupError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMe()
      .then((result) => setUser(result.user))
      .catch((error) => {
        if (error instanceof ApiError && error.status === 401) {
          setUser(null);
          return;
        }
        setStartupError(error instanceof Error ? error.message : "无法连接服务");
        setUser(null);
      });
  }, []);

  if (user === undefined) {
    return <div className="app-loading">正在打开你的生活账本…</div>;
  }

  if (!user) {
    return (
      <>
        {startupError ? <div className="startup-error">{startupError}</div> : null}
        <AuthScreen
          onAuthenticated={(authenticatedUser) => {
            setStartupError(null);
            setUser(authenticatedUser);
          }}
        />
      </>
    );
  }

  return (
    <WorkspaceApp
      user={user}
      onLogout={async () => {
        await api.logout();
        setUser(null);
      }}
      onAccountDeleted={() => setUser(null)}
    />
  );
}
