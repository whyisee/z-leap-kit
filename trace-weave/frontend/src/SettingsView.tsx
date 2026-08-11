import { useState } from "react";
import type { AuthUser } from "./api";
import { DataGovernanceView } from "./DataGovernanceView";
import { PrivacySettingsView } from "./PrivacySettingsView";

type SettingsTab = "account" | "privacy" | "data";

const settingsTabs: Array<{ id: SettingsTab; label: string }> = [
  { id: "account", label: "账号信息" },
  { id: "privacy", label: "隐私设置" },
  { id: "data", label: "数据管理" },
];

function AccountInformation({ user }: { user: AuthUser }) {
  const avatarText = user.displayName.trim().slice(0, 1) || user.username.slice(0, 1).toUpperCase();

  return (
    <section className="account-information" aria-labelledby="account-information-title">
      <div className="account-information-hero">
        <span className="settings-account-avatar" aria-hidden="true">{avatarText}</span>
        <div>
          <h2 id="account-information-title">{user.displayName}</h2>
          <p>@{user.username}</p>
        </div>
        <span className="account-status">正常使用</span>
      </div>

      <div className="account-information-grid">
        <div>
          <span>显示名称</span>
          <strong>{user.displayName}</strong>
          <small>用于你自己的页面及授权后的关系展示</small>
        </div>
        <div>
          <span>用户名</span>
          <strong>@{user.username}</strong>
          <small>登录和共同经历邀请使用的唯一名称</small>
        </div>
        <div className="account-id-row">
          <span>账户 ID</span>
          <code>{user.id}</code>
          <small>系统用于隔离生活记录和关系数据的唯一标识</small>
        </div>
      </div>

      <div className="account-security-note">
        <strong>账户空间相互隔离</strong>
        <p>你的原始记录、附件、事件和个人图谱默认只属于当前账户；只有明确授权的数据才会参与社交关系发现。</p>
      </div>
    </section>
  );
}

export function SettingsView({
  user,
  onAccountDeleted,
}: {
  user: AuthUser;
  onAccountDeleted: () => void;
}) {
  const [tab, setTab] = useState<SettingsTab>("account");

  return (
    <section className="settings-page">
      <header className="settings-page-heading">
        <div>
          <span className="eyebrow">账户中心</span>
          <h1>设置</h1>
        </div>
        <p>管理账号身份、隐私授权与个人数据。</p>
      </header>

      <div className="settings-tabs" role="tablist" aria-label="设置分类">
        {settingsTabs.map((item) => (
          <button
            type="button"
            role="tab"
            id={`settings-tab-${item.id}`}
            aria-controls={`settings-panel-${item.id}`}
            aria-selected={tab === item.id}
            className={tab === item.id ? "active" : ""}
            key={item.id}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div
        className="settings-panel"
        role="tabpanel"
        id={`settings-panel-${tab}`}
        aria-labelledby={`settings-tab-${tab}`}
      >
        {tab === "account" ? <AccountInformation user={user} /> : null}
        {tab === "privacy" ? <PrivacySettingsView embedded /> : null}
        {tab === "data" ? <DataGovernanceView user={user} onAccountDeleted={onAccountDeleted} embedded /> : null}
      </div>
    </section>
  );
}
