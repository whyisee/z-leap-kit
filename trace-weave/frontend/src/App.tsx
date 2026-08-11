import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  api,
  type AppNotification,
  type AuthUser,
  type CandidateRecord,
  type CandidateEntity,
  type CandidateParticipant,
  type ContactOverview,
  type Draft,
  type EntityMemory,
  type EventDetail,
  type EventPrivacySettings,
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
import { ContactsView } from "./ContactsView";
import { EntityMemoryView } from "./EntityMemoryView";
import { GraphView } from "./GraphView";
import { PendingMediaGallery, StoredMediaGallery } from "./MediaGallery";
import { ReviewView } from "./ReviewView";
import { SocialDiscoveryView } from "./SocialDiscoveryView";
import { SettingsView } from "./SettingsView";
import { useLocationCapture } from "./useLocationCapture";
import { useMediaAttachments } from "./useMediaAttachments";
import { useVoiceRecorder } from "./useVoiceRecorder";
import { mergeCandidatePayloads, prepareCandidates } from "./candidate-resolution";
import "./styles.css";

type View = "record" | "drafts" | "timeline" | "review" | "graph" | "discover" | "memory" | "notifications" | "settings" | "contacts";

function initialView(): View {
  const requested = new URLSearchParams(window.location.search).get("view");
  return requested && ["record", "drafts", "timeline", "review", "graph", "discover", "memory", "notifications", "settings", "contacts"].includes(requested)
    ? requested as View
    : "record";
}

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
  browse: "浏览",
  digital_activity: "数字生活",
  use_app: "使用应用",
  order_food: "点外卖",
  social: "社交",
  work: "工作",
  study: "学习",
  exercise: "运动",
  travel: "出行",
  commute: "通勤",
  sleep: "睡眠",
};

const entityTypeLabels: Record<string, string> = {
  person: "人物",
  place: "地点或场所",
  location: "坐标位置",
  food: "食物",
  drink: "饮品",
  app: "应用",
  platform: "平台",
  video: "视频",
  content: "内容",
  game: "游戏",
  book: "书籍",
  song: "歌曲",
  music: "音乐",
  movie: "影视",
  product: "商品",
  store: "商店",
  restaurant: "餐饮场所",
  organization: "组织",
  topic: "主题",
  activity: "活动",
  transport: "交通工具",
  device: "设备",
  object: "事物",
};

const participantRoleLabels: Record<string, string> = {
  actor: "主要参与者",
  companion: "同行人",
  subject: "当事人",
  organizer: "组织者",
  attendee: "参与者",
  creator: "创作者",
  owner: "所有者",
  sender: "发送者",
  recipient: "接收者",
  mentioned: "被提及的人",
};

const entityRoleLabels: Record<string, string> = {
  object: "涉及内容",
  content: "内容",
  platform: "使用平台",
  place: "涉及地点",
  occurred_at: "事情发生地",
  recorded_at: "记录地点",
  consumed: "食用或消费",
  drank: "饮用",
  listened_to: "收听",
  watched: "观看",
  played: "游玩",
  read: "阅读",
  purchased: "购买",
  visited: "到访",
  used: "使用",
  ordered: "下单",
  paid_for: "支付对象",
  topic: "相关主题",
  source: "来源",
  target: "目标",
};

const timePrecisionLabels: Record<string, string> = {
  minute: "精确到分钟",
  hour: "精确到小时",
  day: "精确到日期",
  week: "精确到周",
  month: "精确到月份",
  year: "精确到年份",
  approximate: "大约时间",
  inferred_recording_time: "根据记录时间推断",
  unknown: "时间未知",
};

const timezoneLabels: Record<string, string> = {
  "": "自动使用记录时区",
  "Asia/Shanghai": "中国标准时间（上海）",
  "Asia/Hong_Kong": "中国标准时间（香港）",
  "Asia/Taipei": "台北时间",
  "Asia/Tokyo": "日本标准时间",
  "Europe/London": "伦敦时间",
  "America/Los_Angeles": "北美太平洋时间",
  "America/New_York": "北美东部时间",
  UTC: "协调世界时",
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

function formatTimelineAxisDay(value: string | null, utc = false): string {
  if (!value) return "未知";
  const date = new Date(value);
  const month = utc ? date.getUTCMonth() + 1 : date.getMonth() + 1;
  const day = utc ? date.getUTCDate() : date.getDate();
  return `${month}月${day}日`;
}

function formatTimelineAxisClock(value: string | null): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
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

function candidateTimeLabel(candidate: CandidateRecord): string {
  const expression = candidate.payload.time.sourceExpression?.trim();
  if (expression) return expression;
  const start = candidate.payload.time.start;
  if (!start) return "时间未识别";
  const includeTime = ["minute", "hour", "approximate"].includes(candidate.payload.time.precision);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(start));
}

function candidateEntityTypeLabel(entity: CandidateEntity): string {
  if (entity.entityType === "object" && /视频|短片|直播/.test(entity.mention)) return "视频";
  if (entity.entityType === "object" && /歌|音乐|播客/.test(entity.mention)) return "音频";
  return entityTypeLabels[entity.entityType] ?? "事物";
}

function codeLabel(labels: Record<string, string>, value: string, fallback: string): string {
  return labels[value] ?? fallback;
}

function accountLedgerDay(createdAt: string | undefined): number {
  if (!createdAt) return 1;
  const created = new Date(createdAt);
  if (Number.isNaN(created.getTime())) return 1;
  const today = new Date();
  const createdDay = new Date(created.getFullYear(), created.getMonth(), created.getDate()).getTime();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.max(1, Math.floor((todayStart - createdDay) / 86_400_000) + 1);
}

function urlBase64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - value.length % 4) % 4);
  const binary = atob((value + padding).replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function CodeSelect({
  value,
  labels,
  onChange,
  unknownLabel = "其他（保留原值）",
}: {
  value: string;
  labels: Record<string, string>;
  onChange: (value: string) => void;
  unknownLabel?: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)}>
      {!Object.prototype.hasOwnProperty.call(labels, value) ? <option value={value}>{unknownLabel}</option> : null}
      {Object.entries(labels).map(([optionValue, label]) => (
        <option key={optionValue || "empty"} value={optionValue}>{label}</option>
      ))}
    </select>
  );
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
  const [editingSummary, setEditingSummary] = useState(false);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const updatePayload = (patch: Partial<CandidateRecord["payload"]>) =>
    onChange({ ...candidate, payload: { ...candidate.payload, ...patch } });
  const openDetails = () => {
    if (detailsRef.current) detailsRef.current.open = true;
  };
  const visibleParticipants = candidate.payload.participants.filter((participant) => !participant.isCurrentUser);
  const visibleEntities = candidate.payload.entities.slice(0, 6);
  const remainingEntities = candidate.payload.entities.length - visibleEntities.length;
  const needsReview = candidate.payload.confidence < 0.72;

  return (
    <section className="candidate-card candidate-card-compact">
      <div className="candidate-compact-heading">
        <div>
          <span className="eyebrow">
            {candidate.parserProvider === "deepseek"
              ? "AI 已整理"
              : "系统已整理"}
          </span>
          <small>第 {index + 1} 件 · {needsReview ? "有不确定内容，建议看一眼" : "确认理解无误即可入账"}</small>
        </div>
        <button className="text-button danger" type="button" onClick={onReject}>不记录这件事</button>
      </div>

      <div className="candidate-summary-card">
        <div className="candidate-summary-meta">
          <button type="button" className="candidate-summary-chip time" onClick={openDetails}>
            {candidateTimeLabel(candidate)}
          </button>
          <button type="button" className="candidate-summary-chip" onClick={openDetails}>
            {eventTypeLabels[candidate.payload.eventType] ?? "生活事件"}
          </button>
          {candidate.payload.factualStatus !== "occurred" ? (
            <button type="button" className="candidate-summary-chip muted" onClick={openDetails}>
              {factualStatusLabels[candidate.payload.factualStatus] ?? candidate.payload.factualStatus}
            </button>
          ) : null}
        </div>

        {editingSummary ? (
          <div className="candidate-summary-edit">
            <textarea
              aria-label="事件摘要"
              value={candidate.payload.title}
              onChange={(event) => updatePayload({ title: event.target.value })}
              rows={2}
              autoFocus
            />
            <button className="secondary-button" type="button" onClick={() => setEditingSummary(false)}>完成</button>
          </div>
        ) : (
          <button className="candidate-summary-title" type="button" onClick={() => setEditingSummary(true)}>
            {candidate.payload.title}
          </button>
        )}

        {visibleParticipants.length || visibleEntities.length || location ? (
          <div className="candidate-summary-relations" aria-label="识别出的关系">
            {visibleParticipants.map((participant, participantIndex) => (
              <button type="button" onClick={openDetails} key={`summary-participant-${participantIndex}`}>
                <span>人物</span>{participant.mention}
              </button>
            ))}
            {visibleEntities.map((entity, entityIndex) => (
              <button type="button" onClick={openDetails} key={`summary-entity-${entityIndex}`}>
                <span>{candidateEntityTypeLabel(entity)}</span>{entity.mention}
              </button>
            ))}
            {remainingEntities > 0 ? <button type="button" onClick={openDetails}>还有 {remainingEntities} 项</button> : null}
            {location ? <button type="button" onClick={openDetails}><span>位置</span>{location.label || "已附加位置"}</button> : null}
          </div>
        ) : null}

        <div className="candidate-summary-actions">
          <button className="text-button" type="button" onClick={() => setEditingSummary(true)}>修改描述</button>
          <button className="text-button" type="button" onClick={openDetails}>修改时间、人物等详细信息</button>
        </div>
      </div>

      <details className="candidate-details" ref={detailsRef}>
        <summary>
          <span>展开详细信息</span>
          <small>类型、时间、人物、事物、数量和定位</small>
        </summary>
        <div className="candidate-details-body">
          <div className="candidate-advanced-heading">
            <div>
              <strong>完整结构</strong>
              <small>{candidate.parserProvider === "deepseek" ? `由 ${candidate.parserModelVersion ?? "AI"} 解析` : "由开发规则解析"} · 置信度 {Math.round(candidate.payload.confidence * 100)}%</small>
            </div>
            <div className="candidate-resolution-actions">
              <button className="text-button" type="button" onClick={onSplit}>拆成两件</button>
              {canMergePrevious ? <button className="text-button" type="button" onClick={onMergePrevious}>并入上一件</button> : null}
            </div>
          </div>

      <div className="field-grid">
        <label className="field">
          <span>活动类型</span>
          <CodeSelect
            value={candidate.payload.eventType}
            labels={eventTypeLabels}
            unknownLabel="其他活动（保留原值）"
            onChange={(value) => updatePayload({ eventType: value })}
          />
        </label>

        <label className="field">
          <span>事实状态</span>
          <CodeSelect
            value={candidate.payload.factualStatus}
            labels={factualStatusLabels}
            onChange={(value) =>
              updatePayload({
                factualStatus: value as CandidateRecord["payload"]["factualStatus"],
              })
            }
          />
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
          <CodeSelect
            value={candidate.payload.time.precision}
            labels={timePrecisionLabels}
            unknownLabel="其他时间精度（保留原值）"
            onChange={(value) => updatePayload({ time: { ...candidate.payload.time, precision: value } })}
          />
        </label>
        <label className="field">
          <span>时区</span>
          <CodeSelect
            value={candidate.payload.time.timezone ?? ""}
            labels={timezoneLabels}
            unknownLabel="其他时区（保留原值）"
            onChange={(value) => updatePayload({ time: { ...candidate.payload.time, timezone: value || null } })}
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
                <CodeSelect
                  value={participant.role}
                  labels={participantRoleLabels}
                  unknownLabel="其他人物角色（保留原值）"
                  onChange={(value) => {
                    const participants = [...candidate.payload.participants];
                    participants[index] = { ...participant, role: value };
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
                  <label className="field"><span>类型</span><CodeSelect value={entity.entityType} labels={entityTypeLabels} unknownLabel="其他实体类型（保留原值）" onChange={(value) => updateEntity({ entityType: value, resolvedUserEntityId: undefined })} /></label>
                  <label className="field">
                    <span>长期实体</span>
                    <select value={entity.resolvedUserEntityId ?? ""} onChange={(event) => updateEntity({ resolvedUserEntityId: event.target.value || undefined })}>
                      <option value="">按名称/别名自动识别</option>
                      {entityMemory.filter((item) => item.entityType === entity.entityType).map((item) => (
                        <option key={item.id} value={item.id}>{item.displayName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="field"><span>与事件的关系</span><CodeSelect value={entity.role} labels={entityRoleLabels} unknownLabel="其他关系（保留原值）" onChange={(value) => updateEntity({ role: value })} /></label>
                  <label className="field"><span>数量</span><input type="number" step="any" value={entity.quantity ?? ""} onChange={(event) => updateEntity({ quantity: optionalNumber(event.target.value) })} /></label>
                  <label className="field"><span>单位</span><input value={entity.unit ?? ""} onChange={(event) => updateEntity({ unit: event.target.value || undefined })} /></label>
                  <label className="field"><span>金额</span><input type="number" step="any" value={entity.amount ?? ""} onChange={(event) => updateEntity({ amount: optionalNumber(event.target.value) })} /></label>
                  <label className="field"><span>币种</span><input maxLength={3} value={entity.currency ?? ""} placeholder="CNY" onChange={(event) => updateEntity({ currency: event.target.value.toUpperCase() || undefined })} /></label>
                </div>
                <details className="candidate-entity-attributes">
                  <summary>更多属性 <small>通常无需修改</small></summary>
                  <JsonRecordEditor label="实体扩展数据" value={entity.attributes} onChange={(attributes) => updateEntity({ attributes })} />
                </details>
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

        <details className="candidate-developer-fields">
          <summary>高级扩展数据 <small>通常无需修改</small></summary>
          <div className="candidate-json-grid">
            <JsonRecordEditor label="主观感受数据" value={candidate.payload.subjectiveExperience} onChange={(subjectiveExperience) => updatePayload({ subjectiveExperience })} />
            <JsonRecordEditor label="其他扩展数据" value={candidate.payload.extensions} onChange={(extensions) => updatePayload({ extensions })} />
          </div>
        </details>
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
        </div>
      </details>
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
    return <span className="participant-account-chip current">我<small>{codeLabel(participantRoleLabels, participant.role, "其他角色")}</small></span>;
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
    return <span className="participant-account-chip">{participant.name}<small>{codeLabel(participantRoleLabels, participant.role, "其他角色")}</small></span>;
  }
  if (!editing) {
    return (
      <button className="participant-unlinked" type="button" onClick={() => setEditing(true)}>
        <span>{participant.name}<small>{codeLabel(participantRoleLabels, participant.role, "其他角色")}</small></span>
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
          <CodeSelect value={eventType} labels={eventTypeLabels} unknownLabel="其他活动（保留原值）" onChange={setEventType} />
        </label>
        <label className="field">
          <span>事实状态</span>
          <CodeSelect value={factualStatus} labels={factualStatusLabels} onChange={(value) => setFactualStatus(value as TimelineEvent["factualStatus"])} />
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
              <CodeSelect value={participant.role} labels={participantRoleLabels} unknownLabel="其他人物角色（保留原值）" onChange={(value) => setParticipants((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, role: value } : item))} />
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
              <CodeSelect value={entity.entityType} labels={entityTypeLabels} unknownLabel="其他实体类型（保留原值）" onChange={(value) => setEntities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, entityType: value, resolvedUserEntityId: undefined } : item))} />
              <CodeSelect value={entity.role} labels={entityRoleLabels} unknownLabel="其他关系（保留原值）" onChange={(value) => setEntities((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, role: value } : item))} />
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
  const [view, setView] = useState<View>(initialView);
  const [text, setText] = useState("");
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
  const [timelineFiltersOpen, setTimelineFiltersOpen] = useState(false);
  const [eventDetails, setEventDetails] = useState<Record<string, EventDetail>>({});
  const [graph, setGraph] = useState<PersonalGraph | null>(null);
  const [globalGraph, setGlobalGraph] = useState<GlobalGraph | null>(null);
  const [social, setSocial] = useState<SocialDiscovery | null>(null);
  const [contacts, setContacts] = useState<ContactOverview>({ contacts: [], incomingRequests: [], outgoingRequests: [], unreadTotal: 0 });
  const [contactsInitialTab, setContactsInitialTab] = useState<"friends" | "messages">(() =>
    new URLSearchParams(window.location.search).get("tab") === "messages" ? "messages" : "friends",
  );
  const [sharedInvites, setSharedInvites] = useState<SharedParticipantInvite[]>([]);
  const [sharedOccurrences, setSharedOccurrences] = useState<SharedOccurrence[]>([]);
  const [entityMemory, setEntityMemory] = useState<EntityMemory[]>([]);
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
  const accountMenuRef = useRef<HTMLDetailsElement>(null);
  const notificationMenuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (message !== "已经正式记入你的生活流水") return;

    const timer = window.setTimeout(() => {
      setMessage((current) =>
        current === "已经正式记入你的生活流水" ? null : current,
      );
    }, 3_500);

    return () => window.clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!accountMenuRef.current?.contains(event.target as Node)) {
        accountMenuRef.current?.removeAttribute("open");
      }
      if (!notificationMenuRef.current?.contains(event.target as Node)) {
        notificationMenuRef.current?.removeAttribute("open");
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        accountMenuRef.current?.removeAttribute("open");
        notificationMenuRef.current?.removeAttribute("open");
      }
    };
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const loadData = useCallback(async () => {
    const [draftResult, timelineResult, graphResult, globalGraphResult, socialResult, inviteResult, occurrenceResult, notificationResult, entityResult, contactResult] = await Promise.all([
      api.getDrafts(),
      api.getTimeline(),
      api.getGraph(),
      api.getGlobalGraph(),
      api.getSocial(),
      api.getSharedInvites(),
      api.getSharedOccurrences(),
      api.getNotifications(),
      api.getEntityMemory(),
      api.getContacts(),
    ]);
    setDrafts(draftResult.drafts);
    setTimeline(timelineResult.events);
    setTimelineTotal(timelineResult.total);
    setGraph(graphResult);
    setGlobalGraph(globalGraphResult);
    setSocial(socialResult);
    setSharedInvites(inviteResult.invites);
    setSharedOccurrences(occurrenceResult.occurrences);
    setNotifications(notificationResult.notifications);
    setNotificationPreferences(notificationResult.preferences);
    setEntityMemory(entityResult.entities);
    setContacts(contactResult);
  }, []);

  useEffect(() => {
    loadData().catch((error: Error) => setMessage(error.message));
  }, [loadData]);

  const loadNotificationsOnly = useCallback(async () => {
    const result = await api.getNotifications();
    setNotifications(result.notifications);
    setNotificationPreferences(result.preferences);
  }, []);

  const reloadRelationshipViews = useCallback(async () => {
    const [personal, global, discovery] = await Promise.all([api.getGraph(), api.getGlobalGraph(), api.getSocial()]);
    setGraph(personal);
    setGlobalGraph(global);
    setSocial(discovery);
  }, []);

  async function loadTimelinePage(
    page: number,
    overrides: Partial<{
      query: string;
      eventType: string;
      entityId: string;
      personId: string;
      placeId: string;
      from: string;
      to: string;
    }> = {},
  ) {
    setBusy(true);
    setMessage(null);
    try {
      const query = overrides.query ?? timelineQuery;
      const eventType = overrides.eventType ?? timelineEventType;
      const entityId = overrides.entityId ?? timelineEntityId;
      const personId = overrides.personId ?? timelinePersonId;
      const placeId = overrides.placeId ?? timelinePlaceId;
      const from = overrides.from ?? timelineFrom;
      const to = overrides.to ?? timelineTo;
      const toExclusive = to
        ? new Date(new Date(`${to}T00:00:00`).getTime() + 24 * 60 * 60 * 1000).toISOString()
        : undefined;
      const result = await api.getTimeline({
        q: query.trim() || undefined,
        eventType: eventType || undefined,
        entityId: entityId || undefined,
        personId: personId || undefined,
        placeId: placeId || undefined,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
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
    const timer = window.setInterval(() => {
      void api.getContacts().then(setContacts).catch(() => undefined);
    }, 15_000);
    return () => window.clearInterval(timer);
  }, []);

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
          const targetUrl = notification.notificationType === "direct_message"
            ? "/?view=contacts&tab=messages"
            : notification.notificationType.startsWith("friend_request")
              ? "/?view=contacts&tab=friends"
              : "/?view=drafts";
          if ("serviceWorker" in navigator) {
            const registration = await navigator.serviceWorker.ready;
            await registration.showNotification(notification.title, {
              body: notification.body,
              tag: `traceweave-${notification.id}`,
              data: { url: targetUrl },
            });
          } else {
            const browserNotification = new Notification(notification.title, { body: notification.body });
            browserNotification.onclick = () => window.location.assign(targetUrl);
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
  const systemNotifications = useMemo(
    () => notifications.filter((notification) => notification.notificationType !== "direct_message" && !notification.notificationType.startsWith("friend_request")),
    [notifications],
  );
  const systemUnreadCount = useMemo(
    () => systemNotifications.filter((notification) => notification.status !== "read").length,
    [systemNotifications],
  );
  const friendNotificationCount = useMemo(
    () => notifications.filter((notification) => notification.status !== "read" && notification.notificationType.startsWith("friend_request")).length,
    [notifications],
  );
  const friendCenterCount = Math.max(contacts.incomingRequests.length, friendNotificationCount);
  const contactCenterCount = contacts.unreadTotal + friendCenterCount;
  const messageCenterCount = contactCenterCount + systemUnreadCount;
  const ledgerDay = useMemo(() => accountLedgerDay(user.createdAt), [user.createdAt]);
  const activeTimelineFilterCount = useMemo(
    () => [
      timelineEventType,
      timelineEntityId,
      timelinePersonId,
      timelinePlaceId,
      timelineFrom,
      timelineTo,
    ].filter(Boolean).length,
    [timelineEntityId, timelineEventType, timelineFrom, timelinePersonId, timelinePlaceId, timelineTo],
  );

  function clearTimelineFilters() {
    setTimelineEventType("");
    setTimelineEntityId("");
    setTimelinePersonId("");
    setTimelinePlaceId("");
    setTimelineFrom("");
    setTimelineTo("");
    setTimelineFiltersOpen(false);
    void loadTimelinePage(1, {
      eventType: "",
      entityId: "",
      personId: "",
      placeId: "",
      from: "",
      to: "",
    });
  }

  async function submitEntry() {
    const aggregateText = text.trim();
    if (!aggregateText || busy) return;
    setBusy(true);
    setMessage(null);

    try {
      const result = voice.audioBlob || media.items.length
        ? await api.createMixedEntry({
            text: aggregateText,
            textBlocks: [aggregateText],
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
    notification: AppNotification,
    action: "read" | "dismiss",
  ) {
    if (busy) return;
    setBusy(true);
    try {
      await api.updateNotification(notification.id, action);
      if (action === "dismiss") {
        setNotifications((current) => current.filter((item) => item.id !== notification.id));
      } else {
        setNotifications((current) =>
          current.map((item) => (item.id === notification.id ? { ...item, status: "read" } : item)),
        );
        if (notification.notificationType === "direct_message") {
          openContacts("messages");
        } else if (notification.notificationType.startsWith("friend_request")) {
          openContacts("friends");
        } else {
          setView("drafts");
        }
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法处理提醒");
    } finally {
      setBusy(false);
    }
  }

  function openContacts(tab: "friends" | "messages") {
    setContactsInitialTab(tab);
    setView("contacts");
    notificationMenuRef.current?.removeAttribute("open");
    if (tab === "friends") {
      const friendNotifications = notifications.filter(
        (notification) => notification.status !== "read" && notification.notificationType.startsWith("friend_request"),
      );
      if (friendNotifications.length) {
        setNotifications((current) => current.map((notification) =>
          notification.notificationType.startsWith("friend_request") ? { ...notification, status: "read" } : notification,
        ));
        void Promise.all(friendNotifications.map((notification) => api.updateNotification(notification.id, "read")))
          .catch(() => void loadNotificationsOnly());
      }
    }
  }

  function openSystemNotifications() {
    setView("notifications");
    notificationMenuRef.current?.removeAttribute("open");
  }

  const existingVoice = existingMediaAttachments.find((attachment) => attachment.kind === "voice") ?? null;
  const existingSupplementalMedia = existingMediaAttachments.filter(
    (attachment) => attachment.kind !== "voice",
  );

  return (
    <div className="app-shell">
      <header className="topbar">
        <button className="brand" type="button" onClick={() => setView("record")}>
          <span className="brand-mark" aria-hidden="true"><img src="/brand-icon.svg" alt="" /></span>
          <span>
            <strong>织络</strong>
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
            <button className={view === "timeline" ? "active" : ""} onClick={() => setView("timeline")}>
              时间线
            </button>
            <button className={view === "discover" ? "active" : ""} onClick={() => setView("discover")}>
              发现
            </button>
          </nav>
          <div className="topbar-account-area">
          <details className="notification-menu" ref={notificationMenuRef}>
            <summary className={view === "contacts" || view === "notifications" ? "active" : ""} aria-label={messageCenterCount ? `消息，${messageCenterCount} 条未读` : "消息"}>
              <span className="notification-menu-icon">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
                {messageCenterCount ? <strong>{messageCenterCount > 99 ? "99+" : messageCenterCount}</strong> : null}
              </span>
              <span>消息</span>
            </summary>
            <div className="notification-menu-panel">
              <button type="button" onClick={() => openContacts(contacts.unreadTotal ? "messages" : "friends")}>
                <span><strong>好友与私聊</strong><small>私聊消息和好友申请</small></span>
                {contactCenterCount ? <i>{contactCenterCount > 99 ? "99+" : contactCenterCount}</i> : null}
              </button>
              <button type="button" onClick={openSystemNotifications}>
                <span><strong>系统提醒</strong><small>草稿到期和系统通知</small></span>
                {systemUnreadCount ? <i>{systemUnreadCount > 99 ? "99+" : systemUnreadCount}</i> : null}
              </button>
            </div>
          </details>
          <span className="account-ledger-age">在织络记流水账的第 <strong>{ledgerDay}</strong> 天</span>
          <details className="account-menu" ref={accountMenuRef}>
            <summary aria-label="打开账户菜单">
              <span className="account-avatar" aria-hidden="true">
                {user.displayName.trim().slice(0, 1) || user.username.slice(0, 1).toUpperCase()}
              </span>
              <span className="account-summary">
                <strong>{user.displayName}</strong>
                <small>@{user.username}</small>
              </span>
              <i aria-hidden="true" />
            </summary>
            <div className="account-menu-panel">
              <div className="account-menu-profile">
                <span className="account-avatar large" aria-hidden="true">
                  {user.displayName.trim().slice(0, 1) || user.username.slice(0, 1).toUpperCase()}
                </span>
                <div><strong>{user.displayName}</strong><small>@{user.username}</small></div>
              </div>
              <div className="account-menu-actions">
                <button className="pending-entry" type="button" onClick={() => { setView("drafts"); accountMenuRef.current?.removeAttribute("open"); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2M8 8h8M8 12h8M8 16h5" /></svg>
                  <span>待确认</span>
                  <strong>{draftCountLabel}</strong>
                </button>
                <button type="button" onClick={() => { setView("review"); accountMenuRef.current?.removeAttribute("open"); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21a9 9 0 1 0-8.5-6M3 21v-6h6M8 12h4V7M12 12l3 2" /></svg>
                  <span>回忆</span>
                </button>
                <button type="button" onClick={() => { setView("memory"); accountMenuRef.current?.removeAttribute("open"); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z" /></svg>
                  <span>图鉴</span>
                </button>
                <button type="button" onClick={() => { setView("settings"); accountMenuRef.current?.removeAttribute("open"); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3" /><path d="M19 13.5v-3l-2-.7a7 7 0 0 0-.8-1.8l.9-1.9L15 4l-1.9.9a7 7 0 0 0-1.8-.8L10.5 2h-3l-.7 2.1a7 7 0 0 0-1.8.8L3.1 4 1 6.1 1.9 8a7 7 0 0 0-.8 1.8L-1 10.5v3l2.1.7a7 7 0 0 0 .8 1.8L1 17.9 3.1 20l1.9-.9a7 7 0 0 0 1.8.8l.7 2.1h3l.7-2.1a7 7 0 0 0 1.8-.8l1.9.9 2.1-2.1-.9-1.9a7 7 0 0 0 .8-1.8z" transform="translate(1.5)" /></svg>
                  <span>设置</span>
                </button>
                <button type="button" onClick={() => { accountMenuRef.current?.removeAttribute("open"); void onLogout(); }}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5M14 8l4 4-4 4M8 12h10" /></svg>
                  <span>退出登录</span>
                </button>
              </div>
            </div>
          </details>
          </div>
        </div>
      </header>

      <main className={view === "graph" ? "graph-main" : view === "timeline" ? "timeline-main" : view === "settings" ? "settings-main" : view === "discover" ? "discovery-main" : view === "memory" ? "catalog-main" : view === "review" ? "reminiscence-main" : view === "contacts" || view === "notifications" ? "message-center-main" : undefined}>
        {message ? (
          <div className="message app-message" role="status" aria-live="polite">
            <span>{message}</span>
            <button type="button" aria-label="关闭提示" onClick={() => setMessage(null)}>
              ×
            </button>
          </div>
        ) : null}

        {view === "contacts" || view === "notifications" ? (
          <header className="message-center-heading">
            <div>
              <h1>消息中心</h1>
            </div>
            <div className="message-center-tabs" role="tablist" aria-label="消息中心">
              <button type="button" className={view === "contacts" && contactsInitialTab === "messages" ? "active" : ""} onClick={() => openContacts("messages")}>
                私聊{contacts.unreadTotal ? <strong>{contacts.unreadTotal > 99 ? "99+" : contacts.unreadTotal}</strong> : null}
              </button>
              <button type="button" className={view === "contacts" && contactsInitialTab === "friends" ? "active" : ""} onClick={() => openContacts("friends")}>
                好友{friendCenterCount ? <strong>{friendCenterCount > 99 ? "99+" : friendCenterCount}</strong> : null}
              </button>
              <button type="button" className={view === "notifications" ? "active" : ""} onClick={openSystemNotifications}>
                提醒{systemUnreadCount ? <strong>{systemUnreadCount > 99 ? "99+" : systemUnreadCount}</strong> : null}
              </button>
            </div>
          </header>
        ) : null}

        {view === "record" ? (
          <div className={`record-layout ${entryId ? "confirming" : ""}`}>
            <section className="intro-panel">
              <svg className="record-network-decoration" viewBox="0 0 360 190" aria-hidden="true" focusable="false">
                <g className="record-network-lines">
                  <path d="M28 108 L104 48 L185 83 L260 30 L330 73" pathLength="1" />
                  <path d="M104 48 L132 150 L185 83 L236 146 L330 73" pathLength="1" />
                  <path d="M28 108 L132 150 L236 146" pathLength="1" />
                </g>
                <g className="record-network-nodes">
                  <circle cx="28" cy="108" r="5" />
                  <circle cx="104" cy="48" r="7" />
                  <circle cx="132" cy="150" r="4" />
                  <circle className="is-core" cx="185" cy="83" r="9" />
                  <circle cx="236" cy="146" r="5" />
                  <circle cx="260" cy="30" r="4" />
                  <circle cx="330" cy="73" r="6" />
                </g>
              </svg>
              <h1>刚刚发生了什么？</h1>
              <p>像和自己说话一样写下来。系统会理解你提交的内容，确认以后正式入账。</p>
              <p className="record-network-note">
                每一次记录都会成为一个事件节点。时间久了，人物、地点、兴趣与经历会彼此连接，织成你的生活网络。
              </p>
            </section>

            <section className="record-panel">
              {!entryId ? (
              <div className="composer">
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
                  <div className="composer-footer-left">
                    <div className="composer-add-menu">
                      <button className="composer-add-trigger" type="button" aria-label="添加文字或附件" aria-haspopup="menu">
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <path d="M12 5.5v13M5.5 12h13" />
                        </svg>
                      </button>
                      <div className="composer-add-panel" role="menu">
                        <div className="composer-add-heading">
                          <strong>添加内容</strong>
                          <small>附件只作为原始证据保存，不发送给 AI。</small>
                        </div>
                        <div className="composer-add-options">
                          <label className={busy || entryId ? "disabled" : ""}>
                            <span aria-hidden="true">照</span>
                            <strong>照片</strong>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              disabled={busy || Boolean(entryId)}
                              onChange={(event) => {
                                if (event.target.files) media.add(event.target.files, "image");
                                event.currentTarget.blur();
                                event.target.value = "";
                              }}
                            />
                          </label>
                          <label className={busy || entryId ? "disabled" : ""}>
                            <span aria-hidden="true">影</span>
                            <strong>视频</strong>
                            <input
                              type="file"
                              accept="video/*"
                              multiple
                              disabled={busy || Boolean(entryId)}
                              onChange={(event) => {
                                if (event.target.files) media.add(event.target.files, "video");
                                event.currentTarget.blur();
                                event.target.value = "";
                              }}
                            />
                          </label>
                          <label className={busy || entryId ? "disabled" : ""}>
                            <span aria-hidden="true">件</span>
                            <strong>文件</strong>
                            <input
                              type="file"
                              multiple
                              disabled={busy || Boolean(entryId)}
                              onChange={(event) => {
                                if (event.target.files) media.add(event.target.files, "file");
                                event.currentTarget.blur();
                                event.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                    <button
                      className={`composer-location-trigger ${locationCapture.location ? "active" : ""}`}
                      type="button"
                      onClick={locationCapture.capture}
                      disabled={busy || locationCapture.busy || !locationCapture.supported}
                    >
                      <svg viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 21s6-5.35 6-11a6 6 0 1 0-12 0c0 5.65 6 11 6 11Z" />
                        <circle cx="12" cy="10" r="2.2" />
                      </svg>
                      <span>
                        {locationCapture.busy
                          ? "定位中…"
                          : locationCapture.location
                            ? "更新位置"
                            : "添加位置"}
                      </span>
                    </button>
                  </div>
                  <div className="composer-footer-actions">
                    {voice.phase === "recording" ? (
                      <button
                        className="composer-voice-trigger recording"
                        type="button"
                        onClick={voice.stop}
                        aria-label={`结束录音，已录制 ${Math.floor(voice.durationMs / 1000)} 秒`}
                        title="结束录音"
                      >
                        <span className="composer-recording-stop" aria-hidden="true" />
                        <small>{Math.floor(voice.durationMs / 1000)}s</small>
                      </button>
                    ) : (
                      <button
                        className="composer-voice-trigger"
                        type="button"
                        onClick={() => voice.start(setText, text)}
                        disabled={busy || !voice.recordingSupported}
                        aria-label={voice.audioBlob ? "重新录音" : "开始录音"}
                        title={voice.recordingSupported ? (voice.audioBlob ? "重新录音" : "开始录音") : "当前浏览器不支持录音"}
                      >
                        <svg viewBox="0 0 24 24" aria-hidden="true">
                          <rect x="8.5" y="3" width="7" height="12" rx="3.5" />
                          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M9 21h6" />
                        </svg>
                      </button>
                    )}
                    <button
                      className="primary-button composer-submit-button"
                      type="button"
                      onClick={submitEntry}
                      disabled={!text.trim() || busy || voice.phase === "recording"}
                    >
                      {busy && !entryId ? "正在理解…" : "解析记录"}
                    </button>
                  </div>
                </div>
              </div>
              ) : (
                <details className="source-entry-card">
                  <summary>
                    <span>原始记录</span>
                    <strong>{text}</strong>
                    <small>展开回看</small>
                  </summary>
                  <div className="source-entry-body">
                    <p>{text}</p>
                    <div className="source-entry-evidence">
                      {voice.audioBlob || existingVoice ? <span>包含原始录音</span> : null}
                      {media.items.length + existingSupplementalMedia.length ? <span>包含 {media.items.length + existingSupplementalMedia.length} 个附件</span> : null}
                      {persistedLocation ? <span>位置：{persistedLocation.label || "已附加位置"}</span> : null}
                    </div>
                    {voice.audioUrl || existingVoice ? (
                      <audio
                        className="source-entry-audio"
                        controls
                        preload="metadata"
                        src={voice.audioUrl ?? existingVoice?.url ?? (existingVoice ? `/api/media/${existingVoice.id}` : undefined)}
                      />
                    ) : null}
                    <PendingMediaGallery attachments={media.items} readOnly />
                    <StoredMediaGallery attachments={existingSupplementalMedia} compact />
                  </div>
                </details>
              )}

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
                <div className="confirmation-actions">
                  <button className="secondary-button" type="button" onClick={() => setView("drafts")}>
                    稍后处理
                  </button>
                  <button className="primary-button" type="button" disabled={busy} onClick={confirm}>
                    {busy ? "正在处理…" : candidates.length ? `确认并入账 ${candidates.length} 件` : "确认不记录这些事件"}
                  </button>
                </div>
              ) : null}

              {entryId ? (
                <details className="draft-append-card draft-append-disclosure">
                  <summary><strong>原记录有遗漏？补充后重新解析</strong><small>通常不需要处理</small></summary>
                  <div className="draft-append-body">
                    <textarea rows={2} value={draftAppendText} placeholder="补充遗漏的人、地点、金额或另一件事……" onChange={(event) => setDraftAppendText(event.target.value)} />
                    <button className="secondary-button" type="button" disabled={busy || !draftAppendText.trim()} onClick={() => void appendDraftTextBlock()}>追加并重新解析</button>
                  </div>
                </details>
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
          <section className="list-page notification-page message-center-content">
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
              {systemNotifications.map((notification) => (
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
                      onClick={() => void handleNotification(notification, "dismiss")}
                    >
                      忽略
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => void handleNotification(notification, "read")}
                    >
                      去处理
                    </button>
                  </div>
                </article>
              ))}
              {!systemNotifications.length ? (
                <div className="empty-state">当前没有提醒。草稿到期和系统通知会出现在这里。</div>
              ) : null}
            </div>
          </section>
        ) : null}

        {view === "timeline" ? (
          <section className="list-page timeline-page">
            <div className="timeline-page-heading">
              <h1>时间线</h1>
              <span>{timelineTotal} 件已确认事件</span>
            </div>
            <form className="timeline-filters" onSubmit={(event) => { event.preventDefault(); void loadTimelinePage(1); }}>
              <div className="timeline-search-row">
                <label className="timeline-search-control">
                  <span className="timeline-search-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg>
                  </span>
                  <input
                    aria-label="搜索事件、原文、人物或事物"
                    value={timelineQuery}
                    placeholder="搜索事件、原文、人物或事物"
                    onChange={(event) => setTimelineQuery(event.target.value)}
                  />
                </label>
                <button className="timeline-search-button" type="submit" disabled={busy}>
                  {busy ? "查询中" : "搜索"}
                </button>
                <button
                  className={`timeline-filter-toggle ${timelineFiltersOpen ? "open" : ""}`}
                  type="button"
                  aria-expanded={timelineFiltersOpen}
                  aria-controls="timeline-advanced-filters"
                  onClick={() => setTimelineFiltersOpen((open) => !open)}
                >
                  <span>筛选</span>
                  {activeTimelineFilterCount ? <strong>{activeTimelineFilterCount}</strong> : null}
                  <i aria-hidden="true" />
                </button>
              </div>

              {timelineFiltersOpen ? (
                <div className="timeline-advanced-filters" id="timeline-advanced-filters">
                  <div className="timeline-filter-heading">
                    <div>
                      <strong>进一步缩小范围</strong>
                      <small>可按类型、人物、地点和日期组合筛选</small>
                    </div>
                    {activeTimelineFilterCount ? (
                      <button type="button" disabled={busy} onClick={clearTimelineFilters}>清空条件</button>
                    ) : null}
                  </div>
                  <div className="timeline-filter-grid">
                    <label className="field"><span>活动类型</span><select value={timelineEventType} onChange={(event) => setTimelineEventType(event.target.value)}><option value="">全部类型</option>{Object.entries(eventTypeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                    <label className="field"><span>相关事物</span><select value={timelineEntityId} onChange={(event) => setTimelineEntityId(event.target.value)}><option value="">全部事物</option>{entityMemory.filter((item) => item.entityType !== "person" && item.entityType !== "place").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
                    <label className="field"><span>相关人物</span><select value={timelinePersonId} onChange={(event) => setTimelinePersonId(event.target.value)}><option value="">全部人物</option>{entityMemory.filter((item) => item.entityType === "person").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
                    <label className="field"><span>相关地点</span><select value={timelinePlaceId} onChange={(event) => setTimelinePlaceId(event.target.value)}><option value="">全部地点</option>{entityMemory.filter((item) => item.entityType === "place").map((item) => <option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label>
                    <label className="field"><span>开始日期</span><input type="date" value={timelineFrom} onChange={(event) => setTimelineFrom(event.target.value)} /></label>
                    <label className="field"><span>结束日期</span><input type="date" value={timelineTo} onChange={(event) => setTimelineTo(event.target.value)} /></label>
                  </div>
                  <div className="timeline-filter-actions">
                    <button className="secondary-button" type="submit" disabled={busy}>应用筛选</button>
                  </div>
                </div>
              ) : null}
            </form>
            <div className="timeline">
              {timeline.map((event) => {
                const relatedParticipants = event.participants.filter((participant) => !participant.isCurrentUser);
                const timelineOccurredAt = event.occurredStart ?? event.createdAt;
                return (
                <article className="timeline-item" key={event.id}>
                  <time className="timeline-axis-time" dateTime={timelineOccurredAt ?? undefined}>
                    <span>{formatTimelineAxisDay(timelineOccurredAt, !event.isOwned)}</span>
                    {event.isOwned ? <strong>{formatTimelineAxisClock(timelineOccurredAt)}</strong> : null}
                  </time>
                  <div className="timeline-dot" />
                  <div className="timeline-card">
                    <div className="timeline-meta">
                      <span>
                        {codeLabel(eventTypeLabels, event.eventType, "其他活动")}
                        {!event.isOwned ? ` · ${event.owner.displayName} 分享的共同经历` : ""}
                      </span>
                    </div>
                    <div className="timeline-title-row">
                      <h2>{event.title}</h2>
                      {event.isOwned && editingEventId !== event.id ? (
                        <div className="timeline-card-actions">
                          <button type="button" className="timeline-edit-button" onClick={() => void toggleEventDetail(event.id)}>{eventDetails[event.id] ? "收起来源" : "来源与版本"}</button>
                          <button type="button" className="timeline-edit-button" onClick={() => setEditingEventId(event.id)}>编辑</button>
                        </div>
                      ) : null}
                    </div>
                    {relatedParticipants.length || event.entities.length || event.location || (event.isOwned && event.attachments.length) ? (
                      <div className="timeline-relation-summary">
                      {relatedParticipants.length ? (
                        <div className="timeline-participants" aria-label="相关人物">
                          <div>
                          {relatedParticipants.map((participant) => (
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
                      {event.entities.length ? <div className="entity-list" aria-label="相关事物">
                      {event.entities.map((entity) => (
                        <span className="entity-chip" key={`${event.id}-${entity.id}-${entity.role}`}>
                          {entity.name}
                          <small>{codeLabel(entityRoleLabels, entity.role, "其他关系")}</small>
                        </span>
                      ))}
                      </div> : null}
                    {event.location ? (
                      <div className="timeline-location">
                        ⌖ {event.location.label || "已附加位置"}
                        <small>
                          {event.location.role === "occurred_at" ? "事情发生地" : "记录时位置"}
                        </small>
                      </div>
                    ) : null}
                    {event.isOwned && event.attachments.length ? (
                      <details className="timeline-attachments">
                        <summary>附件 {event.attachments.length}</summary>
                        <div className="timeline-attachment-links">
                          {event.attachments.map((attachment, attachmentIndex) => (
                            <a
                              href={attachment.url || `/api/media/${attachment.id}`}
                              key={attachment.id}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span>{attachmentIndex + 1}</span>
                              <strong>{attachment.originalFilename || `${attachment.kind}附件`}</strong>
                            </a>
                          ))}
                        </div>
                      </details>
                    ) : null}
                      </div>
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
                );
              })}
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

        {view === "memory" ? <EntityMemoryView entities={entityMemory} onChanged={setEntityMemory} /> : null}

        {view === "contacts" ? <ContactsView currentUser={user} data={contacts} initialTab={contactsInitialTab} embedded onTabChange={setContactsInitialTab} onDataChange={setContacts} onNotificationsChanged={loadNotificationsOnly} onRelationshipsChanged={reloadRelationshipViews} /> : null}

        {view === "settings" ? <SettingsView user={user} onAccountDeleted={onAccountDeleted} /> : null}
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
