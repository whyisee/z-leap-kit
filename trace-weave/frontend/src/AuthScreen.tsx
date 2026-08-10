import { useState, type FormEvent } from "react";
import { api, type AuthUser } from "./api";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "login"
          ? await api.login({ username: username.trim(), password })
          : await api.register({
              username: username.trim(),
              displayName: displayName.trim(),
              password,
            });
      onAuthenticated(result.user);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "无法完成登录");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <span className="brand-mark auth-brand-mark">TW</span>
        <span className="eyebrow">TraceWeave</span>
        <h1>你的生活，<br />只属于你的账户。</h1>
        <p>记录、事件、地点和关系图谱会严格按账户隔离。只有你明确授权的内容，才可能参与匿名关系发现。</p>
        <div className="auth-principles">
          <span>独立账户空间</span>
          <span>确认后才入账</span>
          <span>默认私密</span>
        </div>
      </section>

      <section className="auth-card">
        <div className="auth-mode-switch">
          <button
            type="button"
            className={mode === "login" ? "active" : ""}
            onClick={() => {
              setMode("login");
              setError(null);
            }}
          >
            登录
          </button>
          <button
            type="button"
            className={mode === "register" ? "active" : ""}
            onClick={() => {
              setMode("register");
              setError(null);
            }}
          >
            创建账户
          </button>
        </div>

        <div className="auth-heading">
          <span className="eyebrow">{mode === "login" ? "欢迎回来" : "建立私人空间"}</span>
          <h2>{mode === "login" ? "继续记录生活" : "创建你的生活账本"}</h2>
        </div>

        <form onSubmit={submit}>
          <label>
            <span>用户名</span>
            <input
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              minLength={3}
              maxLength={40}
              required
              placeholder="字母、数字、中文、下划线"
            />
          </label>

          {mode === "register" ? (
            <label>
              <span>显示名称</span>
              <input
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                maxLength={80}
                required
                placeholder="图谱中显示的名字"
              />
            </label>
          ) : null}

          <label>
            <span>密码</span>
            <input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === "register" ? 8 : 1}
              maxLength={128}
              required
              placeholder={mode === "register" ? "至少 8 个字符" : "输入密码"}
            />
          </label>

          {error ? <div className="auth-error">{error}</div> : null}

          <button className="primary-button auth-submit" type="submit" disabled={busy}>
            {busy ? "正在处理…" : mode === "login" ? "登录" : "创建并进入"}
          </button>
        </form>

        {mode === "register" ? (
          <p className="auth-dev-note">
            本地旧数据使用用户名 <code>traceweave-dev</code>。开发环境可用该用户名创建密码并接管旧记录。
          </p>
        ) : null}
      </section>
    </main>
  );
}
