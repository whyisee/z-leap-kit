import { useEffect, useMemo, useState } from "react";
import { api, type EntityEvidence, type EntityMemory, type EntityOperation } from "./api";

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
  const [editingName, setEditingName] = useState(false);
  const [name, setName] = useState(entity.displayName);
  const [alias, setAlias] = useState("");
  const [mergeTarget, setMergeTarget] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitName, setSplitName] = useState("");
  const [evidence, setEvidence] = useState<EntityEvidence[]>([]);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [selectedAliases, setSelectedAliases] = useState<string[]>([]);
  const mergeTargets = entities.filter((item) => item.id !== entity.id && item.entityType === entity.entityType);

  async function run(operation: () => Promise<{ entities: EntityMemory[] }>) {
    onBusy(true);
    try {
      onChanged((await operation()).entities);
      onOperationChanged();
    } catch (error) {
      onError(error instanceof Error ? error.message : "无法更新实体记忆");
    } finally {
      onBusy(false);
    }
  }

  return (
    <article className="entity-memory-card">
      <div className="entity-memory-heading">
        <div>
          {editingName ? (
            <form
              className="entity-rename-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (!name.trim() || busy) return;
                void run(() => api.renameEntity(entity.id, name.trim())).then(() => setEditingName(false));
              }}
            >
              <input value={name} onChange={(event) => setName(event.target.value)} />
              <button className="text-button" type="button" onClick={() => setEditingName(false)}>取消</button>
              <button className="secondary-button" type="submit">保存</button>
            </form>
          ) : (
            <h2>{entity.displayName}<button className="text-button" type="button" onClick={() => setEditingName(true)}>重命名</button></h2>
          )}
          <span>{entity.entityType} · {entity.eventCount} 条事件{entity.canonicalEntityId ? " · 已连接公共实体" : " · 仅个人实体"}</span>
        </div>
        <span className={`entity-sensitivity ${entity.sensitivity}`}>{entity.sensitivity === "normal" ? "普通" : entity.sensitivity === "sensitive" ? "敏感" : "禁止匹配"}</span>
      </div>

      <div className="entity-alias-list">
        {entity.aliases.map((item) => <span key={item.id}>{item.alias}</span>)}
        {!entity.aliases.length ? <small>还没有别名</small> : null}
      </div>

      <form
        className="entity-memory-action"
        onSubmit={(event) => {
          event.preventDefault();
          if (!alias.trim() || busy) return;
          void run(() => api.addEntityAlias(entity.id, alias.trim())).then(() => setAlias(""));
        }}
      >
        <label><span>添加别名</span><input value={alias} placeholder="例如：王哥、老王、楼下那家店" onChange={(event) => setAlias(event.target.value)} /></label>
        <button className="secondary-button" type="submit" disabled={busy || !alias.trim()}>添加</button>
      </form>

      {mergeTargets.length ? (
        <div className="entity-memory-action merge-action">
          <label>
            <span>把这条重复实体合并到</span>
            <select value={mergeTarget} onChange={(event) => setMergeTarget(event.target.value)}>
              <option value="">选择保留的实体</option>
              {mergeTargets.map((target) => <option key={target.id} value={target.id}>{target.displayName}</option>)}
            </select>
          </label>
          <button
            className="text-button danger"
            type="button"
            disabled={busy || !mergeTarget}
            onClick={() => {
              const target = mergeTargets.find((item) => item.id === mergeTarget);
              if (!target || !window.confirm(`确认把“${entity.displayName}”合并到“${target.displayName}”？事件证据和别名会转移，隐私采用更严格的设置。`)) return;
              void run(() => api.mergeEntity(entity.id, target.id));
            }}
          >合并重复实体</button>
        </div>
      ) : null}

      <div className="entity-split-section">
        {!splitting ? (
          <button
            className="text-button"
            type="button"
            disabled={busy || entity.eventCount < 2}
            onClick={() => {
              onBusy(true);
              api.getEntityEvidence(entity.id)
                .then((result) => {
                  setEvidence(result.evidence);
                  setSelectedEvidence([]);
                  setSelectedAliases([]);
                  setSplitName("");
                  setSplitting(true);
                })
                .catch((error: Error) => onError(error.message))
                .finally(() => onBusy(false));
            }}
          >拆分误归并的实体</button>
        ) : (
          <div className="entity-split-editor">
            <div className="structured-editor-heading">
              <div><strong>拆出一个新实体</strong><small>选择属于新实体的历史证据；未选证据仍保留在“{entity.displayName}”。</small></div>
              <button className="text-button" type="button" onClick={() => setSplitting(false)}>取消</button>
            </div>
            <label className="field"><span>新实体名称</span><input value={splitName} placeholder="例如：另一个王明" onChange={(event) => setSplitName(event.target.value)} /></label>
            <div className="entity-evidence-selector">
              {evidence.map((item) => (
                <label key={item.id}>
                  <input
                    type="checkbox"
                    checked={selectedEvidence.includes(item.id)}
                    onChange={(event) => setSelectedEvidence((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))}
                  />
                  <span><strong>{item.eventTitle}</strong><small>{item.eventType} · {item.role}{item.occurredStart ? ` · ${new Date(item.occurredStart).toLocaleDateString("zh-CN")}` : ""}</small></span>
                </label>
              ))}
            </div>
            {entity.aliases.length ? (
              <div className="entity-alias-selector">
                <small>同时移动这些别名（可选）</small>
                {entity.aliases.map((item) => (
                  <label key={item.id}><input type="checkbox" checked={selectedAliases.includes(item.id)} onChange={(event) => setSelectedAliases((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))} />{item.alias}</label>
                ))}
              </div>
            ) : null}
            <button
              className="secondary-button"
              type="button"
              disabled={busy || !splitName.trim() || !selectedEvidence.length}
              onClick={() => void run(() => api.splitEntity(entity.id, { displayName: splitName.trim(), evidenceIds: selectedEvidence, aliasIds: selectedAliases })).then(() => setSplitting(false))}
            >确认拆分 {selectedEvidence.length} 条证据</button>
          </div>
        )}
      </div>
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
    <section className="entity-memory-page">
      <div className="privacy-page-heading">
        <div><span className="eyebrow">实体归一化由你最终决定</span><h1>实体记忆</h1></div>
        <p>管理人物、地点、食物、App、书影音和游戏的长期身份。别名会参与以后自动识别，合并会转移历史证据。</p>
      </div>
      {message ? <div className="message">{message}</div> : null}
      <div className="entity-memory-filters">
        <input value={search} placeholder="搜索名称或别名" onChange={(event) => setSearch(event.target.value)} />
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="all">全部类型</option>
          {types.map((entityType) => <option key={entityType} value={entityType}>{entityType}</option>)}
        </select>
      </div>
      {operations.some((operation) => operation.status === "active") ? (
        <div className="entity-operation-history">
          <strong>可撤销的实体操作</strong>
          {operations.filter((operation) => operation.status === "active").slice(0, 5).map((operation) => (
            <div key={operation.id}>
              <span>{operation.operationType === "merge" ? `已把“${operation.sourceName}”合并到“${operation.targetName}”` : `已从“${operation.sourceName}”拆出“${operation.targetName}”`}</span>
              <button className="text-button" type="button" disabled={busy} onClick={() => {
                setBusy(true);
                api.undoEntityOperation(operation.id)
                  .then((result) => { onChanged(result.entities); setMessage("实体操作已经安全撤销。"); refreshOperations(); })
                  .catch((error: Error) => setMessage(error.message))
                  .finally(() => setBusy(false));
              }}>撤销</button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="entity-memory-list">
        {filtered.map((entity) => (
          <EntityMemoryCard
            key={entity.id}
            entity={entity}
            entities={entities}
            busy={busy}
            onBusy={setBusy}
            onChanged={(next) => {
              setMessage("实体记忆已经更新，后续记录将使用新的名称和别名。");
              onChanged(next);
            }}
            onError={setMessage}
            onOperationChanged={refreshOperations}
          />
        ))}
        {!filtered.length ? <div className="empty-state">还没有符合条件的实体。确认包含人物或事物的记录后会自动出现。</div> : null}
      </div>
    </section>
  );
}
