import { useEffect, useState } from "react";
import { api, type CircleStat, type SharedFactPermissions, type SharedOccurrence, type SharedParticipantInvite, type SocialCircle, type SocialDiscovery, type SocialFeedItem, type SocialMatch } from "./api";

const defaultPermissions: SharedFactPermissions = { eventTitle: true, entities: true, coarseTime: true, coarseLocation: false };

function SharedInviteAcceptance({ invite, busy, onAccept }: {
  invite: SharedParticipantInvite; busy: boolean;
  onAccept: (options: { linkedEventId?: string; permissions: SharedFactPermissions }) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [permissions, setPermissions] = useState(defaultPermissions);
  return (
    <div className="shared-invite-linking">
      <label><span>关联我自己的记录（可选）</span><select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">只确认参与身份</option>{invite.candidateEvents.map((event) => <option key={event.id} value={event.id}>{event.title}{event.occurredStart ? ` · ${new Date(event.occurredStart).toLocaleDateString("zh-CN")}` : ""}</option>)}</select></label>
      <div className="shared-permission-options">
        {([['eventTitle','事件标题'],['entities','涉及的事物'],['coarseTime','粗粒度日期'],['coarseLocation','粗粒度地点']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })} />{label}</label>)}
      </div>
      <button className="primary-button" type="button" disabled={busy} onClick={() => onAccept({ linkedEventId: eventId || undefined, permissions })}>确认是我并加入共同经历</button>
    </div>
  );
}

function SharedOccurrenceCard({ occurrence, busy, onPermissions }: {
  occurrence: SharedOccurrence; busy: boolean; onPermissions: (permissions: SharedFactPermissions) => void;
}) {
  const [permissions, setPermissions] = useState(occurrence.myPermissions);
  return <article className="shared-occurrence-card">
    <div><span className="eyebrow">{occurrence.occurredDate ?? "日期未共享"}</span><h3>{occurrence.events[0]?.title ?? "共同经历"}</h3><p>{occurrence.members.map((member) => member.user.displayName).join("、")}</p></div>
    <div className="shared-occurrence-events">{occurrence.events.map((event) => <div key={event.id}><strong>{event.title}</strong><small>{event.eventType}{event.occurredDate ? ` · ${event.occurredDate}` : ""}</small>{event.entities.map((entity) => <span key={`${event.id}-${entity.name}-${entity.role}`}>{entity.name}</span>)}</div>)}</div>
    <div className="shared-permission-options">{([['eventTitle','标题'],['entities','事物'],['coarseTime','日期'],['coarseLocation','粗地点']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })} />共享{label}</label>)}</div>
    <button className="text-button" type="button" disabled={busy} onClick={() => onPermissions(permissions)}>保存我的共享范围</button>
  </article>;
}

function MatchAction({
  match,
  busy,
  onDecision,
}: {
  match: SocialMatch;
  busy: boolean;
  onDecision: (matchId: string, decision: "connect" | "dismiss" | "disconnect") => void;
}) {
  if (match.connectionState === "connected") {
    return (
      <button
        className="secondary-button"
        type="button"
        disabled={busy}
        onClick={() => onDecision(match.id, "disconnect")}
      >
        断开连接
      </button>
    );
  }
  if (match.connectionState === "waiting_other") {
    return <button className="secondary-button" type="button" disabled>等待对方同意</button>;
  }
  return (
    <button
      className="primary-button"
      type="button"
      disabled={busy}
      onClick={() => onDecision(match.id, "connect")}
    >
      {match.connectionState === "incoming" ? "同意认识对方" : "愿意认识"}
    </button>
  );
}

export function SocialDiscoveryView({
  data,
  sharedInvites,
  sharedOccurrences,
  busy,
  onToggle,
  onDecision,
  onSharedInviteDecision,
  onSharedInviteDecisionWithOptions,
  onOccurrencePermissions,
  onSafetyChanged,
}: {
  data: SocialDiscovery;
  sharedInvites: SharedParticipantInvite[];
  sharedOccurrences: SharedOccurrence[];
  busy: boolean;
  onToggle: (enabled: boolean) => void;
  onDecision: (matchId: string, decision: "connect" | "dismiss" | "disconnect") => void;
  onSharedInviteDecision: (inviteId: string, decision: "accept" | "decline") => void;
  onSharedInviteDecisionWithOptions: (inviteId: string, decision: "accept", options: { linkedEventId?: string; permissions: SharedFactPermissions }) => void;
  onOccurrencePermissions: (occurrenceId: string, permissions: SharedFactPermissions) => void;
  onSafetyChanged: () => void;
}) {
  const enabled = data.settings.participateInDiscovery;
  const [circles, setCircles] = useState<SocialCircle[]>([]);
  const [circleStats, setCircleStats] = useState<CircleStat[]>([]);
  const [feed, setFeed] = useState<SocialFeedItem[]>([]);
  const [socialError, setSocialError] = useState<string | null>(null);
  const loadCommunity = async () => {
    const [circleResult, statsResult, feedResult] = await Promise.all([api.getCircles(), api.getCircleStats(), api.getSocialFeed()]);
    setCircles(circleResult.circles); setCircleStats(statsResult.stats); setFeed(feedResult.feed);
  };
  useEffect(() => { void loadCommunity().catch((error: Error) => setSocialError(error.message)); }, []);
  return (
    <section className="discovery-page">
      <div className="page-heading discovery-heading">
        <div>
          <span className="eyebrow">由你决定是否连接</span>
          <h1>发现</h1>
        </div>
        <span className="large-count">{data.matches.length} 个关联</span>
      </div>

      {sharedInvites.length ? (
        <div className="shared-invites">
          <div className="shared-invites-heading">
            <span className="eyebrow">需要你确认身份</span>
            <h2>共同经历邀请</h2>
            <p>只有你接受后，记录中的人物才会和你的账户连接。</p>
          </div>
          <div>
            {sharedInvites.map((invite) => (
              <article className="shared-invite-card" key={invite.id}>
                <div className="anonymous-avatar">{invite.inviter.displayName.slice(0, 1)}</div>
                <div>
                  <span>{invite.inviter.displayName} · @{invite.inviter.username}</span>
                  <h3>{invite.event.title}</h3>
                  <p>
                    对方记录中的“{invite.participantMention}”是你吗？
                    {invite.event.occurredDate ? ` · ${invite.event.occurredDate}` : ""}
                  </p>
                </div>
                <div className="shared-invite-actions">
                  <button
                    className="text-button"
                    type="button"
                    disabled={busy}
                    onClick={() => onSharedInviteDecision(invite.id, "decline")}
                  >
                    不是我
                  </button>
                  <SharedInviteAcceptance invite={invite} busy={busy} onAccept={(options) => onSharedInviteDecisionWithOptions(invite.id, "accept", options)} />
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {sharedOccurrences.length ? <div className="shared-occurrences"><div className="shared-invites-heading"><span className="eyebrow">双方分别保留自己的原始记录</span><h2>我的共同经历</h2><p>每位成员可独立控制标题、实体、日期和地点是否共享。</p></div>{sharedOccurrences.map((occurrence) => <SharedOccurrenceCard key={occurrence.id} occurrence={occurrence} busy={busy} onPermissions={(permissions) => onOccurrencePermissions(occurrence.id, permissions)} />)}</div> : null}

      <div className="community-section">
        <div className="shared-invites-heading"><span className="eyebrow">主动加入，随时退出</span><h2>兴趣圈与地点圈</h2><p>群体统计至少有 3 位授权用户才显示，永远不展示个人原始记录。</p></div>
        {socialError ? <div className="review-error">{socialError}</div> : null}
        <div className="circle-grid">{circles.slice(0, 30).map((circle) => { const stat = circleStats.find((item) => item.circleId === circle.id); return <article className={`circle-card ${circle.joined ? "joined" : ""}`} key={circle.id}><span>{circle.circleType === "place" ? "地点圈" : "兴趣圈"}</span><h3>{circle.name}</h3><small>{circle.memberCount} 位成员</small>{stat ? <p>近 30 天匿名事件 {stat.recentEventCount} · 趋势 {stat.trend > 0 ? `+${stat.trend}` : stat.trend}</p> : circle.joined ? <p>尚未达到匿名统计阈值</p> : null}<button className={circle.joined ? "text-button danger" : "secondary-button"} type="button" disabled={busy} onClick={() => void api.setCircleMembership(circle.id, !circle.joined).then((result) => { setCircles(result.circles); return api.getCircleStats(); }).then((result) => setCircleStats(result.stats)).catch((error: Error) => setSocialError(error.message))}>{circle.joined ? "退出圈子" : "加入圈子"}</button></article>; })}</div>
      </div>

      {feed.length ? <div className="community-feed"><div className="shared-invites-heading"><span className="eyebrow">只显示用户明确授权的派生内容</span><h2>好友、圈子与公开动态</h2></div>{feed.map((item) => <article key={item.id}><div><strong>{item.owner.displayName}</strong><small>@{item.owner.username} · {item.occurredDate ?? "日期未公开"}</small><p>{item.title}</p></div><div className="social-safety-actions"><button className="text-button" type="button" onClick={() => { const details = window.prompt("请补充举报说明（可选）") ?? undefined; void api.reportUser({ reportedUserId: item.owner.id, reason: "other", details, contextType: "event", contextId: item.id }).then(() => setSocialError("举报已提交，平台将保留审计记录并处理。")); }}>举报</button><button className="text-button danger" type="button" onClick={() => { if (!window.confirm(`拉黑 ${item.owner.displayName}？之后双方不可见、不会匹配。`)) return; void api.blockUser(item.owner.id, "user_requested").then(() => { setFeed((items) => items.filter((feedItem) => feedItem.owner.id !== item.owner.id)); onSafetyChanged(); }); }}>拉黑</button></div></article>)}</div> : null}

      <div className={`discovery-consent ${enabled ? "enabled" : ""}`}>
        <div>
          <span className="consent-icon" aria-hidden="true">◇</span>
          <div>
            <strong>参与匿名关系发现</strong>
            <p>
              只使用已确认事件生成的标准实体和粗粒度地点。不会共享原文、附件、精确时间、
              精确坐标或你的私人称呼。
            </p>
          </div>
        </div>
        <button
          type="button"
          className={enabled ? "consent-toggle enabled" : "consent-toggle"}
          aria-pressed={enabled}
          disabled={busy}
          onClick={() => onToggle(!enabled)}
        >
          <span />
          {enabled ? "已开启" : "未开启"}
        </button>
      </div>

      {!enabled ? (
        <div className="discovery-empty">
          <span>关系发现保持关闭</span>
          <h2>你的生活记录仍然完全私密</h2>
          <p>开启后，系统才会从已确认记录生成可撤销的匿名匹配投影。</p>
        </div>
      ) : data.matches.length ? (
        <div className="match-grid">
          {data.matches.map((match) => {
            const label = match.otherUser?.displayName ?? match.anonymousLabel;
            return (
              <article className={`match-card ${match.connectionState}`} key={match.id}>
                <div className="match-card-heading">
                  <div className="anonymous-avatar" aria-hidden="true">
                    {match.otherUser ? match.otherUser.displayName.slice(0, 1) : "?"}
                  </div>
                  <div>
                    <span>
                      {match.connectionState === "connected"
                        ? "已经建立连接"
                        : match.connectionState === "incoming"
                          ? "有人也愿意认识你"
                          : "匿名相似用户"}
                    </span>
                    <h2>{label}</h2>
                    {match.otherUser ? <small>@{match.otherUser.username}</small> : null}
                  </div>
                  <strong className="match-score">{Math.round(match.score)}%</strong>
                </div>

                <div className="match-reasons">
                  <span>为什么会关联</span>
                  {match.reasons.map((reason) => (
                    <div key={`${match.id}-${reason.canonicalEntityId}-${reason.featureType}`}>
                      <strong>{reason.label}</strong>
                      <small>共同强度 {reason.contribution.toFixed(1)}</small>
                    </div>
                  ))}
                </div>

                <div className="match-privacy-note">
                  {match.identityRevealed
                    ? "双方已经同意显示身份"
                    : "双方同意前，不会显示账户身份"}
                </div>
                <div className="match-actions">
                  {match.connectionState !== "connected" ? (
                    <button
                      className="text-button"
                      type="button"
                      disabled={busy}
                      onClick={() => onDecision(match.id, "dismiss")}
                    >
                      不再推荐
                    </button>
                  ) : <span />}
                  <MatchAction match={match} busy={busy} onDecision={onDecision} />
                </div>
                {match.otherUser ? <div className="social-safety-actions"><button className="text-button" type="button" onClick={() => void api.reportUser({ reportedUserId: match.otherUser!.id, reason: "other", contextType: "match", contextId: match.id }).then(() => setSocialError("举报已提交。"))}>举报</button><button className="text-button danger" type="button" onClick={() => void api.blockUser(match.otherUser!.id, "user_requested").then(onSafetyChanged)}>拉黑</button></div> : null}
              </article>
            );
          })}
        </div>
      ) : (
        <div className="discovery-empty">
          <span>投影已经建立</span>
          <h2>还没有找到足够可靠的共同点</h2>
          <p>继续主动记录并确认生活事件；只有同样主动开启的用户才可能与你形成候选关系。</p>
        </div>
      )}
    </section>
  );
}
