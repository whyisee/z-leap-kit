# 外部热榜扫描 Agent 设计

## 1. 目标

外部热榜扫描 Agent 用于从其他网站获取公开趋势信号，帮助社区发现值得讨论的选题。

当前版本已从单一知乎热榜升级为 rebang.today 多源热榜扫描：

- 定时读取 rebang.today 聚合接口中的多个热榜。
- 支持在后台配置多个榜单类型，例如综合今日、百度热搜、IT之家、36氪、今日头条、虎嗅、少数派、微信读书。
- 标准化为站内 `external_hot_items`。
- 按来源、榜单和条目 ID 去重。
- 在 `external_hot_items` 保留条目的最新状态、首次发现和最近发现时间。
- 在 `external_hot_item_snapshots` 保留每次任务运行看到的排名、热度、摘要和原始数据。
- 只入库，不自动发布帖子。

## 2. 为什么不直接自动发帖

热榜内容不等于社区内容。直接把外站热榜改写成帖子，容易变成低价值搬运，也会破坏社区调性。

正确流程应该是：

```text
外部热榜
  -> 入库去重
  -> 选题判断
  -> 资料核查
  -> 生成选题卡或草稿
  -> 人工审核
  -> 发布
```

第一版先完成扫描、入库、趋势总结和单条深度分析。自动生成内容默认仍进入报告或待审核状态，不直接把外站热榜当作社区内容发布。

## 3. 当前实现

新增后台任务：

- `task_key`: `zhihu_hot_scan`
- `task_type`: `external_hot_scan`
- 默认名称：`今日热榜多源扫描`
- 默认状态：`active`
- 默认间隔：`3600` 秒
- 默认来源：`https://api.rebang.today`
- 默认榜单：
  - `top/today | 综合今日`
  - `baidu/realtime | 百度热搜`
  - `ithome/today | IT之家日榜`
  - `36kr/hotlist | 36氪热榜`
  - `toutiao | 今日头条`
  - `huxiu/hot | 虎嗅热文`
  - `sspai/recommend | 少数派推荐`
  - `weread/rising | 微信读书飙升榜`

说明：任务 key 暂时仍保留 `zhihu_hot_scan`，是为了兼容已有数据、后台链接和迁移记录。功能语义已经变为“外部热榜多源扫描”。

新增内容生产任务：

- `task_key`: `zhihu_hot_digest`
- `task_type`: `external_hot_digest`
- 默认名称：`今日热榜总结`
- 默认状态：`paused`
- 默认间隔：`86400` 秒
- 默认逻辑：读取最近 24 小时 rebang.today 多源热榜快照，生成趋势总结报告，并按配置保存为报告、草稿、待审核话题或已发布话题。

单条热榜深度分析：

- 管理员进入“今日热榜多源扫描”的“外部热榜条目”tab。
- 点击某个条目的“深度分析”按钮。
- 系统读取该条目和最近快照，调用 AI 生成深度分析报告。
- 第一版默认只保存为报告，不直接发布为话题。

说明：旧版本曾临时使用 RSSHub 和知乎公开页面作为来源。现在默认改为 rebang.today 的公开聚合接口，原因是它覆盖的热点类型更多，更适合社区选题。代码仍保留 `zhihu_hot` provider，后续如果要单独恢复知乎源，可以在配置中切回。

新增数据表：

- `external_hot_items`: 条目索引表，一条外部内容只保留一行，方便看最新状态和去重。
- `external_hot_item_snapshots`: 运行快照表，每次扫描看到的条目都会写入一行，方便分析排名和热度变化趋势。
- `external_hot_reports`: AI 生成报告表，保存热榜总结和单条深度分析，每次生成都会保留历史记录。

`external_hot_items` 关键字段：

- `source`: 来源，例如 `rebang_today:baidu/realtime`
- `source_item_id`: 来源条目稳定 ID
- `title`: 标题
- `url`: 原始链接
- `summary`: 摘要
- `rank`: 热榜排名
- `heat_text`: 热度文本
- `first_seen_at`: 首次发现时间
- `last_seen_at`: 最近发现时间
- `seen_count`: 被扫描到的次数

`external_hot_item_snapshots` 关键字段：

- `item_id`: 关联 `external_hot_items.id`
- `task_run_id`: 关联本次机器人任务运行
- `rank`: 本次扫描时的热榜排名
- `heat_text`: 本次扫描时的热度文本
- `observed_at`: 本次观测时间
- `raw_json`: 本次来源原始数据

`external_hot_reports` 关键字段：

- `source`: 来源，例如 `rebang_today`
- `report_type`: `digest` 或 `deep_analysis`
- `scope_key`: 报告范围标识，用于后续按天、小时或条目分组
- `item_id`: 单条深度分析时关联的热榜条目
- `task_id` / `task_run_id`: 关联自动任务和运行记录
- `title` / `summary` / `content_markdown`: AI 生成内容
- `status`: `draft`、`pending`、`published`、`failed`
- `topic_id`: 如果已转成站内话题，记录话题 ID
- `input_json` / `output_json`: 保存输入素材和 AI 原始输出，方便追踪质量

## 4. 配置方式

进入后台：

```text
/admin/bot-jobs
```

找到“今日热榜多源扫描”任务后可以配置：

- 状态：启用 / 暂停
- 间隔秒数
- API 地址：默认 `https://api.rebang.today`
- 热榜类型：一行一个，格式为 `tab/sub_tab | 展示名`；没有子榜单时可以写 `tab | 展示名`
- 最大条数
- 超时毫秒
- User-Agent

示例：

```text
top/today | 综合今日
baidu/realtime | 百度热搜
ithome/today | IT之家日榜
36kr/hotlist | 36氪热榜
toutiao | 今日头条
huxiu/hot | 虎嗅热文
sspai/recommend | 少数派推荐
weread/rising | 微信读书飙升榜
```

找到“今日热榜总结”任务后可以配置：

- 状态：启用 / 暂停
- 间隔秒数
- 窗口小时：例如 24 表示分析最近 24 小时
- 最大条数：送给 AI 的候选热榜条目数量
- 最少出现次数：过滤只闪现一次的低稳定性热榜
- 发布方式：只保存报告 / 草稿 / 待审核 / 已发布
- 分类 slug
- 标签
- 写作风格

也可以设置环境变量覆盖默认 API：

```bash
REBANG_TODAY_API_BASE_URL=https://api.rebang.today
```

建议生产环境优先直连公开接口。如果服务器网络无法访问 rebang.today，再考虑配置可控代理源或自建采集器。

## 5. 边界

当前版本不做：

- 不登录知乎。
- 不绕过验证码或访问控制。
- 不抓取需要认证的接口。
- 不默认自动发布话题，除非管理员把发布方式配置为“已发布”。
- 不自动改写外站内容。
- 不抓取外站正文，深度分析只基于公开热榜标题、摘要、热度和站内快照。

如果某个榜单不可用，扫描任务会跳过该榜单并记录失败数；如果所有榜单都不可用，任务会失败并在“最近运行”里记录错误原因。

## 6. 下一步

建议后续增加 5 个能力：

1. 选题卡生成：把热榜条目转成“为什么值得讨论、适合哪个分类、可写什么角度”。
2. 站内查重：生成草稿前先搜索站内是否已有类似主题。
3. 一键转草稿：管理员从外部热榜列表中选择条目，生成待审核草稿。
4. 报告质量反馈：管理员可标记报告是否有用，用于统计不同任务和 prompt 的有效率。
5. 趋势图表：基于 `external_hot_item_snapshots` 展示某个条目的排名和热度变化。
