import { useEffect, useState } from "react";
import {
  api,
  type EntityMemory,
  type LifeInsights,
  type LifeQueryIntent,
  type LifeQueryResult,
  type PeriodReport,
} from "./api";

const eventTypeLabels: Record<string, string> = {
  activity: "日常", eat: "饮食", drink: "饮用", read: "阅读", listen: "收听", watch: "观看",
  play: "游玩", use_app: "使用应用", purchase: "消费", visit: "到访", exercise: "运动",
  work: "工作", study: "学习", travel: "出行", social: "社交", sleep: "睡眠",
};

const entityTypeLabels: Record<string, string> = {
  person: "人物", place: "地点", geo_cell: "区域", food: "食物", drink: "饮品", app: "应用",
  platform: "平台", book: "书籍", movie: "影视", video: "视频", music: "音乐", song: "歌曲",
  game: "游戏", activity: "活动", topic: "主题", object: "事物",
};

const intentLabels: Record<LifeQueryIntent["intent"], string> = {
  count_events: "统计次数", sum_amount: "汇总金额", latest_event: "查找最近一次", top_entities: "常见事物", list_events: "查找记录",
};

const exampleQuestions = ["我这个月读了几次书？", "最近一次去商店 A 是什么时候？", "这周在饮食上花了多少钱？", "我最常记录哪些地点？"];

function formatDate(value: unknown, includeTime = true): string {
  if (typeof value !== "string" || !value) return "时间未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric", month: "short", day: "numeric", ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function QueryRows({ result }: { result: LifeQueryResult }) {
  if (!result.rows.length || result.query.intent === "count_events") return null;
  return <div className="query-result-rows">{result.rows.map((row, index) => {
    if (result.query.intent === "sum_amount") return <div className="query-result-row" key={`${String(row.currency)}-${index}`}><span>{String(row.currency ?? "CNY")}</span><strong>{Number(row.amount ?? 0).toFixed(2)}</strong></div>;
    if (result.query.intent === "top_entities") return <div className="query-result-row" key={`${String(row.id)}-${index}`}><span>{String(row.name ?? "未命名事物")}<small>{entityTypeLabels[String(row.type)] ?? String(row.type ?? "事物")}</small></span><strong>{String(row.count ?? 0)} 次</strong></div>;
    return <div className="query-result-row" key={`${String(row.id)}-${index}`}><span>{String(row.title ?? "未命名记录")}<small>{eventTypeLabels[String(row.eventType)] ?? String(row.eventType ?? "activity")}</small></span><time>{formatDate(row.occurredStart ?? row.createdAt)}</time></div>;
  })}</div>;
}

export function ReviewView() {
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<LifeQueryResult | null>(null);
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [report, setReport] = useState<PeriodReport | null>(null);
  const [queryBusy, setQueryBusy] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [insights, setInsights] = useState<LifeInsights | null>(null);
  const [entities, setEntities] = useState<EntityMemory[]>([]);
  const [assertionPredicate, setAssertionPredicate] = useState("likes");
  const [assertionEntityId, setAssertionEntityId] = useState("");
  const [assertionNote, setAssertionNote] = useState("");

  async function refreshInsights() {
    const [insightResult, entityResult] = await Promise.all([api.getLifeInsights(), api.getEntityMemory()]);
    setInsights(insightResult);
    setEntities(entityResult.entities);
  }

  useEffect(() => {
    let active = true;
    setReportBusy(true);
    api.getPeriodReport(period).then((data) => { if (active) setReport(data); }).catch((requestError: Error) => { if (active) setError(requestError.message); }).finally(() => { if (active) setReportBusy(false); });
    return () => { active = false; };
  }, [period]);

  useEffect(() => { void refreshInsights().catch((requestError: Error) => setError(requestError.message)); }, []);

  async function askQuestion() {
    if (!question.trim() || queryBusy) return;
    setQueryBusy(true);
    setError(null);
    try {
      setResult(await api.runLifeQuery(question.trim()));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "暂时无法查询生活记录");
    } finally {
      setQueryBusy(false);
    }
  }

  const comparison = report ? report.summary.eventCount - report.summary.previousEventCount : 0;
  const changedTrends = insights?.trends.filter((trend) => trend.change !== 0).slice(0, 8) ?? [];
  const visibleInferences = insights?.inferences.filter((inference) => inference.status !== "hidden") ?? [];
  const activeAssertions = insights?.assertions.filter((assertion) => assertion.status === "active") ?? [];

  return <section className="reminiscence-page">
    <header className="reminiscence-header">
      <div><h1>回忆</h1><p>从已经确认的生活记录里，重新看见那些日子。</p></div>
      <div className="period-switch" aria-label="回忆周期"><button type="button" className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>本周</button><button type="button" className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>本月</button></div>
    </header>

    {error ? <div className="review-error">{error}</div> : null}

    <section className="memory-period-hero">
      <header><div><small>{period === "week" ? "这一周" : "这个月"}</small><h2>{report ? `${formatDate(report.range.start, false)}—${formatDate(report.range.end, false)}` : "正在整理这段时光…"}</h2></div>{reportBusy ? <span className="report-loading">更新中</span> : <span className="memory-period-status">已确认记录</span>}</header>
      {report ? <div className="memory-period-stats"><span><strong>{report.summary.eventCount}</strong><small>件生活事件</small></span><span><strong>{report.summary.activeDays}</strong><small>个有记录的日子</small></span><span><strong className={comparison >= 0 ? "positive" : "negative"}>{comparison > 0 ? `+${comparison}` : comparison}</strong><small>相比上个周期</small></span></div> : null}
    </section>

    <section className="memory-query-card">
      <div className="memory-query-intro"><span aria-hidden="true">⌕</span><div><h2>想起什么，就问一句</h2><p>例如某次见面、去过的地方，或者一段时间里的花费。</p></div></div>
      <form onSubmit={(event) => { event.preventDefault(); void askQuestion(); }}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="我最近一次和小王吃饭是什么时候？" rows={2} maxLength={500} /><button className="primary-button" type="submit" disabled={queryBusy || !question.trim()}>{queryBusy ? "正在寻找…" : "寻找回忆"}</button></form>
      <div className="memory-query-examples">{exampleQuestions.map((example) => <button type="button" key={example} onClick={() => setQuestion(example)}>{example}</button>)}</div>
      {result ? <div className="life-query-result"><small>{result.parser.provider === "deepseek" ? "AI 已理解你的问题，并只查询你自己的已确认记录" : "正在使用本地查询规则"}</small><strong>{result.answer}</strong><div className="query-understanding"><span>{intentLabels[result.query.intent]}</span>{result.query.eventTypes.map((type) => <span key={type}>{eventTypeLabels[type] ?? type}</span>)}{result.query.entityMention ? <span>包含“{result.query.entityMention}”</span> : null}{result.query.entityType ? <span>{entityTypeLabels[result.query.entityType] ?? result.query.entityType}</span> : null}{result.query.dateRange.start ? <span>从 {formatDate(result.query.dateRange.start, false)}</span> : null}{result.query.dateRange.end ? <span>到 {formatDate(result.query.dateRange.end, false)}</span> : null}</div><QueryRows result={result} /></div> : null}
    </section>

    {report ? <>
      <div className="memory-dashboard">
        <section className="memory-panel memory-composition"><header><h3>生活构成</h3><span>{report.summary.eventCount} 件</span></header><div className="report-bars">{report.eventTypes.map((item) => { const width = report.summary.eventCount ? Math.max(8, item.count / report.summary.eventCount * 100) : 0; return <div className="report-bar-row" key={item.eventType}><span>{eventTypeLabels[item.eventType] ?? item.eventType}</span><div><i style={{ width: `${width}%` }} /></div><strong>{item.count}</strong></div>; })}{!report.eventTypes.length ? <p>这段时间还没有已确认记录。</p> : null}</div></section>
        <section className="memory-panel"><header><h3>常出现的人与事物</h3><span>前 {Math.min(5, report.topEntities.length)} 项</span></header><div className="memory-ranked-list">{report.topEntities.slice(0, 5).map((item, index) => <div className="report-list-row" key={`${item.type}-${item.name}`}><i>{index + 1}</i><span>{item.name}<small>{entityTypeLabels[item.type] ?? item.type}</small></span><strong>{item.count} 次</strong></div>)}{!report.topEntities.length ? <p>还没有足够的数据。</p> : null}</div></section>
        <section className="memory-panel"><header><h3>记录中的花费</h3><span>{report.spending.length ? "按币种" : "暂无"}</span></header><div className="memory-spending-list">{report.spending.map((item) => <div className="report-list-row" key={item.currency}><span>{item.currency}</span><strong>{Number(item.amount).toFixed(2)}</strong></div>)}{!report.spending.length ? <p>这段时间没有记录金额。</p> : null}</div></section>
      </div>
      <section className="memory-panel memory-recent"><header><div><h3>最近记住的事</h3><p>按发生时间排列的已确认生活记录</p></div><span>{Math.min(6, report.recentEvents.length)} 件</span></header><div>{report.recentEvents.slice(0, 6).map((event) => <div className="memory-recent-row" key={event.id}><time>{formatDate(event.occurredStart)}</time><span><strong>{event.title}</strong><small>{eventTypeLabels[event.eventType] ?? event.eventType}</small></span></div>)}{!report.recentEvents.length ? <p>确认记录后，这里会慢慢长出你的回忆。</p> : null}</div></section>
    </> : null}

    <section className="memory-insights">
      <header><div><h2>长期变化</h2><p>明确表达和系统推断始终分开保存，由你决定哪些认识值得留下。</p></div></header>
      <div className="memory-insight-grid">
        <section className="memory-insight-card"><header><h3>近来的变化</h3><span>{changedTrends.length + (insights?.anomalies.length ?? 0)} 项</span></header><div>{changedTrends.map((trend) => <div className="report-list-row" key={trend.eventType}><span>{eventTypeLabels[trend.eventType] ?? trend.eventType}<small>近 7 天 {trend.currentCount} 次，此前 7 天 {trend.previousCount} 次</small></span><strong className={trend.change > 0 ? "positive" : "negative"}>{trend.change > 0 ? `+${trend.change}` : trend.change}</strong></div>)}{insights?.anomalies.map((anomaly) => <div className="insight-anomaly" key={anomaly.day}>{anomaly.day} 记录了 {anomaly.count} 件事，高于平时的 {anomaly.baseline}</div>)}{insights && !changedTrends.length && !insights.anomalies.length ? <p>积累更多记录后，会在这里看到生活节奏的变化。</p> : null}</div></section>

        <details className="memory-insight-card memory-insight-disclosure"><summary><span><strong>系统注意到的线索</strong><small>这些只是推测，不会自动变成你的明确偏好</small></span><b>{visibleInferences.length}</b><i aria-hidden="true" /></summary><div>{visibleInferences.map((inference) => <div className={`inference-row ${inference.status}`} key={inference.id}><span><strong>你可能经常接触“{inference.targetName ?? "某个事物"}”</strong><small>{inference.evidence.eventCount ?? 0} 条记录证据 · 可信度 {Math.round(inference.confidence * 100)}%</small></span>{inference.status === "active" ? <div><button className="text-button" type="button" onClick={() => void api.decideInference(inference.id, "hide").then(refreshInsights)}>隐藏</button><button className="text-button danger" type="button" onClick={() => void api.decideInference(inference.id, "reject").then(refreshInsights)}>不准确</button><button className="secondary-button" type="button" onClick={() => void api.decideInference(inference.id, "confirm").then(refreshInsights)}>确认</button></div> : <small>{inference.status === "confirmed" ? "已由你确认" : "已拒绝"}</small>}</div>)}{!insights?.inferences.length ? <p>同一事物累计至少 3 条记录后，才可能产生线索。</p> : null}</div></details>

        <details className="memory-insight-card memory-insight-disclosure memory-assertions"><summary><span><strong>我明确留下的认识</strong><small>例如喜欢、重要或想要避免的人与事物</small></span><b>{activeAssertions.length}</b><i aria-hidden="true" /></summary><div><form onSubmit={(event) => { event.preventDefault(); if (!assertionEntityId) return; void api.createAssertion({ predicate: assertionPredicate, targetEntityId: assertionEntityId, sourceEventId: null, value: { note: assertionNote.trim(), source: "user_explicit" } }).then(() => { setAssertionNote(""); return refreshInsights(); }).catch((requestError: Error) => setError(requestError.message)); }}><select value={assertionPredicate} onChange={(event) => setAssertionPredicate(event.target.value)}><option value="likes">我喜欢</option><option value="dislikes">我不喜欢</option><option value="important">对我重要</option><option value="avoids">我会避免</option><option value="custom">自定义关系</option></select><select value={assertionEntityId} onChange={(event) => setAssertionEntityId(event.target.value)}><option value="">选择人物或事物</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.displayName} · {entityTypeLabels[entity.entityType] ?? entity.entityType}</option>)}</select><input value={assertionNote} placeholder="补充说明（可选）" onChange={(event) => setAssertionNote(event.target.value)} /><button className="secondary-button" type="submit" disabled={!assertionEntityId}>留下认识</button></form>{activeAssertions.map((assertion) => <div className="assertion-row" key={assertion.id}><span><strong>{assertion.predicate} · {assertion.targetName ?? "无目标"}</strong><small>{String(assertion.value.note ?? "由你明确确认")}</small></span><button className="text-button danger" type="button" onClick={() => void api.retractAssertion(assertion.id).then(refreshInsights)}>撤回</button></div>)}</div></details>
      </div>
    </section>
  </section>;
}
