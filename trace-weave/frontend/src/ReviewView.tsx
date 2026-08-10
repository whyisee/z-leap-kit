import { useEffect, useState } from "react";
import {
  api,
  type LifeQueryIntent,
  type LifeQueryResult,
  type LifeInsights,
  type EntityMemory,
  type PeriodReport,
} from "./api";

const eventTypeLabels: Record<string, string> = {
  activity: "一般活动",
  eat: "饮食",
  drink: "饮品",
  read: "阅读",
  listen: "收听",
  watch: "观看",
  play: "游玩",
  use_app: "使用应用",
  purchase: "消费",
  visit: "到访",
  exercise: "运动",
  work: "工作",
  study: "学习",
  travel: "出行",
};

const intentLabels: Record<LifeQueryIntent["intent"], string> = {
  count_events: "统计次数",
  sum_amount: "汇总金额",
  latest_event: "查找最近一次",
  top_entities: "实体排行",
  list_events: "查找事件",
};

const exampleQuestions = [
  "我这个月读了几次书？",
  "最近一次去商店 A 是什么时候？",
  "这周在饮食上花了多少钱？",
  "我最常记录哪些地点？",
];

function formatDate(value: unknown, includeTime = true): string {
  if (typeof value !== "string" || !value) return "时间未记录";
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(includeTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

function QueryRows({ result }: { result: LifeQueryResult }) {
  if (!result.rows.length) return null;
  if (result.query.intent === "count_events") return null;

  return (
    <div className="query-result-rows">
      {result.rows.map((row, index) => {
        if (result.query.intent === "sum_amount") {
          return (
            <div className="query-result-row" key={`${String(row.currency)}-${index}`}>
              <span>{String(row.currency ?? "CNY")}</span>
              <strong>{Number(row.amount ?? 0).toFixed(2)}</strong>
            </div>
          );
        }
        if (result.query.intent === "top_entities") {
          return (
            <div className="query-result-row" key={`${String(row.id)}-${index}`}>
              <span>{String(row.name ?? "未命名实体")}<small>{String(row.type ?? "entity")}</small></span>
              <strong>{String(row.count ?? 0)} 次</strong>
            </div>
          );
        }
        return (
          <div className="query-result-row" key={`${String(row.id)}-${index}`}>
            <span>
              {String(row.title ?? "未命名事件")}
              <small>{eventTypeLabels[String(row.eventType)] ?? String(row.eventType ?? "activity")}</small>
            </span>
            <time>{formatDate(row.occurredStart ?? row.createdAt)}</time>
          </div>
        );
      })}
    </div>
  );
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
    api
      .getPeriodReport(period)
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((requestError: Error) => {
        if (active) setError(requestError.message);
      })
      .finally(() => {
        if (active) setReportBusy(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  useEffect(() => {
    void refreshInsights().catch((requestError: Error) => setError(requestError.message));
  }, []);

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

  const comparison = report
    ? report.summary.eventCount - report.summary.previousEventCount
    : 0;

  return (
    <section className="list-page review-page">
      <div className="page-heading review-heading">
        <div>
          <span className="eyebrow">从你确认过的记录中寻找答案</span>
          <h1>生活回顾</h1>
        </div>
        <div className="period-switch" aria-label="回顾周期">
          <button type="button" className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>本周</button>
          <button type="button" className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>本月</button>
        </div>
      </div>

      {error ? <div className="review-error">{error}</div> : null}

      <div className="review-layout">
        <section className="life-query-card">
          <span className="eyebrow">问你的生活账本</span>
          <h2>想回忆什么？</h2>
          <form
            onSubmit={(submitEvent) => {
              submitEvent.preventDefault();
              void askQuestion();
            }}
          >
            <textarea
              value={question}
              onChange={(changeEvent) => setQuestion(changeEvent.target.value)}
              placeholder="例如：我最近一次和小王吃饭是什么时候？"
              rows={3}
              maxLength={500}
            />
            <button className="primary-button" type="submit" disabled={queryBusy || !question.trim()}>
              {queryBusy ? "正在理解并查询…" : "查询记录"}
            </button>
          </form>
          <div className="query-examples">
            {exampleQuestions.map((example) => (
              <button type="button" key={example} onClick={() => setQuestion(example)}>{example}</button>
            ))}
          </div>

          {result ? (
            <div className="life-query-result">
              <small>{result.parser.provider === "deepseek" ? `DeepSeek 已将问题转换为受限查询 · ${result.parser.model}` : "规则查询模式"}</small>
              <strong>{result.answer}</strong>
              <div className="query-understanding">
                <span>{intentLabels[result.query.intent]}</span>
                {result.query.eventTypes.map((type) => <span key={type}>{eventTypeLabels[type] ?? type}</span>)}
                {result.query.entityMention ? <span>包含“{result.query.entityMention}”</span> : null}
                {result.query.entityType ? <span>{result.query.entityType}</span> : null}
                {result.query.dateRange.start ? <span>从 {formatDate(result.query.dateRange.start, false)}</span> : null}
                {result.query.dateRange.end ? <span>到 {formatDate(result.query.dateRange.end, false)}</span> : null}
              </div>
              <QueryRows result={result} />
            </div>
          ) : null}
        </section>

        <section className="period-report-card">
          <div className="report-title-row">
            <div>
              <span className="eyebrow">{period === "week" ? "本周摘要" : "本月摘要"}</span>
              <h2>{report ? `${formatDate(report.range.start, false)}—${formatDate(report.range.end, false)}` : "正在汇总…"}</h2>
            </div>
            {reportBusy ? <span className="report-loading">更新中</span> : null}
          </div>

          {report ? (
            <>
              <div className="report-stats">
                <div><strong>{report.summary.eventCount}</strong><span>件已确认事件</span></div>
                <div><strong>{report.summary.activeDays}</strong><span>个记录日</span></div>
                <div>
                  <strong className={comparison >= 0 ? "positive" : "negative"}>{comparison > 0 ? `+${comparison}` : comparison}</strong>
                  <span>较上个周期</span>
                </div>
              </div>

              <div className="report-section">
                <h3>生活构成</h3>
                <div className="report-bars">
                  {report.eventTypes.map((item) => {
                    const width = report.summary.eventCount ? Math.max(8, item.count / report.summary.eventCount * 100) : 0;
                    return (
                      <div className="report-bar-row" key={item.eventType}>
                        <span>{eventTypeLabels[item.eventType] ?? item.eventType}</span>
                        <div><i style={{ width: `${width}%` }} /></div>
                        <strong>{item.count}</strong>
                      </div>
                    );
                  })}
                  {!report.eventTypes.length ? <p>这个周期还没有已确认记录。</p> : null}
                </div>
              </div>

              <div className="report-two-columns">
                <div className="report-section">
                  <h3>高频人物与事物</h3>
                  {report.topEntities.slice(0, 5).map((item) => (
                    <div className="report-list-row" key={`${item.type}-${item.name}`}>
                      <span>{item.name}<small>{item.type}</small></span><strong>{item.count} 次</strong>
                    </div>
                  ))}
                  {!report.topEntities.length ? <p>暂无实体数据。</p> : null}
                </div>
                <div className="report-section">
                  <h3>记录中的金额</h3>
                  {report.spending.map((item) => (
                    <div className="report-list-row" key={item.currency}>
                      <span>{item.currency}</span><strong>{Number(item.amount).toFixed(2)}</strong>
                    </div>
                  ))}
                  {!report.spending.length ? <p>这个周期没有记录金额。</p> : null}
                </div>
              </div>

              <div className="report-section report-recent">
                <h3>最近入账</h3>
                {report.recentEvents.slice(0, 5).map((event) => (
                  <div className="report-list-row" key={event.id}>
                    <span>{event.title}<small>{eventTypeLabels[event.eventType] ?? event.eventType}</small></span>
                    <time>{formatDate(event.occurredStart)}</time>
                  </div>
                ))}
                {!report.recentEvents.length ? <p>确认记录后，这里会生成周期回顾。</p> : null}
              </div>
            </>
          ) : null}
        </section>
      </div>
      <section className="insight-workbench">
        <div className="page-heading">
          <div><span className="eyebrow">明确表达与系统推断严格分开</span><h2>长期认识与变化</h2></div>
          <small>推断会随证据和时间衰减；只有你确认后才会形成用户声明。</small>
        </div>
        <div className="insight-grid">
          <div className="insight-card">
            <h3>趋势与异常</h3>
            {insights?.trends.filter((trend) => trend.change !== 0).slice(0, 8).map((trend) => (
              <div className="report-list-row" key={trend.eventType}><span>{eventTypeLabels[trend.eventType] ?? trend.eventType}<small>近 7 天 {trend.currentCount}，此前 7 天 {trend.previousCount}</small></span><strong className={trend.change > 0 ? "positive" : "negative"}>{trend.change > 0 ? `+${trend.change}` : trend.change}</strong></div>
            ))}
            {insights?.anomalies.map((anomaly) => <div className="insight-anomaly" key={anomaly.day}>{anomaly.day} 记录 {anomaly.count} 件，高于日常基线 {anomaly.baseline}</div>)}
            {insights && !insights.trends.some((trend) => trend.change !== 0) && !insights.anomalies.length ? <p>积累更多记录后会显示趋势和异常变化。</p> : null}
          </div>
          <div className="insight-card">
            <h3>系统推断</h3>
            {insights?.inferences.filter((inference) => inference.status !== "hidden").map((inference) => (
              <div className={`inference-row ${inference.status}`} key={inference.id}>
                <span><strong>你可能经常接触“{inference.targetName ?? "某个实体"}”</strong><small>{inference.evidence.eventCount ?? 0} 条事件证据 · 置信度 {Math.round(inference.confidence * 100)}% · {inference.inferenceVersion}</small></span>
                {inference.status === "active" ? <div><button className="text-button" type="button" onClick={() => void api.decideInference(inference.id, "hide").then(refreshInsights)}>隐藏</button><button className="text-button danger" type="button" onClick={() => void api.decideInference(inference.id, "reject").then(refreshInsights)}>不准确</button><button className="secondary-button" type="button" onClick={() => void api.decideInference(inference.id, "confirm").then(refreshInsights)}>确认</button></div> : <small>{inference.status === "confirmed" ? "已由你确认" : "已拒绝"}</small>}
              </div>
            ))}
            {!insights?.inferences.length ? <p>同一实体累计至少 3 条事件证据后才会产生推断。</p> : null}
          </div>
          <div className="insight-card assertion-card">
            <h3>我明确表达的声明</h3>
            <form onSubmit={(event) => { event.preventDefault(); if (!assertionEntityId) return; void api.createAssertion({ predicate: assertionPredicate, targetEntityId: assertionEntityId, sourceEventId: null, value: { note: assertionNote.trim(), source: "user_explicit" } }).then(() => { setAssertionNote(""); return refreshInsights(); }).catch((requestError: Error) => setError(requestError.message)); }}>
              <select value={assertionPredicate} onChange={(event) => setAssertionPredicate(event.target.value)}><option value="likes">我喜欢</option><option value="dislikes">我不喜欢</option><option value="important">对我重要</option><option value="avoids">我会避免</option><option value="custom">自定义关系</option></select>
              <select value={assertionEntityId} onChange={(event) => setAssertionEntityId(event.target.value)}><option value="">选择人物或事物</option>{entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.displayName} · {entity.entityType}</option>)}</select>
              <input value={assertionNote} placeholder="补充说明（可选）" onChange={(event) => setAssertionNote(event.target.value)} />
              <button className="secondary-button" type="submit" disabled={!assertionEntityId}>保存声明</button>
            </form>
            {insights?.assertions.filter((assertion) => assertion.status === "active").map((assertion) => <div className="assertion-row" key={assertion.id}><span><strong>{assertion.predicate} · {assertion.targetName ?? "无目标"}</strong><small>{String(assertion.value.note ?? "由用户明确确认")}</small></span><button className="text-button danger" type="button" onClick={() => void api.retractAssertion(assertion.id).then(refreshInsights)}>撤回</button></div>)}
          </div>
        </div>
      </section>
    </section>
  );
}
