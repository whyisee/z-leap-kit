import { useState } from "react";
import { api, type AuthUser } from "./api";

export function DataGovernanceView({
  user,
  onAccountDeleted,
  embedded = false,
}: {
  user: AuthUser;
  onAccountDeleted: () => void;
  embedded?: boolean;
}) {
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeletion, setShowDeletion] = useState(false);
  const [password, setPassword] = useState("");
  const [usernameConfirmation, setUsernameConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  async function downloadExport() {
    setExporting(true);
    setMessage(null);
    try {
      const exported = await api.downloadAccountData();
      const url = URL.createObjectURL(exported.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = exported.filename;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("数据导出已生成。JSON 包含原始记录、事件、实体、策略、关系与审计数据；附件包含元数据。 ");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法导出数据");
    } finally {
      setExporting(false);
    }
  }

  async function deleteAccount() {
    if (deleting || usernameConfirmation !== user.username || !password) return;
    setDeleting(true);
    setMessage(null);
    try {
      const result = await api.deleteAccount({ password, usernameConfirmation });
      window.alert(result.message);
      onAccountDeleted();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "无法申请删除账号");
      setDeleting(false);
    }
  }

  return (
    <section className={`data-governance-page ${embedded ? "embedded" : ""}`}>
      {!embedded ? <div className="privacy-page-heading">
        <div><span className="eyebrow">可迁移、可删除、可审计</span><h1>我的数据</h1></div>
        <p>导出不会改变任何记录；账号删除会先冻结会话，再由可靠后台任务清除生活数据和附件。</p>
      </div> : <div className="settings-section-intro"><div><strong>我的数据</strong><small>导出、迁移或永久删除当前账户的数据</small></div></div>}

      {message ? <div className="message">{message}</div> : null}

      <article className="data-governance-card">
        <div>
          <h2>导出全部账号数据</h2>
          <p>包括主动提交的原始内容、AI 候选、已确认事件、实体、位置、隐私策略、共同经历和审计记录。</p>
          <small>当前导出为结构化 JSON；媒体文件不内嵌，但会导出文件名、类型、大小、摘要等完整元数据。</small>
        </div>
        <button className="secondary-button" type="button" disabled={exporting} onClick={() => void downloadExport()}>
          {exporting ? "正在生成…" : "下载 JSON 导出"}
        </button>
      </article>

      <article className="data-governance-card danger-zone">
        <div>
          <h2>永久删除账号</h2>
          <p>系统会撤销匹配与共同经历、删除记录和附件、清除登录凭据，并把账号改成不可登录的匿名墓碑。</p>
          <small>删除任务采用租约、失败重试和审计日志；此操作不可恢复。</small>
        </div>
        {!showDeletion ? (
          <button className="text-button danger" type="button" onClick={() => setShowDeletion(true)}>开始删除流程</button>
        ) : (
          <div className="account-deletion-confirmation">
            <label className="field">
              <span>输入用户名 <strong>{user.username}</strong></span>
              <input value={usernameConfirmation} onChange={(event) => setUsernameConfirmation(event.target.value)} autoComplete="off" />
            </label>
            <label className="field">
              <span>输入当前密码</span>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" />
            </label>
            <div className="deletion-actions">
              <button className="text-button" type="button" disabled={deleting} onClick={() => setShowDeletion(false)}>取消</button>
              <button
                className="danger-button"
                type="button"
                disabled={deleting || usernameConfirmation !== user.username || !password}
                onClick={() => void deleteAccount()}
              >
                {deleting ? "正在受理…" : "永久删除我的账号"}
              </button>
            </div>
          </div>
        )}
      </article>
    </section>
  );
}
