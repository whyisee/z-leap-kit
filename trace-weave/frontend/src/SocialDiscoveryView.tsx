import { useEffect, useState } from "react";
import { api, type CircleDetail, type CircleStat, type SharedFactPermissions, type SharedOccurrence, type SharedParticipantInvite, type SocialCircle, type SocialDiscovery, type SocialFeedItem, type SocialMatch } from "./api";

const defaultPermissions: SharedFactPermissions = { eventTitle: true, entities: true, coarseTime: true, coarseLocation: false };

export function filterDiscoverableMatches(matches: SocialMatch[]): SocialMatch[] {
  return matches.filter((match) => match.connectionState !== "connected");
}

export function limitMatchReasons(reasons: SocialMatch["reasons"], expanded: boolean): SocialMatch["reasons"] {
  return expanded ? reasons : reasons.slice(0, 5);
}

function circleNameWithoutSuffix(name: string, circleType: "interest" | "place"): string {
  return name.replace(circleType === "place" ? /地点圈$/ : /兴趣圈$/, "") || name;
}

function circleDisplayName(circle: SocialCircle): string {
  return circleNameWithoutSuffix(circle.name, circle.circleType);
}

export function filterCircles(circles: SocialCircle[], filter: "all" | "joined"): SocialCircle[] {
  return filter === "joined" ? circles.filter((circle) => circle.joined) : circles;
}

const sharedEventTypeLabels: Record<string, string> = {
  activity: "活动", eat: "饮食", drink: "饮用", visit: "到访", watch: "观看", read: "阅读",
  listen: "收听", play: "游玩", exercise: "运动", travel: "出行", social: "社交", work: "工作",
  purchase: "消费", use_app: "使用应用", browse: "浏览", study: "学习", commute: "通勤", sleep: "睡眠",
};

function SharedInviteAcceptance({ invite, busy, onAccept }: {
  invite: SharedParticipantInvite; busy: boolean;
  onAccept: (options: { linkedEventId?: string; permissions: SharedFactPermissions }) => void;
}) {
  const [eventId, setEventId] = useState("");
  const [permissions, setPermissions] = useState(defaultPermissions);
  return (
    <details className="shared-invite-acceptance">
      <summary>确认是我</summary>
      <div className="shared-invite-linking">
        <label><span>关联我自己的记录（可选）</span><select value={eventId} onChange={(event) => setEventId(event.target.value)}><option value="">只确认参与身份</option>{invite.candidateEvents.map((event) => <option key={event.id} value={event.id}>{event.title}{event.occurredStart ? ` · ${new Date(event.occurredStart).toLocaleDateString("zh-CN")}` : ""}</option>)}</select></label>
        <div className="shared-permission-options">
          {([['eventTitle','事件标题'],['entities','涉及的事物'],['coarseTime','粗粒度日期'],['coarseLocation','粗粒度地点']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })} />{label}</label>)}
        </div>
        <button className="match-action-button primary" type="button" disabled={busy} onClick={() => onAccept({ linkedEventId: eventId || undefined, permissions })}>确认并加入共同经历</button>
      </div>
    </details>
  );
}

function SharedOccurrenceCard({ occurrence, busy, onPermissions }: {
  occurrence: SharedOccurrence; busy: boolean; onPermissions: (permissions: SharedFactPermissions) => void;
}) {
  const [permissions, setPermissions] = useState(occurrence.myPermissions);
  const title = occurrence.events[0]?.title ?? "共同经历";
  return <article className="shared-occurrence-card">
    <header className="shared-occurrence-heading">
      <div className="shared-occurrence-title"><span>{occurrence.occurredDate ?? "日期未共享"}</span><h3>{title}</h3><div className="shared-member-summary"><span className="shared-member-avatars">{occurrence.members.slice(0, 4).map((member) => <i key={member.user.id}>{member.user.displayName.slice(0, 1)}</i>)}</span><p>{occurrence.members.map((member) => member.user.displayName).join("、")} · {occurrence.members.length} 人共同参与</p></div></div>
      <details className="occurrence-permission-menu"><summary><span>共享 {Object.values(permissions).filter(Boolean).length}/4</span><i aria-hidden="true">•••</i></summary><div><strong>我的共享范围</strong><small>每位成员独立控制自己的记录内容</small><div className="shared-permission-options">{([['eventTitle','标题'],['entities','事物'],['coarseTime','日期'],['coarseLocation','粗地点']] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={permissions[key]} onChange={(event) => setPermissions({ ...permissions, [key]: event.target.checked })} />共享{label}</label>)}</div><button className="match-action-button primary" type="button" disabled={busy} onClick={() => onPermissions(permissions)}>保存设置</button></div></details>
    </header>
    <details className="shared-occurrence-record-stream">
      <summary><span>{occurrence.events.length} 条成员记录</span><i aria-hidden="true" /></summary>
      <div className="shared-occurrence-records">{occurrence.events.map((event) => {
        const owner = occurrence.members.find((member) => member.user.id === event.ownerUserId)?.user;
        const entities = event.entities.slice(0, 6);
        return <section className="shared-occurrence-record" key={event.id}>
          <span className="shared-record-avatar" aria-hidden="true">{owner?.displayName.slice(0, 1) ?? "记"}</span>
          <div><header><strong>{owner?.displayName ?? "成员记录"}</strong><small>{sharedEventTypeLabels[event.eventType] ?? event.eventType}{event.occurredDate ? ` · ${event.occurredDate}` : ""}</small></header><p>{event.title}</p>{entities.length ? <div className="shared-record-entities">{entities.map((entity) => <span key={`${event.id}-${entity.name}-${entity.role}`}>{entity.name}</span>)}{event.entities.length > entities.length ? <span>+{event.entities.length - entities.length}</span> : null}</div> : null}</div>
        </section>;
      })}</div>
    </details>
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
        className="match-action-button secondary"
        type="button"
        disabled={busy}
        onClick={() => onDecision(match.id, "disconnect")}
      >
        断开连接
      </button>
    );
  }
  if (match.connectionState === "waiting_other") {
    return <button className="match-action-button waiting" type="button" disabled>等待对方同意</button>;
  }
  return (
    <button
      className="match-action-button primary"
      type="button"
      disabled={busy}
      onClick={() => onDecision(match.id, "connect")}
    >
      {match.connectionState === "incoming" ? "同意认识对方" : "愿意认识"}
    </button>
  );
}

function SocialFeedCard({ item, onCircleSelect, onReport, onBlock }: {
  item: SocialFeedItem;
  onCircleSelect: (circleId: string) => void;
  onReport: (item: SocialFeedItem) => void;
  onBlock: (item: SocialFeedItem) => void;
}) {
  return <article className="community-feed-card">
    <span className="feed-avatar" aria-hidden="true">{item.owner.displayName.slice(0, 1)}</span>
    <div className="feed-content">
      <header><strong>{item.owner.displayName}</strong><small>@{item.owner.username} · {item.occurredDate ?? "日期未公开"}</small></header>
      <p>{item.title}</p>
      <div className="feed-source-tags">
        {item.circles.length ? item.circles.map((circle) => <button key={circle.id} type="button" onClick={() => onCircleSelect(circle.id)}>{circle.circleType === "place" ? "⌖" : "#"} 来自 {circleNameWithoutSuffix(circle.name, circle.circleType)}</button>) : <span>公开派生内容</span>}
      </div>
    </div>
    <details className="feed-safety-menu"><summary aria-label={`管理 ${item.owner.displayName} 的动态`}>•••</summary><div><button type="button" onClick={() => onReport(item)}>举报</button><button className="danger" type="button" onClick={() => onBlock(item)}>拉黑</button></div></details>
  </article>;
}

function CircleRelationMap({ detail }: { detail: CircleDetail }) {
  const related = detail.relatedEntities.slice(0, 8);
  return <div className="circle-relation-map" aria-label={`${circleDisplayName(detail.circle)}的匿名关联关系`}>
    <svg viewBox="0 0 640 320" role="img">
      {related.map((entity, index) => {
        const angle = (Math.PI * 2 * index) / related.length - Math.PI / 2;
        const x = 320 + Math.cos(angle) * 225;
        const y = 160 + Math.sin(angle) * 112;
        return <line key={`line-${entity.id}`} x1="320" y1="160" x2={x} y2={y} />;
      })}
      <g className="circle-relation-root" transform="translate(320 160)"><circle r="43" /><text y="-3">{circleDisplayName(detail.circle).slice(0, 7)}</text><text className="sub" y="15">当前圈子</text></g>
      {related.map((entity, index) => {
        const angle = (Math.PI * 2 * index) / related.length - Math.PI / 2;
        const x = 320 + Math.cos(angle) * 225;
        const y = 160 + Math.sin(angle) * 112;
        return <g className="circle-relation-node" key={entity.id} transform={`translate(${x} ${y})`}><circle r="31" /><text y="-2">{entity.name.slice(0, 6)}</text><text className="sub" y="14">{entity.eventCount} 次共同出现</text></g>;
      })}
    </svg>
  </div>;
}

function CircleDetailPanel({ detail, fallback, loading, busy, onBack, onMembership, onCircleSelect, onReport, onBlock }: {
  detail: CircleDetail | null;
  fallback: SocialCircle;
  loading: boolean;
  busy: boolean;
  onBack: () => void;
  onMembership: (circle: SocialCircle, joined: boolean) => void;
  onCircleSelect: (circleId: string) => void;
  onReport: (item: SocialFeedItem) => void;
  onBlock: (item: SocialFeedItem) => void;
}) {
  const circle = detail?.circle ?? fallback;
  const stat = detail?.stat ?? null;
  return <div className="circle-detail-page">
    <button className="circle-detail-back" type="button" onClick={onBack}><span aria-hidden="true">←</span>返回圈子</button>
    <section className={`circle-detail-hero ${circle.joined ? "joined" : ""}`}>
      <span className="circle-detail-icon" aria-hidden="true">{circle.circleType === "place" ? "⌖" : "#"}</span>
      <div><small>{circle.circleType === "place" ? "地点圈" : "兴趣圈"}</small><h2>{circleDisplayName(circle)}</h2><p>围绕“{circle.entityName}”形成的匿名生活关系圈</p></div>
      <button className={`circle-action-button ${circle.joined ? "joined" : ""}`} type="button" disabled={busy} onClick={() => onMembership(circle, !circle.joined)}>{circle.joined ? "退出圈子" : "加入圈子"}</button>
    </section>
    {loading && !detail ? <div className="circle-detail-loading">正在读取圈子信息…</div> : null}
    {!loading ? <>
      <div className="circle-detail-metrics">
        <span><strong>{circle.memberCount}</strong><small>已加入成员</small></span>
        <span><strong>{stat?.recentEventCount ?? "—"}</strong><small>近 30 天匿名事件</small></span>
        <span><strong>{stat ? (stat.trend > 0 ? `+${stat.trend}` : stat.trend) : "—"}</strong><small>较前 30 天趋势</small></span>
        <span><strong>{stat?.participantCountLowerBound ?? "—"}</strong><small>统计参与人数下限</small></span>
      </div>
      {!circle.joined ? <div className="circle-detail-locked"><span aria-hidden="true">◇</span><div><strong>加入后查看圈子内容</strong><p>你将看到满足匿名阈值的趋势、关联事物，以及成员主动设置为圈子可见的派生动态。</p></div></div> : <div className="circle-detail-content">
        <section className="circle-detail-section"><header><div><h3>匿名关系</h3><p>只展示至少 {detail?.anonymityThreshold ?? 3} 位授权用户共同支持的关联。</p></div><span>{detail?.relatedEntities.length ?? 0} 个关联</span></header>{detail?.relatedEntities.length ? <CircleRelationMap detail={detail} /> : <div className="circle-detail-empty">目前还没有达到匿名阈值的关联关系</div>}</section>
        <section className="circle-detail-section"><header><div><h3>圈子动态</h3><p>成员主动设置为圈子可见的派生内容。</p></div><span>{detail?.feed.length ?? 0} 条</span></header><div className="circle-detail-feed">{detail?.feed.map((item) => <SocialFeedCard key={item.id} item={item} onCircleSelect={onCircleSelect} onReport={onReport} onBlock={onBlock} />)}</div>{!detail?.feed.length ? <div className="circle-detail-empty">还没有成员公开圈子动态</div> : null}</section>
      </div>}
    </> : null}
  </div>;
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
  const [activeTab, setActiveTab] = useState<"matches" | "circles" | "shared" | "feed">("matches");
  const [expandedMatchReasons, setExpandedMatchReasons] = useState<Set<string>>(() => new Set());
  const [showAllCircles, setShowAllCircles] = useState(false);
  const [circleFilter, setCircleFilter] = useState<"all" | "joined">("all");
  const [selectedCircleId, setSelectedCircleId] = useState<string | null>(null);
  const [circleDetail, setCircleDetail] = useState<CircleDetail | null>(null);
  const [circleDetailLoading, setCircleDetailLoading] = useState(false);
  const [circleBusy, setCircleBusy] = useState(false);
  const [circleNotice, setCircleNotice] = useState<string | null>(null);
  const visibleMatches = filterDiscoverableMatches(data.matches);
  const visibleCircles = filterCircles(circles, circleFilter);
  const selectedCircle = selectedCircleId ? circles.find((circle) => circle.id === selectedCircleId) ?? null : null;
  const loadCommunity = async () => {
    const [circleResult, statsResult, feedResult] = await Promise.all([api.getCircles(), api.getCircleStats(), api.getSocialFeed()]);
    setCircles(circleResult.circles); setCircleStats(statsResult.stats); setFeed(feedResult.feed);
  };
  useEffect(() => { void loadCommunity().catch((error: Error) => setSocialError(error.message)); }, []);
  const showCircleNotice = (message: string) => {
    setCircleNotice(message);
    window.setTimeout(() => setCircleNotice((current) => current === message ? null : current), 2600);
  };
  const openCircle = async (circleId: string) => {
    setActiveTab("circles");
    setSelectedCircleId(circleId);
    setCircleDetail(null);
    setCircleDetailLoading(true);
    setSocialError(null);
    try {
      setCircleDetail(await api.getCircleDetail(circleId));
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "无法读取圈子详情");
    } finally {
      setCircleDetailLoading(false);
    }
  };
  const updateCircleMembership = async (circle: SocialCircle, joined: boolean) => {
    setCircleBusy(true);
    setSocialError(null);
    try {
      const result = await api.setCircleMembership(circle.id, joined);
      setCircles(result.circles);
      const [statsResult, feedResult] = await Promise.all([api.getCircleStats(), api.getSocialFeed()]);
      setCircleStats(statsResult.stats);
      setFeed(feedResult.feed);
      if (selectedCircleId === circle.id) setCircleDetail(await api.getCircleDetail(circle.id));
      showCircleNotice(joined ? `已加入“${circleDisplayName(circle)}”，可在“我的圈子”中查看` : `已退出“${circleDisplayName(circle)}”`);
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : "无法更新圈子状态");
    } finally {
      setCircleBusy(false);
    }
  };
  const reportFeedItem = (item: SocialFeedItem) => {
    const details = window.prompt("请补充举报说明（可选）") ?? undefined;
    void api.reportUser({ reportedUserId: item.owner.id, reason: "other", details, contextType: "event", contextId: item.id }).then(() => setSocialError("举报已提交，平台将保留审计记录并处理。"));
  };
  const blockFeedItem = (item: SocialFeedItem) => {
    if (!window.confirm(`拉黑 ${item.owner.displayName}？之后双方不可见、不会匹配。`)) return;
    void api.blockUser(item.owner.id, "user_requested").then(() => {
      setFeed((items) => items.filter((feedItem) => feedItem.owner.id !== item.owner.id));
      setCircleDetail((current) => current ? { ...current, feed: current.feed.filter((feedItem) => feedItem.owner.id !== item.owner.id) } : current);
      onSafetyChanged();
    });
  };
  return (
    <section className="discovery-page">
      <header className="discovery-toolbar">
        <div className="discovery-title-area">
          <h1>发现</h1>
          <div className={`discovery-header-consent ${enabled ? "enabled" : ""}`}>
            <span className="discovery-consent-label"><i />参与匿名关系发现</span>
            <span className="discovery-info-tip">
              <button type="button" aria-label="查看匿名关系发现说明">?</button>
              <span role="tooltip">只使用已确认事件的标准实体和粗粒度地点；不会共享原文、附件、精确时间、精确坐标或私人称呼。</span>
            </span>
            <button type="button" className={enabled ? "consent-toggle enabled" : "consent-toggle"} aria-pressed={enabled} disabled={busy} onClick={() => onToggle(!enabled)}><span />{enabled ? "已开启" : "未开启"}</button>
          </div>
          {enabled ? <span className="discovery-match-count">{visibleMatches.length} 个新推荐</span> : null}
        </div>
        <div className="discovery-tabs" role="tablist" aria-label="发现分类">
          <button type="button" role="tab" aria-selected={activeTab === "matches"} className={activeTab === "matches" ? "active" : ""} onClick={() => setActiveTab("matches")}>推荐{visibleMatches.length ? <strong>{visibleMatches.length}</strong> : null}</button>
          <button type="button" role="tab" aria-selected={activeTab === "circles"} className={activeTab === "circles" ? "active" : ""} onClick={() => setActiveTab("circles")}>圈子{circles.filter((circle) => circle.joined).length ? <strong>{circles.filter((circle) => circle.joined).length}</strong> : null}</button>
          <button type="button" role="tab" aria-selected={activeTab === "shared"} className={activeTab === "shared" ? "active" : ""} onClick={() => setActiveTab("shared")}>共同经历{sharedInvites.length ? <strong>{sharedInvites.length}</strong> : null}</button>
          <button type="button" role="tab" aria-selected={activeTab === "feed"} className={activeTab === "feed" ? "active" : ""} onClick={() => setActiveTab("feed")}>动态{feed.length ? <strong>{feed.length}</strong> : null}</button>
        </div>
      </header>

      {activeTab === "shared" ? <div className="discovery-panel">
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

      {!sharedInvites.length && !sharedOccurrences.length ? <div className="discovery-empty compact"><span>共同经历</span><h2>当前没有需要处理的共同记录</h2><p>当其他用户在记录中关联你的账户，或双方确认同一次经历后，会集中显示在这里。</p></div> : null}
      </div> : null}

      {activeTab === "circles" ? <div className="community-section discovery-panel">
        {circleNotice ? <div className="circle-notice" role="status">{circleNotice}</div> : null}
        {socialError ? <div className="review-error">{socialError}</div> : null}
        {selectedCircle ? <CircleDetailPanel detail={circleDetail} fallback={selectedCircle} loading={circleDetailLoading} busy={busy || circleBusy} onBack={() => { setSelectedCircleId(null); setCircleDetail(null); }} onMembership={(circle, joined) => void updateCircleMembership(circle, joined)} onCircleSelect={(circleId) => void openCircle(circleId)} onReport={reportFeedItem} onBlock={blockFeedItem} /> : <>
          <div className="circle-list-heading">
            <div><h2>兴趣圈与地点圈</h2><p>加入后可查看匿名趋势、圈子动态和相关关系。</p></div>
            <div className="circle-list-filters" role="tablist" aria-label="圈子范围"><button type="button" role="tab" aria-selected={circleFilter === "all"} className={circleFilter === "all" ? "active" : ""} onClick={() => { setCircleFilter("all"); setShowAllCircles(false); }}>全部圈子 <span>{circles.length}</span></button><button type="button" role="tab" aria-selected={circleFilter === "joined"} className={circleFilter === "joined" ? "active" : ""} onClick={() => { setCircleFilter("joined"); setShowAllCircles(false); }}>我的圈子 <span>{circles.filter((circle) => circle.joined).length}</span></button></div>
          </div>
          <div className="circle-grid">{visibleCircles.slice(0, showAllCircles ? 30 : 4).map((circle) => {
            const stat = circleStats.find((item) => item.circleId === circle.id);
            return <article className={`circle-card ${circle.joined ? "joined" : ""}`} key={circle.id}>
              <header className="circle-card-heading">
                <span className="circle-type-icon" aria-hidden="true">{circle.circleType === "place" ? "⌖" : "#"}</span>
                <div><small>{circle.circleType === "place" ? "地点圈" : "兴趣圈"}</small><h3>{circleDisplayName(circle)}</h3></div>
                {circle.joined ? <strong className="circle-joined-badge">已加入</strong> : null}
              </header>
              <div className="circle-metrics">
                <span><strong>{circle.memberCount}</strong><small>成员</small></span>
                <span><strong>{stat?.recentEventCount ?? "—"}</strong><small>近 30 天事件</small></span>
                <span><strong>{stat ? (stat.trend > 0 ? `+${stat.trend}` : stat.trend) : "—"}</strong><small>趋势</small></span>
              </div>
              <p className="circle-stat-note">{stat ? "以上均为满足匿名阈值后的群体统计" : circle.joined ? "成员数达到匿名阈值后显示群体趋势" : "加入后可查看满足阈值的匿名趋势"}</p>
              <div className="circle-card-actions"><button className="circle-detail-button" type="button" onClick={() => void openCircle(circle.id)}>查看圈子</button><button className={`circle-action-button ${circle.joined ? "joined" : ""}`} type="button" disabled={busy || circleBusy} onClick={() => void updateCircleMembership(circle, !circle.joined)}>{circle.joined ? "退出" : "加入圈子"}</button></div>
            </article>;
          })}</div>
          {visibleCircles.length > 4 ? <button className="circle-list-more" type="button" onClick={() => setShowAllCircles((current) => !current)}>{showAllCircles ? "收起圈子" : `查看更多 ${Math.min(visibleCircles.length, 30) - 4} 个圈子`}<span aria-hidden="true">{showAllCircles ? "↑" : "↓"}</span></button> : null}
          {!visibleCircles.length ? <div className="discovery-empty compact"><span>{circleFilter === "joined" ? "我的圈子" : "圈子"}</span><h2>{circleFilter === "joined" ? "还没有加入任何圈子" : "暂时没有可加入的圈子"}</h2><p>{circleFilter === "joined" ? "切换到“全部圈子”，选择感兴趣的地点或事物加入。" : "当授权用户形成稳定的共同地点或兴趣后，圈子会出现在这里。"}</p></div> : null}
        </>}
      </div> : null}

      {activeTab === "feed" ? <div className="community-feed discovery-panel">
        <div className="discovery-section-heading"><div><h2>公开动态</h2><p>来自好友和圈子成员主动授权的派生内容，不展示原始生活记录。</p></div><span>{feed.length} 条动态</span></div>
        {socialError ? <div className="review-error">{socialError}</div> : null}
        <div className="community-feed-list">{feed.map((item) => <SocialFeedCard key={item.id} item={item} onCircleSelect={(circleId) => void openCircle(circleId)} onReport={reportFeedItem} onBlock={blockFeedItem} />)}</div>
        {!feed.length ? <div className="discovery-empty compact"><span>动态</span><h2>还没有可见动态</h2><p>好友或圈子成员主动公开派生内容后，会出现在这里。</p></div> : null}
      </div> : null}

      {activeTab === "matches" ? <div className="discovery-panel">
      {!enabled ? (
        <div className="discovery-empty">
          <span>关系发现保持关闭</span>
          <h2>你的生活记录仍然完全私密</h2>
          <p>开启后，系统才会从已确认记录生成可撤销的匿名匹配投影。</p>
        </div>
      ) : visibleMatches.length ? (
        <div className="match-grid">
          {visibleMatches.map((match) => {
            const label = match.otherUser?.displayName ?? match.anonymousLabel;
            const reasonsExpanded = expandedMatchReasons.has(match.id);
            const visibleReasons = limitMatchReasons(match.reasons, reasonsExpanded);
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
                  <div className="match-reasons-heading"><span>为什么会关联</span><small>{match.reasons.length} 个共同点</small></div>
                  {visibleReasons.map((reason) => (
                    <div key={`${match.id}-${reason.canonicalEntityId}-${reason.featureType}`}>
                      <strong>{reason.label}</strong>
                      <small>共同强度 {reason.contribution.toFixed(1)}</small>
                    </div>
                  ))}
                  {match.reasons.length > 5 ? <button className="match-reasons-more" type="button" onClick={() => setExpandedMatchReasons((current) => { const next = new Set(current); if (next.has(match.id)) next.delete(match.id); else next.add(match.id); return next; })}>{reasonsExpanded ? "收起" : `更多 ${match.reasons.length - 5} 项`}<span aria-hidden="true">{reasonsExpanded ? "↑" : "↓"}</span></button> : null}
                </div>

                <div className="match-privacy-note">
                  {match.identityRevealed
                    ? "双方已经同意显示身份"
                    : "双方同意前，不会显示账户身份"}
                </div>
                <div className="match-actions">
                  {match.connectionState !== "connected" ? (
                    <button
                      className="match-action-button ghost"
                      type="button"
                      disabled={busy}
                      onClick={() => onDecision(match.id, "dismiss")}
                    >
                      暂不推荐
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
          <h2>当前没有新的关系推荐</h2>
          <p>已经建立关系的用户不会继续显示；新的可靠共同点出现后，会在这里生成候选关系。</p>
        </div>
      )}
      </div> : null}
    </section>
  );
}
