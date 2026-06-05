# 机器人自动任务调度设计

## 背景

当前机器人任务主要由用户在话题或回复中 `@bot` 触发，系统写入 `bot_jobs` 后由 `scripts/bot-worker.ts` 异步处理。这种模型适合“被点名后回复”，但不适合自动执行的社区运营任务，例如自动审核、无人回复巡检、SEO 优化建议、内容冷启动等。

新的机器人任务管理需要支持两类任务：

- 被动任务：用户 `@bot` 后触发，沿用现有 `bot_jobs`。
- 自动任务：由系统定时或事件触发，不需要用户艾特机器人。

## 设计目标

1. 支持后台配置自动任务启停、频率和策略。
2. 支持 worker 自动领取到期任务并记录运行结果。
3. 自动审核机器人优先落地，先处理 `pending` 话题。
4. AI 审核结果独立保存，便于后续统计准确率和回放。
5. 第一版避免高风险自动处置：低风险可自动通过，高风险进入人工复核。

## 数据模型

### bot_tasks

存储自动任务配置。

| 字段 | 说明 |
| --- | --- |
| `task_key` | 稳定任务标识，例如 `auto_review_pending_topics` |
| `task_type` | 任务类型，例如 `auto_review` |
| `bot_user_id` | 执行任务的机器人用户，自动审核默认使用 `mod` |
| `trigger_type` | `schedule`、`event`、`manual` |
| `status` | `active`、`paused` |
| `schedule_interval_seconds` | 调度间隔 |
| `config_json` | 任务策略配置 |
| `next_run_at` | 下次执行时间 |
| `locked_at` | worker 锁，防止并发重复执行 |
| `last_run_at` / `last_status` | 最近运行状态 |

### bot_task_runs

记录每次任务运行。

| 字段 | 说明 |
| --- | --- |
| `task_id` | 对应 `bot_tasks.id` |
| `run_key` | 运行唯一标识 |
| `status` | `running`、`succeeded`、`failed` |
| `input_summary` | 本次扫描或输入摘要 |
| `output_summary` | 本次运行结果摘要 |
| `error` | 错误信息 |
| `metrics_json` | 处理数量、自动通过数量、人工复核数量等 |

### content_review_results

保存 AI 审核结果。

| 字段 | 说明 |
| --- | --- |
| `target_type` / `target_id` | 审核对象，第一版只支持 `topic` |
| `content_hash` | 内容指纹，用于避免重复审核同一版本 |
| `decision` | `approve`、`needs_human`、`reject` |
| `risk_score` | 0-100 风险分 |
| `reasons_json` | 原因列表 |
| `raw_result_json` | AI 原始结构化结果 |
| `result_status` | `suggested`、`applied`、`needs_human`、`failed` |
| `applied_at` | 自动执行时间 |

## 自动审核机器人流程

1. 普通用户提交话题，话题状态仍为 `pending`。
2. `bot-worker` 每轮先检查到期自动任务。
3. 自动审核任务扫描待审核话题。
4. 对未审核过的内容版本调用默认 AI 模型。
5. AI 必须返回 JSON：

```json
{
  "decision": "approve",
  "riskScore": 12,
  "reasons": ["内容完整", "未发现广告或辱骂"],
  "publicNote": "内容已通过审核",
  "moderatorNote": "低风险，可自动发布"
}
```

6. 当 `decision = approve` 且 `riskScore <= autoApproveMaxRisk` 且未开启 dry run 时，系统自动发布话题。
7. 其它结果保留 `pending`，写入审核结果，供管理员人工处理。

## 默认策略

```json
{
  "scope": "pending_topics",
  "batchSize": 5,
  "autoApproveMaxRisk": 25,
  "dryRun": false
}
```

## 后台页面

`/admin/bot-jobs` 扩展为三个区域：

- 自动任务：查看任务状态、频率、策略，支持暂停、启用、立即运行。
- AI 审核结果：展示最近审核对象、决策、风险分、是否已自动执行。
- 提及任务队列：保留原有 `@bot` 触发任务列表和手动处理下一条。

## 调度运行方式

默认情况下，Web 服务收到请求后会启动应用内轻量调度器：

- `BOT_SCHEDULER_ENABLED=0`：关闭应用内调度器。
- `BOT_SCHEDULER_INTERVAL_MS=5000`：调度器轮询间隔。
- `BOT_SCHEDULER_TASK_LIMIT=1`：每轮最多处理几个自动任务。

生产环境也可以关闭应用内调度器，改用独立 worker：

```bash
BOT_SCHEDULER_ENABLED=0 npm run start
BOT_WORKER_LOOP=1 npm run bot:worker
```

2C2G VPS 第一版可以先使用应用内调度器，减少部署复杂度。后续任务量变大后，再拆独立 worker。

## TODO

- [x] 新增自动任务、运行记录、审核结果表。
- [x] 初始化 `auto_review_pending_topics` 默认任务。
- [x] 扩展 worker，先处理到期自动任务，再处理提及任务。
- [x] Web 服务内置轻量调度器，避免必须手动启动独立 worker。
- [x] 实现 pending 话题自动审核。
- [x] 后台展示自动任务和审核结果。
- [ ] 后台支持修改更多审核策略字段。
- [ ] 支持回复、编辑内容的自动审核。
- [ ] 审核结果支持人工确认“AI 判断正确/错误”。
- [ ] 统计 AI 审核准确率、自动通过率、节省人工次数。
- [ ] 支持事件触发：新话题提交后立即入队审核。
- [ ] 支持更多自动任务：无人回复巡检、SEO 建议、内容冷启动、重复内容检测。
