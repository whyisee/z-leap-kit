import { useEffect, useMemo, useState } from "react";
import { api, type EntityEvidence, type EntityMemory, type EntityOperation } from "./api";

const entityTypePresentation: Record<string, { label: string; icon: string }> = {
  person: { label: "人物", icon: "人" },
  place: { label: "地点", icon: "⌖" },
  geo_cell: { label: "区域", icon: "⌖" },
  food: { label: "食物", icon: "食" },
  drink: { label: "饮品", icon: "饮" },
  app: { label: "应用", icon: "◇" },
  platform: { label: "平台", icon: "◇" },
  book: { label: "书籍", icon: "书" },
  movie: { label: "影视", icon: "映" },
  video: { label: "视频", icon: "映" },
  music: { label: "音乐", icon: "音" },
  song: { label: "歌曲", icon: "音" },
  game: { label: "游戏", icon: "游" },
  activity: { label: "活动", icon: "行" },
  topic: { label: "主题", icon: "#" },
  object: { label: "事物", icon: "物" },
};

function entityPresentation(entityType: string) {
  return entityTypePresentation[entityType] ?? { label: entityType, icon: "记" };
}

function EntityMemoryCard({
  entity,
  entities,
  busy,
  onBusy,
  onChanged,
  onError,
  onOperationChanged,
}: {
  entity: EntityMemory;
  entities: EntityMemory[];
  busy: boolean;
  onBusy: (busy: boolean) => void;
  onChanged: (entities: EntityMemory[]) => void;
  onError: (message: string) => void;
  onOperationChanged: () => void;
}) {
  const [name, setName] = useState(entity.displayName);
  const [alias, setAlias] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitName, setSplitName] = useState("");
  const [evidence, setEvidence] = useState<EntityEvidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [selectedAliases, setSelectedAliases] = useState<string[]>([]);
  const mergeTargets = entities.filter((item) => item.id !== entity.id && item.entityType === entity.entityType);
  const presentation = entityPresentation(entity.entityType);
  useEffect(() => setName(entity.displayName), [entity.displayName]);

  async function run(operation: () => Promise<{ entities: EntityMemory[] }>) {
    onBusy(true);
    try {
      onChanged((await operation()).entities);
      onOperationChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "无法更新图鉴");
    } finally {
      onBusy(false);
    }
  }

  return (
    <article className="catalog-card">
      <header className="catalog-card-heading">
        <span className={`catalog-entity-icon ${entity.entityType}`} aria-hidden="true">{presentation.icon}</span>
        <div><small>{presentation.label}</small><h2>{entity.displayName}</h2></div>
        {entity.sensitivity !== "normal" ? <span className={`entity-sensitivity ${entity.sensitivity}`}>{entity.sensitivity === "sensitive" ? "敏感" : "禁止匹配"}</span> : null}
      </header>
      <div className="catalog-card-meta"><span><strong>{entity.eventCount}</strong> 条生活记录</span><span>{entity.canonicalEntityId ? "已归入公共事物" : "仅在我的图鉴"}</span></div>
      <div className="catalog-alias-preview">
        {entity.aliases.slice(0, 4).map((item) => <span key={item.id}>{item.alias}</span>)}
        {entity.aliases.length > 4 ? <span>+{entity.aliases.length - 4}</span> : null}
        {!entity.aliases.length ? <small>暂无其他称呼</small> : null}
      </div>

      <details className="catalog-card-tools">
        <summary><span>管理名称与归类</span><i aria-hidden="true" /></summary>
        <div className="catalog-card-tools-body">
          <form className="catalog-inline-form" onSubmit={(event) => { event.preventDefault(); if (!name.trim() || busy || name.trim() === entity.displayName) return; void run(() => api.renameEntity(entity.id, name.trim())); }}>
            <label><span>图鉴中的名称</span><input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <button className="secondary-button" type="submit" disabled={busy || !name.trim() || name.trim() === entity.displayName}>保存</button>
          </form>

          <form className="catalog-inline-form" onSubmit={(event) => { event.preventDefault(); if (!alias.trim() || busy) return; void run(() => api.addEntityAlias(entity.id, alias.trim())).then(() => setAlias("")); }}>
            <label><span>添加其他称呼</span><input value={alias} placeholder="例如：王哥、楼下那家店" onChange={(event) => setAlias(event.target.value)} /></label>
            <button className="secondary-button" type="submit" disabled={busy || !alias.trim()}>添加</button>
          </form>

          <div className="catalog-advanced-actions">
            {mergeTargets.length ? <div className="catalog-merge-action"><label><span>发现重复条目？合并到</span><select value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)}><option value="">选择保留的条目</option>{mergeTargets.map((target) => <option key={target.id} value={target.id}>{target.displayName}</option>)}</select></label><button className="text-button danger" type="button" disabled={busy || !mergeTarget} onClick={() => { const target = mergeTargets.find((item) => item.id === mergeTarget); if (!target || !window.confirm(`确认把“${entity.displayName}”合并到“${target.displayName}”？事件证据和别名会转移，隐私采用更严格的设置。`)) return; void run(() => api.mergeEntity(entity.id, target.id)); }}>合并</button></div> : null}

            <div className="entity-split-section">
              {!splitting ? <button className="text-button" type="button" disabled={busy || entity.eventCount < 2} onClick={() => { onBusy(true); api.getEntityEvidence(entity.id).then((result) => { setEvidence(result.evidence); setSelectedEvidence([]); setSelectedAliases([]); setSplitName(""); setSplitting(true); }).catch((error: Error) => onError(error.message)).finally(() => onBusy(false)); }}>条目中混入了不同对象？拆分记录</button> : <div className="entity-split-editor">
                <div className="structured-editor-heading"><div><strong>拆出一个新条目</strong><small>选择属于新对象的历史记录；未选内容仍保留在“{entity.displayName}”。</small></div><button className="text-button" type="button" onClick={() => setSplitting(false)}>取消</button></div>
                <label className="field"><span>新条目名称</span><input value={splitName} placeholder="例如：另一个王明" onChange={(event) => setSplitName(event.target.value)} /></label>
                <div className="entity-evidence-selector">{evidence.map((item) => <label key={item.id}><input type="checkbox" checked={selectedEvidence.includes(item.id)} onChange={(event) => setSelectedEvidence((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} /><span><strong>{item.eventTitle}</strong><small>{item.eventType} · {item.role}{item.occurredStart ? ` · ${new Date(item.occurredStart).toLocaleDateString("zh-CN")}` : ""}</small></span></label>)}</div>
                {entity.aliases.length ? <div className="entity-alias-selector"><small>同时移动这些称呼（可选）</small>{entity.aliases.map((item) => <label key={item.id}><input type="checkbox" checked={selectedAliases.includes(item.id)} onChange={(event) => setSelectedAliases((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />{item.alias}</label>)}</div> : null}
                <button className="secondary-button" type="button" disabled={busy || !splitName.trim() || !selectedEvidence.length} onClick={() => void run(() => api.splitEntity(entity.id, { displayName: splitName.trim(), evidenceIds: selectedEvidence, aliasIds: selectedAliases })).then(() => setSplitting(false))}>确认拆分 {selectedEvidence.length} 条记录</button>
              </div>}
            </div>
          </div>
        </div>
      </details>
    </article>
  );
}

export function EntityMemoryView({
  entities,
  onChanged,
}: {
  entities: EntityMemory[];
  onChanged: (entities: EntityMemory[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [operations, setOperations] = useState<EntityOperation[]>([]);
  const types = useMemo(() => [...new Set(entities.map((entity) => entity.entityType))].sort(), [entities]);
  const aliasCount = useMemo(() => entities.reduce((total, entity) => total + entity.aliases.length, 0), [entities]);
  const evidenceCount = useMemo(() => entities.reduce((total, entity) => total + entity.eventCount, 0), [entities]);
  const activeOperations = operations.filter((operation) => operation.status === "active");
  const filtered = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase("zh-CN");
    return entities.filter((entity) =>
      (type === "all" || entity.entityType === type) &&
      (!normalized || entity.displayName.toLocaleLowerCase("zh-CN").includes(normalized) || entity.aliases.some((alias) => alias.alias.toLocaleLowerCase("zh-CN").includes(normalized))),
    );
  }, [entities, search, type]);

  const refreshOperations = () => {
    void api.getEntityOperations().then((result) => setOperations(result.operations)).catch(() => undefined);
  };
  useEffect(refreshOperations, []);

  return (
    <section className="catalog-page">
      <header className="catalog-hero">
        <div><h1>图鉴</h1><p>那些反复出现在你生活里的人、地点与事物。</p></div>
        <div className="catalog-overview"><span><strong>{entities.length}</strong><small>个条目</small></span><span><strong>{aliasCount}</strong><small>个其他称呼</small></span><span><strong>{evidenceCount}</strong><small>条关联记录</small></span></div>
      </header>
      {message ? <div className="message">{message}</div> : null}
      <div className="catalog-controls">
        <label className="catalog-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></svg><input value={search} placeholder="搜索人物、地点、事物或其他称呼" onChange={(event) => setSearch(event.target.value)} />{search ? <button type="button" aria-label="清除搜索" onClick={() => setSearch("")}>×</button> : null}</label>
        <div className="catalog-type-filter" aria-label="图鉴分类"><button type="button" className={type === "all" ? "active" : ""} onClick={() => setType("all")}>全部</button>{types.map((entityType) => <button type="button" key={entityType} className={type === entityType ? "active" : ""} onClick={() => setType(entityType)}>{entityPresentation(entityType).label}</button>)}</div>
      </div>
      {activeOperations.length ? <details className="catalog-history"><summary><span>最近调整</span><strong>{activeOperations.length} 项可撤销</strong><i aria-hidden="true" /></summary><div>{activeOperations.slice(0, 5).map((operation) => <div key={operation.id}><span>{operation.operationType === "merge" ? `已把“${operation.sourceName}”合并到“${operation.targetName}”` : `已从“${operation.sourceName}”拆出“${operation.targetName}”`}</span><button className="text-button" type="button" disabled={busy} onClick={() => { setBusy(true); api.undoEntityOperation(operation.id).then((result) => { onChanged(result.entities); setMessage("这次图鉴调整已经撤销。"); refreshOperations(); }).catch((error: Error) => setMessage(error.message)).finally(() => setBusy(false)); }}>撤销</button></div>)}</div></details> : null}
      <div className="catalog-grid">
        {filtered.map((entity) => (
          <EntityMemoryCard
            key={entity.id}
            entity={entity}
            entities={entities}
            busy={busy}
            onBusy={setBusy}
            onChanged={(next) => {
              setMessage("图鉴已经更新，后续记录会使用新的名称和称呼。");
              onChanged(next);
            }}
            onError={setMessage}
            onOperationChanged={refreshOperations}
          />
        ))}
        {!filtered.length ? <div className="empty-state catalog-empty">还没有符合条件的图鉴条目。确认包含人物或事物的记录后会自动出现。</div> : null}
      </div>
    </section>
  );
}
