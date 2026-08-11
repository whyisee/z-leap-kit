import { useEffect, useMemo, useState } from "react";
import {
  api,
  type EventPrivacySettings,
  type PrivacyOverview,
  type PrivacyPolicy,
} from "./api";

type PolicyValues = Omit<PrivacyPolicy, "level" | "subjectKey" | "version">;

const eventTypeLabels: Record<string, string> = {
  activity: "一般活动",
  eat: "饮食",
  drink: "饮品",
  order_food: "点餐",
  purchase: "消费",
  visit: "到访",
  meet: "见面",
  communicate: "沟通",
  watch: "观看",
  listen: "收听",
  read: "阅读",
  play: "游玩",
  use_app: "使用应用",
  exercise: "运动",
  work: "工作",
  study: "学习",
  sleep: "睡眠",
  create: "创作",
  travel: "出行",
};

const visibilityLabels: Record<EventPrivacySettings["contentVisibility"], string> = {
  private: "仅自己",
  friends: "好友可见",
  circle: "圈子可见",
  public: "公开可见",
  isolated: "完全隔离",
};

function defaultValues(policy: PrivacyPolicy): PolicyValues {
  return {
    contentVisibility: policy.contentVisibility ?? "private",
    allowAnonymousStats: policy.allowAnonymousStats ?? false,
    allowMatching: policy.allowMatching ?? false,
    allowIdentityDisclosure: policy.allowIdentityDisclosure ?? false,
    allowSharedOccurrence: policy.allowSharedOccurrence ?? false,
  };
}

function PolicyControls({
  values,
  onChange,
  allowInheritance,
}: {
  values: PolicyValues;
  onChange: (values: PolicyValues) => void;
  allowInheritance: boolean;
}) {
  const booleanFields: Array<{ key: keyof PolicyValues; label: string; help: string }> = [
    { key: "allowAnonymousStats", label: "匿名统计", help: "只进入不可识别个人的聚合结果" },
    { key: "allowMatching", label: "关系匹配", help: "使用最小化标准实体寻找匿名共同点" },
    { key: "allowIdentityDisclosure", label: "身份披露", help: "仍需匹配双方分别同意" },
    { key: "allowSharedOccurrence", label: "共同经历", help: "允许向明确参与者发送确认邀请" },
  ];
  const setValue = <K extends keyof PolicyValues>(key: K, value: PolicyValues[K]) => {
    const next = { ...values, [key]: value };
    if (key === "contentVisibility" && value === "isolated") {
      next.allowAnonymousStats = false;
      next.allowMatching = false;
      next.allowIdentityDisclosure = false;
      next.allowSharedOccurrence = false;
    }
    onChange(next);
  };

  return (
    <div className="privacy-policy-controls">
      <label>
        <span>内容可见范围</span>
        <select
          value={values.contentVisibility ?? ""}
          onChange={(event) =>
            setValue(
              "contentVisibility",
              (event.target.value || null) as PolicyValues["contentVisibility"],
            )
          }
        >
          {allowInheritance ? <option value="">继承上级</option> : null}
          {Object.entries(visibilityLabels).map(([value, label]) => (
            <option value={value} key={value}>{label}</option>
          ))}
        </select>
      </label>
      <div className="privacy-dimension-grid">
        {booleanFields.map((field) => (
          <label key={field.key}>
            <span>{field.label}<small>{field.help}</small></span>
            <select
              value={values[field.key] === null ? "inherit" : values[field.key] ? "allow" : "deny"}
              disabled={values.contentVisibility === "isolated"}
              onChange={(event) =>
                setValue(
                  field.key,
                  (event.target.value === "inherit" ? null : event.target.value === "allow") as never,
                )
              }
            >
              {allowInheritance ? <option value="inherit">继承上级</option> : null}
              <option value="deny">不允许</option>
              <option value="allow">允许</option>
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}

function ScopePolicyEditor({
  title,
  description,
  policy,
  inherited,
  busy,
  onSave,
  onRemove,
}: {
  title: string;
  description: string;
  policy: PrivacyPolicy | null;
  inherited: PolicyValues;
  busy: boolean;
  onSave: (values: PolicyValues) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(Boolean(policy));
  const [values, setValues] = useState<PolicyValues>(() => policy ? defaultValues(policy) : inherited);

  useEffect(() => {
    setEditing(Boolean(policy));
    setValues(policy ? defaultValues(policy) : inherited);
  }, [policy, inherited]);

  return (
    <article className={`privacy-scope-card ${policy ? "overridden" : "inherited"}`}>
      <div className="privacy-scope-heading">
        <div><strong>{title}</strong><small>{description}</small></div>
        <span>{policy ? `单独策略 v${policy.version}` : "继承上级"}</span>
      </div>
      {editing ? (
        <>
          <PolicyControls values={values} onChange={setValues} allowInheritance />
          <div className="privacy-scope-actions">
            {policy && onRemove ? (
              <button className="text-button danger" type="button" disabled={busy} onClick={() => void onRemove()}>
                删除覆盖
              </button>
            ) : <span />}
            {!policy ? <button className="text-button" type="button" onClick={() => setEditing(false)}>取消</button> : null}
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void onSave(values)}>
              保存覆盖
            </button>
          </div>
        </>
      ) : (
        <button className="privacy-create-override" type="button" onClick={() => setEditing(true)}>
          为这一范围设置单独策略
        </button>
      )}
    </article>
  );
}

export function PrivacySettingsView({ embedded = false }: { embedded?: boolean } = {}) {
  const [overview, setOverview] = useState<PrivacyOverview | null>(null);
  const [defaultDraft, setDefaultDraft] = useState<PolicyValues | null>(null);
  const [scope, setScope] = useState<"categories" | "entities">("categories");
  const [search, setSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    api.getPrivacyOverview().then((result) => {
      setOverview(result);
      setDefaultDraft(defaultValues(result.defaultPolicy));
    }).catch((error: Error) => setMessage(error.message));
  }, []);

  const visibleEntities = useMemo(() => {
    if (!overview) return [];
    const term = search.trim().toLocaleLowerCase("zh-CN");
    return overview.entities.filter((entity) =>
      !term || entity.name.toLocaleLowerCase("zh-CN").includes(term) || entity.entityType.includes(term),
    );
  }, [overview, search]);

  async function mutate(operation: () => Promise<PrivacyOverview | void>, success: string) {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const result = await operation();
      const next = result ?? await api.getPrivacyOverview();
      setOverview(next);
      setDefaultDraft(defaultValues(next.defaultPolicy));
      setMessage(success);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法更新隐私策略");
    } finally {
      setBusy(false);
    }
  }

  if (!overview || !defaultDraft) {
    return <section className={`list-page privacy-page ${embedded ? "embedded" : ""}`}><div className="empty-state">{message ?? "正在读取隐私策略…"}</div></section>;
  }
  const inherited = defaultValues(overview.defaultPolicy);

  return (
    <section className={`list-page privacy-page ${embedded ? "embedded" : ""}`}>
      {!embedded ? <div className="page-heading privacy-page-heading">
        <div><span className="eyebrow">一个决策点控制所有数据出口</span><h1>隐私与授权</h1></div>
        <span className="privacy-policy-version">默认策略 v{overview.defaultPolicy.version}</span>
      </div> : <div className="settings-section-intro"><div><strong>隐私与授权</strong><small>控制生活数据的可见范围和派生用途</small></div><span>默认策略 v{overview.defaultPolicy.version}</span></div>}
      {message ? <div className="message">{message}</div> : null}

      <section className="privacy-default-card">
        <div className="privacy-default-heading">
          <div><strong>我的默认策略</strong><small>单条事件、实体或活动类别没有覆盖时使用这里的设置。</small></div>
          <span>系统默认始终是私密和不参与派生用途</span>
        </div>
        <PolicyControls values={defaultDraft} onChange={setDefaultDraft} allowInheritance={false} />
        <div className="privacy-default-actions">
          <small>好友、圈子和公开可见范围已经生效；系统只展示符合授权策略的派生内容，不会自动暴露原始记录。</small>
          <button
            className="primary-button"
            type="button"
            disabled={busy}
            onClick={() => void mutate(() => api.setDefaultPrivacy(defaultDraft), "默认隐私策略已经更新")}
          >
            保存默认策略
          </button>
        </div>
      </section>

      <div className="privacy-scope-switch">
        <button className={scope === "categories" ? "active" : ""} onClick={() => setScope("categories")}>活动类别</button>
        <button className={scope === "entities" ? "active" : ""} onClick={() => setScope("entities")}>人物与事物</button>
      </div>

      {scope === "entities" ? (
        <input className="privacy-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜索人物、地点、书、App…" />
      ) : null}

      <div className="privacy-scope-list">
        {scope === "categories" ? overview.categories.map((category) => (
          <ScopePolicyEditor
            key={category.eventType}
            title={eventTypeLabels[category.eventType] ?? category.eventType}
            description={`${category.eventCount} 条正式事件 · 活动类别 ${category.eventType}`}
            policy={category.policy}
            inherited={inherited}
            busy={busy}
            onSave={(values) => mutate(() => api.setCategoryPrivacy(category.eventType, values), "类别策略已经生效")}
            onRemove={() => mutate(() => api.removeCategoryPrivacy(category.eventType), "类别策略已恢复继承")}
          />
        )) : visibleEntities.map((entity) => (
          <ScopePolicyEditor
            key={entity.id}
            title={entity.name}
            description={`${entity.eventCount} 条相关事件 · ${entity.entityType}`}
            policy={entity.policy}
            inherited={inherited}
            busy={busy}
            onSave={(values) => mutate(() => api.setEntityPrivacy(entity.id, values), "实体策略已经生效")}
            onRemove={() => mutate(() => api.removeEntityPrivacy(entity.id), "实体策略已恢复继承")}
          />
        ))}
        {scope === "categories" && !overview.categories.length ? <div className="empty-state">确认事件后，可在这里设置活动类别策略。</div> : null}
        {scope === "entities" && !visibleEntities.length ? <div className="empty-state">没有符合条件的实体。</div> : null}
      </div>
    </section>
  );
}
