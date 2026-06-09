# whyisee.xyz 左侧三入口与个性化推荐完整设计文档

更新日期：2026-06-09

## 1. 文档目标

本文档设计 `whyisee-community` 页面左侧新增三个主菜单入口：

- 看见：首页推荐。
- 出发：值得参与。
- 关注：用户关注。

这三个入口不是普通导航文字调整，而是社区从“最新话题流”升级为“个性化内容发现 + 社区参与 + 关注订阅”的核心入口。

设计目标：

- 左侧导航顶部固定出现三个主入口，下面继续保留现有分类和标签。
- `看见` 承担个性化首页推荐，让用户快速看到值得看的内容。
- `出发` 承担参与推荐，让用户知道自己可以回复、点评、补充、领取或共创什么。
- `关注` 承担订阅流，让用户持续跟进自己关注的人、话题、分类和标签。
- 推荐系统要记住用户喜好，但排序必须同时考虑内容质量、社区价值和用户控制权。
- 设计要贴合当前 Astro SSR、Hono API、PostgreSQL、自研社区模型，不另起一套抽象系统。

## 2. 当前项目上下文

### 2.1 已有页面结构

当前前台页面已经使用三栏论坛布局：

```text
BaseLayout
  -> SiteHeader
  -> ForumFrame
       -> LeftNav
       -> content-column
       -> Sidebar 可选
```

相关文件：

```text
whyisee-community/app/src/layouts/BaseLayout.astro
whyisee-community/app/src/components/ForumFrame.astro
whyisee-community/app/src/components/LeftNav.astro
whyisee-community/app/src/components/TopicCard.astro
whyisee-community/app/src/components/TopicListHeader.astro
whyisee-community/app/src/styles/modules/forum-layout.css
whyisee-community/app/src/styles/modules/responsive.css
```

现有左侧栏 `LeftNav.astro` 只展示：

- 分类。
- 标签。

现有首页 `/` 是最新话题页，支持：

- 分类筛选。
- 标签筛选。
- 最新、排行榜、热门排序。

相关文件：

```text
whyisee-community/app/src/pages/index.astro
whyisee-community/app/src/pages/latest.astro
whyisee-community/app/src/pages/c/[slug].astro
whyisee-community/app/src/pages/tag/[slug].astro
whyisee-community/app/src/pages/projects.astro
```

### 2.2 已有数据能力

当前数据库已经有这些推荐系统可以直接复用的表：

```text
topics
posts
categories
tags
topic_tags
reactions
bookmarks
follows
notifications
reports
page_views
user_reputation
user_contribution_events
tasks
task_assignments
task_submissions
task_reviews
reward_ledger
content_review_results
external_hot_items
external_hot_reports
bot_tasks
```

关键现状：

- `topics.type` 已支持 `discussion`、`question`、`article`、`project`、`resource`、`announcement`。
- `topics.view_count`、`topics.reply_count` 可作为热度基础。
- `topics.is_pinned`、`topics.is_featured` 可作为内容质量和编辑推荐基础。
- `reactions`、`bookmarks` 是用户强兴趣信号。
- `follows` 已支持 `topic`、`post`、`category`、`tag`、`user` 这类目标类型，但前台目前主要在话题详情使用关注话题。
- `reports`、`content_review_results` 可作为风险和质量降权依据。
- `tasks` 已经具备通用任务模型字段，但当前管理界面主要面向 Agent 专区任务。
- `page_views` 记录访问路径，但没有明确目标类型、停留时长和推荐来源，不足以独立支撑个性化推荐。

### 2.3 当前设计要解决的问题

现有信息流按最新、浏览量、回复量排序，能解决“社区有什么新内容”，但不能解决：

- 用户每次回来都看到自己真正关心的内容。
- 用户知道自己应该参与哪里。
- 用户关注的主题、分类、标签和作者有统一订阅流。
- 系统持续记住用户的长期兴趣和短期意图。
- 推荐结果可解释、可反馈、可降噪。

三个新入口正好对应这三个核心问题。

## 3. 三个入口的产品定义

### 3.1 看见

入口文案：

```text
看见
首页推荐
```

用户意图：

> 我想快速看到今天值得看的内容，以及和我兴趣相关的高质量内容。

页面目标：

- 替代单纯最新话题流，成为主首页。
- 推荐用户可能感兴趣的内容。
- 保留社区精选、热门、新内容，避免用户被困在单一兴趣里。
- 对新用户和未登录用户给出稳定、高质量、可浏览的默认内容。

推荐对象：

- 话题。
- 文章。
- 项目。
- 资源。
- 问题。
- 精选内容。
- 外部热点报告转化后的社区内容。

不推荐：

- 低质量 AI 水文。
- 被举报未处理内容。
- 已隐藏或删除内容。
- 用户明确点过“不感兴趣”的同类内容。
- 用户已经反复看过但没有互动的重复内容。

### 3.2 出发

入口文案：

```text
出发
值得参与
```

用户意图：

> 我想知道现在有哪些地方需要我动手参与、回复、点评、补充或共创。

页面目标：

- 把用户从“看内容”引导到“参与社区”。
- 推荐用户可能有能力参与的内容缺口。
- 让项目展示、问题帖、资源补充、任务系统和专题共创形成统一入口。
- 提升回复率、项目反馈率、问题解决率和任务完成率。

推荐对象：

- 待回答问题。
- 零回复或低回复高价值话题。
- 需要反馈的项目展示帖。
- 需要补充的资源帖。
- 需要更新的文档或教程。
- 可领取的社区任务。
- 用户擅长领域内的讨论。
- 被 AI 或管理员标记为“需要人工判断”的内容。

不推荐：

- 已经完成或关闭的任务。
- 用户无法参与的 Agent 专区内部任务。
- 用户被屏蔽作者的内容。
- 用户已经提交过结果且不需要继续处理的内容。
- 低价值灌水帖。

### 3.3 关注

入口文案：

```text
关注
用户关注
```

用户意图：

> 我想跟进自己关注的人、话题、分类、标签和项目的更新。

页面目标：

- 形成用户自己的订阅流。
- 统一展示关注对象的新增内容、回复、更新和任务动态。
- 让用户能管理关注源，减少噪音。
- 与通知中心区分：通知是事件提醒，关注是主动浏览的订阅流。

推荐对象：

- 关注话题的新回复。
- 关注作者的新话题。
- 关注分类的新话题。
- 关注标签的新话题。
- 关注项目的新进展。
- 关注主题相关的精选内容。

不推荐：

- 不属于用户关注源的普通热门内容。
- 已删除、隐藏、待审核内容。
- 用户已屏蔽作者的内容。

## 4. 左侧导航信息架构

左侧栏调整为：

```text
主入口
  看见    首页推荐
  出发    值得参与
  关注    用户关注

分类
  AI
  小A
  读书
  沙雕
  福利
  资源
  文档
  项目
  树洞

标签
  Cursor
  Codex
  AI Agent
  SEO
  ...
```

主入口必须放在最顶部。分类和标签仍然是筛选和探索入口，不要和主入口混在同一个列表里。

### 4.1 路由设计

推荐使用：

```text
/             最近笔记
/see          看见，直接打开一篇推荐内容
/go           出发，值得参与
/following    关注，用户关注
```

这样有几个好处：

- `/` 保留首页地位，展示最近笔记和最新内容列表。
- `/see` 是“看见”推荐阅读入口，直接跳转到一篇推荐话题。
- `/go` 短、好记，和“出发”语义一致。
- `/following` 和已有 `follows` 表语义一致。
- `/latest` 继续承担传统列表浏览和最新话题入口。
- 未来需要英文界面时也不需要换路由。

### 4.2 导航激活规则

```text
当前路径 /see：
  看见 is-active，aria-current="page"

当前路径 /go：
  出发 is-active，aria-current="page"

当前路径 /following：
  关注 is-active，aria-current="page"

当前路径 /c/:slug：
  对应分类 is-active

当前路径 /tag/:slug：
  对应标签 is-active
```

`/` 展示最近笔记，不激活三大主入口；分类、标签和最新列表浏览交给 `/latest`、分类页和标签页承载。

### 4.3 计数展示

主入口右侧可以展示小计数，但不强制每个入口都有。

```text
看见：今日新推荐数量，或空。
出发：当前可参与项数量。
关注：关注源未读更新数量。
```

未登录时：

```text
看见：展示空计数。
出发：展示社区公开可参与项数量。
关注：不展示计数，点击后进入登录提示或公开关注说明。
```

### 4.4 移动端行为

现有移动端左侧栏已经是固定抽屉：

```css
.left-nav {
  position: fixed;
  top: 66px;
  bottom: 12px;
}
```

新增主入口应跟随左侧抽屉显示，不额外做底部 Tab，避免导航重复。主入口高度要稳定，不能因为计数变化导致布局跳动。

## 5. 看见页面设计

### 5.1 页面结构

`/see` 不渲染推荐列表页面，而是作为服务端推荐入口：

```text
访问 /see
  -> 调用 listSeeRecommendations({ sort: "recommend", limit: 50 })
  -> 跳过 whyisee_see_recent_topics 中最近从看见入口打开过的文章
  -> 记录 see 推荐曝光
  -> 记录 see 推荐点击
  -> 302 跳转到第一篇推荐话题 /t/:id
```

没有推荐内容时：

```text
优先跳转最新话题
如果站内没有话题，则跳转 /latest
```

这个调整让“看见”从“列表页”变成“打开一篇值得看的内容”，更接近沉浸阅读入口。

传统列表浏览仍由这些页面承载：

```text
/latest
/c/:slug
/tag/:slug
```

### 5.2 看见推荐事件

`/see` 作为推荐入口时，需要写入两类信号：

- `recommendation_impressions`：记录本次服务端候选队列，surface 为 `see`。
- `user_content_events`：记录第一篇推荐内容的 `recommendation_click`，source surface 为 `see`。
- `whyisee_see_recent_topics`：记录最近从“看见”入口打开过的 24 篇，避免入口连续打开同一篇文章。

数据结构：

```ts
interface RecommendedTopic extends Topic {
  recommendation?: {
    surface: "see" | "go" | "following";
    score: number;
    reasons: string[];
  };
}
```

`TopicCard.astro` 增加可选 props：

```ts
interface Props {
  topic: Topic | RecommendedTopic;
  lang: Lang;
  latestOrder?: number;
  showRecommendationReason?: boolean;
}
```

### 5.3 看见推荐排序

看见页排序目标：

> 用户可能愿意阅读、收藏或继续探索的高质量内容。

评分公式：

```text
see_score =
  interest_match_score * 0.32
  + quality_score * 0.24
  + freshness_score * 0.14
  + engagement_score * 0.12
  + editorial_score * 0.08
  + exploration_score * 0.06
  - seen_penalty
  - negative_feedback_penalty
  - risk_penalty
```

字段解释：

- `interest_match_score`：用户兴趣画像和内容分类、标签、作者、类型的匹配度。
- `quality_score`：精选、收藏、点赞、长回复、审核结果、作者声誉综合。
- `freshness_score`：新内容和最近活跃内容加分。
- `engagement_score`：浏览、回复、收藏、点赞综合，不让浏览量单独决定排序。
- `editorial_score`：置顶、精选、管理员推荐、Bot 高质量报告转化内容。
- `exploration_score`：少量非强匹配但质量高的内容，避免单一兴趣。
- `seen_penalty`：用户已经看过且没有互动的内容降权。
- `negative_feedback_penalty`：不感兴趣、举报、屏蔽相关内容降权。
- `risk_penalty`：审核风险、举报未处理、内容质量低降权。

### 5.4 阅读推荐

话题详情页的沉浸阅读翻篇不再使用简单的同分类相关内容，而是使用独立推荐场景：

```text
surface = reading
```

阅读推荐服务：

```text
listReadingRecommendations({
  topic,
  userId,
  lang,
  limit,
  excludeTopicIds
})
```

阅读推荐目标：

> 用户读完当前内容后，下一篇应该既能承接当前上下文，又能逐步学习用户兴趣，并避免短时间重复阅读。

阅读推荐排序：

```text
reading_score =
  reading_affinity_score * 0.36
  + interest_match_score * 0.22
  + quality_score * 0.18
  + freshness_score * 0.10
  + engagement_score * 0.08
  + exploration_score * 0.04
  + editorial_boost
  - already_interacted_penalty
  - negative_feedback_penalty
  - risk_penalty
```

字段解释：

- `reading_affinity_score`：当前话题与候选话题在分类、标签、内容类型、作者和标题摘要关键词上的相似度。
- `interest_match_score`：复用用户兴趣画像，考虑分类、标签、作者、内容类型和关注源。
- `quality_score`：复用内容质量评分，考虑精选、收藏、点赞、回复、浏览和举报。
- `freshness_score`：新发布或最近活跃内容加分。
- `engagement_score`：回复、浏览、点赞、收藏综合热度。
- `exploration_score`：质量高但不完全相似的内容保留少量探索机会。
- `editorial_boost`：精选和置顶小幅加分。
- `already_interacted_penalty`：已回复、已收藏、已点赞内容降权。
- `negative_feedback_penalty`：不感兴趣、举报、屏蔽相关内容降权。
- `risk_penalty`：举报和审核风险降权。

阅读推荐去重：

- 当前话题永远排除。
- 调用方传入的 `excludeTopicIds` 排除。
- 登录用户最近 14 天内已经 `view`、`dwell`、`recommendation_click` 的话题排除。
- 前端沉浸阅读使用 `sessionStorage` 维护本次阅读的后退栈和前进栈。
- 下滑时优先取前进栈中的“刚才看过的下一章”，前进栈为空时才进入新的推荐下一篇。
- 上滑返回只从后退栈取“看过的上一章”，后退栈为空时提示“上面没有了”。
- 新推荐下一篇仍会跳过本次后退栈里已经经过的文章，避免无意重复。

阅读推荐行为信号：

- 进入话题页记录 `view`。
- 推荐候选队列记录 `recommendation_impressions`，surface 为 `reading`。
- 下滑进入下一篇记录 `recommendation_click`，source surface 为 `reading`。
- 停留超过 8 秒记录 `dwell`。

阅读推荐接口：

```text
GET /api/recommendations/reading?topicId=85&limit=12&exclude=84,83
```

返回内容包括：

```ts
{
  targetType: "topic";
  targetId: number;
  href: string;
  title: string;
  summary: string;
  category: Category;
  tags: Tag[];
  score: number;
  reasons: string[];
}
```

## 6. 出发页面设计

### 6.1 页面结构

`/go` 页面标题：

```text
出发
这里是你现在最值得参与的讨论、项目、问题和任务。
```

页面主体：

```text
顶部筛选区
  全部
  待回答
  求反馈
  可领取
  可补充
  可更新

参与列表
  ParticipationCard[]

右侧或顶部统计
  待回答问题数
  求反馈项目数
  可领取任务数
  你擅长领域匹配数
```

页面不要做成任务后台，也不要做成 Agent 专区。它是面向普通社区用户的参与入口。

### 6.2 出发推荐对象

推荐项统一抽象为：

```ts
type ParticipationTargetType =
  | "question"
  | "topic"
  | "project"
  | "resource"
  | "community_task"
  | "review_needed"
  | "stale_content";

interface ParticipationRecommendation {
  targetType: ParticipationTargetType;
  targetId: number;
  title: string;
  summary: string;
  href: string;
  actionLabel: string;
  reason: string;
  category?: Category;
  tags: Tag[];
  score: number;
  stats: {
    replyCount?: number;
    viewCount?: number;
    submissionCount?: number;
    rewardLabel?: string;
  };
}
```

### 6.3 出发参与类型

#### 待回答

来源：

```text
topics.type = 'question'
topics.status = 'published'
topics.reply_count = 0 或回复很少
```

动作：

```text
去回答
```

加分：

- 和用户兴趣标签匹配。
- 问题有清楚背景。
- 浏览量高但回复少。
- 作者不是被用户屏蔽对象。

#### 求反馈

来源：

```text
topics.type = 'project'
或 category.slug = 'projects'
或 tag.slug IN ('feedback', 'project-showcase', 'user-feedback')
```

动作：

```text
去点评
```

加分：

- 用户过去评论过项目展示。
- 用户关注相关标签。
- 项目最近发布且反馈少。
- 作者声誉正常。

#### 可领取

来源：

```text
tasks.visibility = 'public_community'
tasks.executor_type IN ('user', 'any')
tasks.status = 'open'
```

动作：

```text
领取任务
```

说明：

当前后台任务创建主要面向 `agent_zone`，但 `tasks` 表本身已有 `visibility`、`executor_type`、`human_interaction_mode`、`result_destination`，可以直接支持社区任务。`出发` 只展示人类可执行任务，不展示纯 Agent 内部任务。

#### 可补充

来源：

```text
topics.type IN ('resource', 'article')
或 category.slug IN ('resources', 'docs')
且内容被标记为需要补充
```

动作：

```text
补充资源
```

标记来源：

- 管理员手动标记。
- BotTask 识别内容缺口。
- 用户评论中出现补充请求。
- 搜索无结果转化出的内容缺口。

#### 可更新

来源：

```text
content_review_results.result_status = 'suggested'
或 content_quality_signals.stale_score 高
或 topics.updated_at 距今较久且属于工具、教程、资源类
```

动作：

```text
更新内容
```

适合内容：

- AI 工具教程。
- 部署指南。
- SEO 工具说明。
- 资源清单。
- 项目状态更新。

### 6.4 出发排序

出发页排序目标：

> 用户有能力参与，并且参与后对社区最有价值。

评分公式：

```text
go_score =
  user_ability_match_score * 0.30
  + participation_need_score * 0.26
  + community_value_score * 0.20
  + freshness_score * 0.10
  + reward_score * 0.06
  + relationship_score * 0.04
  + exploration_score * 0.04
  - already_participated_penalty
  - blocked_or_hidden_penalty
  - risk_penalty
```

字段解释：

- `user_ability_match_score`：用户过去发帖、回复、收藏、关注的分类和标签是否匹配。
- `participation_need_score`：零回复、低回复、待审核、待补充、待更新、任务空缺。
- `community_value_score`：被浏览、收藏、关注多但缺少回答或更新的内容优先。
- `freshness_score`：新问题、新项目、新任务加分。
- `reward_score`：有贡献值、勋章、积分或明确反馈价值的任务加分。
- `relationship_score`：来自用户关注作者、关注主题、互动过对象的内容小幅加分。
- `already_participated_penalty`：用户已回复、已提交、已领取的内容降权。

### 6.5 出发卡片设计

卡片内容：

```text
类型标签：待回答 / 求反馈 / 可领取 / 可补充 / 可更新
标题
摘要
分类和标签
推荐原因
关键数据：0 回复、12 浏览、2 人收藏、奖励 20 贡献值
主动作按钮
```

主动作按钮：

```text
去回答
去点评
领取任务
补充资源
更新内容
```

未登录用户点击动作时跳转：

```text
/login?redirect=/go
```

## 7. 关注页面设计

### 7.1 页面结构

`/following` 页面标题：

```text
关注
来自你关注的人、话题、分类和标签的更新。
```

页面主体：

```text
顶部筛选区
  全部
  话题
  作者
  分类
  标签

关注动态流
  FollowingFeedItem[]

关注源管理
  我关注的话题
  我关注的作者
  我关注的分类
  我关注的标签
```

### 7.2 关注源

当前 `follows` 表结构：

```text
user_id
target_type
target_id
created_at
```

建议支持这些关注源：

```text
topic
user
category
tag
project
```

其中 `project` 可以先复用 `topic`，即项目展示帖本质仍是 `topics.type = 'project'`。

### 7.3 关注动态

动态来源：

#### 关注话题

```text
用户 follow topic
展示该 topic 的新回复、更新、精选状态变化
```

#### 关注作者

```text
用户 follow user
展示该用户发布的新话题、新项目、新资源
```

#### 关注分类

```text
用户 follow category
展示该分类的新话题和精选话题
```

#### 关注标签

```text
用户 follow tag
展示带该标签的新话题和精选话题
```

### 7.4 关注排序

关注页排序目标：

> 用户关注源中的最近重要更新。

评分公式：

```text
following_score =
  recency_score * 0.36
  + follow_strength_score * 0.24
  + quality_score * 0.18
  + interaction_score * 0.10
  + unread_score * 0.08
  + diversity_score * 0.04
  - seen_penalty
  - muted_source_penalty
```

字段解释：

- `recency_score`：关注页以时间敏感为主。
- `follow_strength_score`：关注对象越明确越强，topic > user > tag > category。
- `quality_score`：精选、高收藏、高声誉作者加分。
- `interaction_score`：用户曾与该作者或话题互动过加分。
- `unread_score`：用户关注后新产生的内容优先。
- `diversity_score`：避免一个关注源刷满整页。

### 7.5 关注管理

需要补齐前台关注动作：

- 分类页支持关注分类。
- 标签页支持关注标签。
- 用户主页支持关注用户。
- 项目展示帖复用关注话题。

现有接口：

```text
POST /api/interactions/follow
```

这个接口已经支持泛目标类型，可以继续复用，但前端需要在分类、标签、用户页增加表单按钮。

关注页需要新增：

```text
POST /api/interactions/unfollow
```

也可以继续用现有 toggle follow，但关注管理列表中要明确文案为“取消关注”。

## 8. 记住用户喜好的设计

### 8.1 为什么现有 page_views 不够

当前 `page_views` 记录：

```text
path
method
user_id
ip_hash
user_agent
referrer
created_at
```

这适合做后台访问统计，但不适合个性化推荐，因为它缺少：

- 目标类型。
- 目标 ID。
- 事件类型。
- 内容分类。
- 内容标签。
- 停留时长。
- 推荐来源。
- 是否点击推荐结果。
- 用户负反馈。

因此需要新增行为事件表。

### 8.2 行为事件

新增表：

```sql
CREATE TABLE IF NOT EXISTS user_content_events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  anonymous_key TEXT,
  event_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  source_surface TEXT NOT NULL DEFAULT '',
  source_reason TEXT NOT NULL DEFAULT '',
  category_id INTEGER,
  tag_slugs_json TEXT NOT NULL DEFAULT '[]',
  topic_type TEXT NOT NULL DEFAULT '',
  author_id INTEGER,
  dwell_seconds INTEGER,
  weight INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_user_content_events_user_created
  ON user_content_events(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_content_events_target
  ON user_content_events(target_type, target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_content_events_surface
  ON user_content_events(source_surface, created_at DESC);
```

事件类型：

```text
view
dwell
search_click
recommendation_click
like
bookmark
reply
topic_create
follow
hide
dismiss
report
block
task_claim
task_submit
```

权重建议：

```text
view: +1
dwell_30s: +2
dwell_120s: +4
search_click: +5
recommendation_click: +4
like: +5
bookmark: +9
reply: +10
topic_create: +12
follow: +14
task_claim: +10
task_submit: +16
hide: -12
dismiss: -6
report: -18
block: -30
```

### 8.3 用户兴趣画像

新增表：

```sql
CREATE TABLE IF NOT EXISTS user_interest_profiles (
  user_id INTEGER PRIMARY KEY,
  category_weights_json TEXT NOT NULL DEFAULT '{}',
  tag_weights_json TEXT NOT NULL DEFAULT '{}',
  topic_type_weights_json TEXT NOT NULL DEFAULT '{}',
  author_weights_json TEXT NOT NULL DEFAULT '{}',
  long_term_json TEXT NOT NULL DEFAULT '{}',
  short_term_json TEXT NOT NULL DEFAULT '{}',
  negative_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

画像结构：

```ts
interface UserInterestProfile {
  userId: number;
  categoryWeights: Record<string, number>;
  tagWeights: Record<string, number>;
  topicTypeWeights: Record<TopicType, number>;
  authorWeights: Record<string, number>;
  longTerm: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    topicTypes: Record<string, number>;
  };
  shortTerm: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    topicTypes: Record<string, number>;
    windowHours: number;
  };
  negative: {
    categories: Record<string, number>;
    tags: Record<string, number>;
    authors: Record<string, number>;
    topicTypes: Record<string, number>;
  };
  updatedAt: string;
}
```

### 8.4 长期兴趣和短期意图

长期兴趣来自：

- 收藏。
- 关注。
- 长时间阅读。
- 频繁回复。
- 发帖分类和标签。
- 任务提交。

短期意图来自：

- 最近 24 到 72 小时阅读。
- 最近搜索点击。
- 最近连续浏览的标签。
- 最近在某个分类内的互动。

混合公式：

```text
interest_match_score =
  long_term_match * 0.58
  + short_term_match * 0.34
  + explicit_follow_match * 0.08
```

看见页短期权重可以稍低，出发页短期权重可以稍高，因为用户最近看的内容更可能代表他当前能参与什么。

### 8.5 负反馈

必须提供负反馈，否则推荐系统只会越推越偏。

前台动作：

```text
不感兴趣
减少此类内容
屏蔽作者
举报
取消关注
```

负反馈进入 `user_content_events` 和 `user_interest_profiles.negative_json`。

## 9. 内容质量信号

推荐不能只记住用户喜欢什么，还要判断什么内容值得被推荐。

新增表：

```sql
CREATE TABLE IF NOT EXISTS content_quality_signals (
  id SERIAL PRIMARY KEY,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  quality_score INTEGER NOT NULL DEFAULT 50,
  freshness_score INTEGER NOT NULL DEFAULT 50,
  engagement_score INTEGER NOT NULL DEFAULT 0,
  participation_need_score INTEGER NOT NULL DEFAULT 0,
  verified_score INTEGER NOT NULL DEFAULT 0,
  risk_penalty INTEGER NOT NULL DEFAULT 0,
  stale_score INTEGER NOT NULL DEFAULT 0,
  computed_from_json TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL,
  UNIQUE (target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_content_quality_signals_quality
  ON content_quality_signals(target_type, quality_score DESC, computed_at DESC);
```

质量来源：

- `topics.is_featured`
- `topics.is_pinned`
- `topics.reply_count`
- `topics.view_count`
- `reactions`
- `bookmarks`
- `reports`
- `content_review_results`
- `user_reputation`
- 内容是否有摘要、标签、分类和清楚结构
- 作者是否被频繁举报
- 是否存在过期风险

质量分建议：

```text
基础分 50
精选 +18
置顶 +10
收藏多 +10
有高质量回复 +8
作者声誉高 +6
内容结构完整 +6
举报未处理 -30
审核风险高 -25
疑似过期 -12
纯 AI 水文风险 -20
```

## 10. 推荐曝光和反馈闭环

新增表：

```sql
CREATE TABLE IF NOT EXISTS recommendation_impressions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER,
  anonymous_key TEXT,
  surface TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER NOT NULL,
  rank INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  reasons_json TEXT NOT NULL DEFAULT '[]',
  clicked_at TEXT,
  dismissed_at TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_recommendation_impressions_user_surface
  ON recommendation_impressions(user_id, surface, created_at DESC);
```

用途：

- 避免短时间内反复推荐同一内容。
- 统计不同推荐面的点击率。
- 支持“为什么推荐给我”。
- 支持用户点“不感兴趣”后回写负反馈。

`surface` 值：

```text
see
go
following
related
search
```

## 11. 服务层设计

新增服务文件：

```text
whyisee-community/app/src/server/services/recommendations.ts
```

核心函数：

```ts
export async function listSeeRecommendations(input: {
  userId?: number;
  lang: Lang;
  categorySlug?: string;
  tagSlug?: string;
  sort?: "recommend" | "latest" | "hot" | "featured";
  limit?: number;
  offset?: number;
}): Promise<RecommendedTopic[]>;

export async function listParticipationRecommendations(input: {
  userId?: number;
  lang: Lang;
  filter?: "all" | "questions" | "feedback" | "tasks" | "supplement" | "stale";
  limit?: number;
  offset?: number;
}): Promise<ParticipationRecommendation[]>;

export async function listFollowingFeed(input: {
  userId: number;
  lang: Lang;
  filter?: "all" | "topics" | "users" | "categories" | "tags";
  limit?: number;
  offset?: number;
}): Promise<FollowingFeedItem[]>;

export async function recordUserContentEvent(input: {
  userId?: number;
  anonymousKey?: string;
  eventType: string;
  targetType: string;
  targetId: number;
  sourceSurface?: string;
  sourceReason?: string;
  dwellSeconds?: number;
  metadata?: Record<string, unknown>;
}): Promise<void>;

export async function refreshUserInterestProfile(userId: number): Promise<void>;

export async function computeContentQualitySignals(input?: {
  targetType?: string;
  targetId?: number;
}): Promise<void>;
```

### 11.1 看见查询策略

候选池：

```text
1. 用户兴趣匹配内容
2. 用户关注源相关内容
3. 社区精选内容
4. 最近热门内容
5. 最新高质量内容
6. 少量探索内容
```

查询时先取候选，再在服务层统一评分。不要在 SQL 里写完整推荐逻辑，否则后续不好调。

### 11.2 出发查询策略

候选池：

```text
1. question 类型且回复少的话题
2. project 类型且需要反馈的话题
3. resource/docs 内容中需要补充的话题
4. public_community 且 user/any 可执行的 open 任务
5. 质量高但缺少回复的讨论
6. 被 BotTask 标记需要人工判断的内容
```

### 11.3 关注查询策略

先读取用户关注源：

```sql
SELECT target_type, target_id, created_at
FROM follows
WHERE user_id = $1
```

再构造动态：

- 关注 topic：查该 topic 的新回复和更新。
- 关注 user：查该用户新发布 topics。
- 关注 category：查该分类新 topics。
- 关注 tag：查带该标签新 topics。

关注页不需要推荐非关注内容，空状态除外。

## 12. API 设计

新增接口：

```text
GET /api/recommendations/see
GET /api/recommendations/go
GET /api/recommendations/following
POST /api/recommendations/events
POST /api/recommendations/feedback
```

页面 SSR 可以直接调用服务层。API 用于：

- 前端懒加载更多。
- 记录曝光、点击、停留、负反馈。
- 后续 Agent 或移动端复用。

### 12.1 GET /api/recommendations/see

参数：

```text
sort=recommend|latest|hot|featured
category=ai
tag=codex
limit=30
offset=0
```

返回：

```json
{
  "items": [
    {
      "targetType": "topic",
      "targetId": 123,
      "title": "Codex 自动化内容审核怎么设计",
      "href": "/t/123",
      "summary": "结合社区内容质量和 Agent 任务的设计记录。",
      "score": 87,
      "reasons": ["因为你关注 #Codex", "社区精选"]
    }
  ]
}
```

### 12.2 GET /api/recommendations/go

参数：

```text
filter=all|questions|feedback|tasks|supplement|stale
limit=30
offset=0
```

返回：

```json
{
  "items": [
    {
      "targetType": "question",
      "targetId": 456,
      "title": "Open VSX 插件发布后没人下载该怎么排查",
      "href": "/t/456",
      "actionLabel": "去回答",
      "reason": "你经常浏览 Cursor 插件和 Open VSX 内容",
      "score": 91
    }
  ]
}
```

### 12.3 GET /api/recommendations/following

登录后可用。

返回：

```json
{
  "items": [
    {
      "sourceType": "tag",
      "sourceLabel": "#Codex",
      "targetType": "topic",
      "targetId": 789,
      "title": "Codex 在 Astro 项目里的工作流复盘",
      "href": "/t/789",
      "meta": "12 分钟前"
    }
  ]
}
```

### 12.4 POST /api/recommendations/events

记录事件：

```json
{
  "eventType": "recommendation_click",
  "targetType": "topic",
  "targetId": 123,
  "sourceSurface": "see",
  "sourceReason": "tag:codex"
}
```

### 12.5 POST /api/recommendations/feedback

记录负反馈：

```json
{
  "feedback": "hide",
  "targetType": "topic",
  "targetId": 123,
  "sourceSurface": "see"
}
```

## 13. 页面和组件改造清单

### 13.1 LeftNav.astro

文件：

```text
whyisee-community/app/src/components/LeftNav.astro
```

新增主入口 section：

```astro
<details class="left-nav-section primary-nav-section" open>
  <summary>
    <span>主入口</span>
    <span class="nav-section-chevron" aria-hidden="true">›</span>
  </summary>
  <div class="compact-list nav-list primary-nav-list">
    <a class:list={["nav-item primary-nav-item", activePrimary === "see" && "is-active"]} href="/" aria-current={activePrimary === "see" ? "page" : undefined}>
      <span class="nav-item-main">
        <span class="nav-item-marker primary-marker see-marker" aria-hidden="true"></span>
        <span class="nav-item-label-stack">
          <strong>看见</strong>
          <span>首页推荐</span>
        </span>
      </span>
    </a>
    <a class:list={["nav-item primary-nav-item", activePrimary === "go" && "is-active"]} href="/go" aria-current={activePrimary === "go" ? "page" : undefined}>
      <span class="nav-item-main">
        <span class="nav-item-marker primary-marker go-marker" aria-hidden="true"></span>
        <span class="nav-item-label-stack">
          <strong>出发</strong>
          <span>值得参与</span>
        </span>
      </span>
    </a>
    <a class:list={["nav-item primary-nav-item", activePrimary === "following" && "is-active"]} href="/following" aria-current={activePrimary === "following" ? "page" : undefined}>
      <span class="nav-item-main">
        <span class="nav-item-marker primary-marker following-marker" aria-hidden="true"></span>
        <span class="nav-item-label-stack">
          <strong>关注</strong>
          <span>用户关注</span>
        </span>
      </span>
    </a>
  </div>
</details>
```

激活状态在组件内根据 `Astro.url.pathname` 计算：

```ts
const activePrimary =
  currentPath === "/see" ? "see"
  : currentPath.startsWith("/go") ? "go"
  : currentPath.startsWith("/following") ? "following"
  : "";
```

### 13.2 ForumFrame.astro

文件：

```text
whyisee-community/app/src/components/ForumFrame.astro
```

可保持现有 props。主入口的静态展示和 active 状态可由 `LeftNav.astro` 自己计算。

如果需要计数，则给 `LeftNav` 增加可选 props：

```ts
primaryCounts?: {
  see?: number;
  go?: number;
  following?: number;
}
```

### 13.3 首页 index.astro

文件：

```text
whyisee-community/app/src/pages/index.astro
```

首页保留最近笔记列表：

```text
最近笔记
  TopicListHeader
  TopicCard[]
```

### 13.3.1 看见 see.astro

文件：

```text
whyisee-community/app/src/pages/see.astro
```

将 `看见` 调整为推荐跳转入口：

```ts
const recommendations = await listSeeRecommendations({
  userId: session?.userId,
  lang,
  sort: "recommend",
  limit: 50,
});

return Astro.redirect(`/t/${recommendations[0].id}`, 302);
```

### 13.4 新增 go.astro

文件：

```text
whyisee-community/app/src/pages/go.astro
```

职责：

- 调用 `listParticipationRecommendations`。
- 渲染参与筛选 tabs。
- 渲染 `ParticipationCard`。
- 未登录用户仍可浏览公开参与项，但主要动作需要登录。

### 13.5 新增 following.astro

文件：

```text
whyisee-community/app/src/pages/following.astro
```

职责：

- 未登录跳转登录，或显示登录提示。
- 登录后调用 `listFollowingFeed`。
- 渲染关注动态流。
- 提供关注源管理入口。

### 13.6 新增 ParticipationCard.astro

文件：

```text
whyisee-community/app/src/components/ParticipationCard.astro
```

卡片专门服务 `出发` 页面，不要硬塞进 `TopicCard`，因为参与卡片有明确动作按钮和参与原因。

### 13.7 分类、标签、用户页关注按钮

需要补齐：

```text
whyisee-community/app/src/pages/c/[slug].astro
whyisee-community/app/src/pages/tag/[slug].astro
whyisee-community/app/src/pages/u/[username].astro
```

新增关注按钮时复用：

```text
POST /api/interactions/follow
```

`target_type` 分别为：

```text
category
tag
user
```

## 14. 交互事件采集

### 14.1 服务端事件

这些动作应在服务端直接记录：

- 点赞。
- 收藏。
- 关注。
- 回复。
- 发帖。
- 举报。
- 领取任务。
- 提交任务。

对应位置：

```text
whyisee-community/app/src/server/services/interactions.ts
whyisee-community/app/src/server/services/topics.ts
whyisee-community/app/src/server/services/tasks.ts
whyisee-community/app/src/server/services/reports.ts
```

### 14.2 前端事件

这些动作需要前端上报：

- 推荐曝光。
- 推荐点击。
- 停留时长。
- 不感兴趣。
- 减少此类内容。

实现方式：

```ts
navigator.sendBeacon("/api/recommendations/events", blob)
```

或使用 `fetch`，页面卸载时优先用 `sendBeacon`。

### 14.3 停留时长

停留时长只记录到粗粒度：

```text
10 秒
30 秒
120 秒
```

不需要持续精细追踪，避免数据噪音和隐私压力。

## 15. 个性化和未登录体验

### 15.1 登录用户

登录用户使用完整画像：

- 显式关注。
- 浏览。
- 停留。
- 收藏。
- 点赞。
- 回复。
- 发帖。
- 任务参与。
- 负反馈。

### 15.2 未登录用户

未登录用户使用公开默认推荐：

看见：

- 精选。
- 近期热门。
- 最新高质量内容。
- 分类覆盖均衡。

出发：

- 公开待回答问题。
- 公开求反馈项目。
- 公开社区任务。

关注：

- 展示登录提示。
- 提供关注功能说明。
- 推荐几个可关注分类和标签。

### 15.3 新用户

新用户登录后如果没有画像：

- 优先使用关注源。
- 如果没有关注源，展示“选择几个关注分类和标签”的轻量入口。
- 在看见页混合精选、热门和最新。
- 在出发页推荐低门槛参与项，比如回答问题、点评项目、补充资源。

## 16. 推荐解释和用户控制

每条推荐最多展示两个短原因：

```text
因为你关注 #Codex
和你收藏的 AI Agent 相关
你关注的作者有更新
项目求反馈
0 回复待回答
社区精选
```

每条推荐的更多菜单提供：

```text
不感兴趣
减少此类内容
屏蔽作者
举报
```

关注页动态提供：

```text
取消关注此话题
取消关注此标签
取消关注此分类
取消关注此作者
```

## 17. 权限和安全边界

推荐查询必须遵守内容可见性：

```text
topics.status = 'published'
posts.status = 'published'
categories.is_public = TRUE
tasks.status = 'open'
```

需要排除：

- 被用户屏蔽的作者。
- 被管理员隐藏或删除的内容。
- 举报未处理且风险高的内容。
- 私有任务。
- Agent 专区内部任务。
- 用户无权限查看的提交内容。

AI 生成内容不能仅因为“新”就进入推荐高位。必须结合：

- 来源。
- 审核状态。
- 质量评分。
- 是否有人工确认。
- 是否被用户负反馈。

## 18. i18n 文案

`whyisee-community/app/src/lib/i18n.ts` 增加 key：

```ts
| "nav.see"
| "nav.seeHint"
| "nav.go"
| "nav.goHint"
| "nav.following"
| "nav.followingHint"
| "page.see"
| "page.seeDescription"
| "page.go"
| "page.goDescription"
| "page.following"
| "page.followingDescription"
```

中文：

```text
nav.see = 看见
nav.seeHint = 首页推荐
nav.go = 出发
nav.goHint = 值得参与
nav.following = 关注
nav.followingHint = 用户关注
page.see = 看见
page.seeDescription = 根据你的关注、阅读、收藏和社区质量信号推荐内容。
page.go = 出发
page.goDescription = 这里是你现在最值得参与的讨论、项目、问题和任务。
page.following = 关注
page.followingDescription = 来自你关注的人、话题、分类和标签的更新。
```

英文：

```text
nav.see = See
nav.seeHint = Home recommendations
nav.go = Go
nav.goHint = Worth joining
nav.following = Following
nav.followingHint = Your follows
```

## 19. 管理后台需求

为了让推荐可控，后台需要能看到：

- 看见页推荐效果。
- 出发页参与项数量。
- 关注页关注源数量。
- 内容质量分。
- 推荐点击率。
- 负反馈高的内容。
- 搜索缺口转参与项。

建议新增后台页面：

```text
/admin/recommendations
```

后台功能：

- 查看推荐面数据。
- 手动刷新内容质量分。
- 手动刷新用户兴趣画像。
- 查看被降权内容。
- 查看高负反馈推荐。
- 管理“可补充”“可更新”标记。

## 20. 和现有 Agent、任务、搜索系统的关系

### 20.1 与 Agent 系统

Agent 可以为推荐系统提供：

- 热点发现。
- 内容质量初审。
- 内容过期检测。
- 搜索缺口发现。
- 推荐理由生成草稿。

但 Agent 不直接决定最终推荐排序。推荐排序由服务层根据可解释规则执行。

### 20.2 与任务系统

`出发` 可以复用通用 `tasks` 表，但只展示：

```text
visibility = 'public_community'
executor_type IN ('user', 'any')
status = 'open'
```

纯 Agent 任务仍然留在 Agent 专区，不进入普通用户出发页。

### 20.3 与搜索系统

搜索行为是强意图信号：

- 用户搜索并点击结果，给对应标签、分类和内容类型加权。
- 搜索无结果，进入内容缺口池。
- 内容缺口可以进入 `出发` 的“可补充”或“可创建”候选项。

现有 `search.ts` 和 `searchParser.ts` 不需要重写，只要在搜索点击时上报 `search_click` 事件。

## 21. 完整验收标准

产品验收：

- 左侧导航顶部出现 `看见 / 出发 / 关注` 三个主入口。
- 三个入口在桌面和移动端抽屉中都位置稳定、状态清楚。
- `/` 默认进入看见页，而不是单纯最新话题页。
- `/go` 能展示可参与内容，且不同参与类型有明确动作。
- `/following` 能展示用户关注源动态。
- 分类和标签导航仍然可用，不被主入口挤掉。
- 未登录用户也能浏览看见和出发的公开内容。
- 关注页对未登录用户给出登录入口。

推荐验收：

- 用户收藏、关注、回复后，后续推荐能体现偏好变化。
- 用户点“不感兴趣”后，同类内容明显减少。
- 精选和高质量内容不会被低质量热门内容压下去。
- 出发页优先展示低回复问题、求反馈项目和可领取社区任务。
- 关注页只展示用户关注源相关动态。
- 被举报、隐藏、删除和高风险内容不会进入推荐。

技术验收：

- 新增服务集中在 `recommendations.ts`，不把推荐逻辑散落到页面。
- 页面 SSR 可直接调用服务层。
- API 支持懒加载、事件上报和负反馈。
- 新表有必要索引。
- 查询不会依赖 AI 直接拼 SQL。
- 推荐结果能记录曝光和点击。
- 所有新增路由保持 Astro `prerender = false`。

## 22. 文件改动总表

新增：

```text
whyisee-community/app/src/pages/go.astro
whyisee-community/app/src/pages/following.astro
whyisee-community/app/src/pages/see.astro
whyisee-community/app/src/components/ParticipationCard.astro
whyisee-community/app/src/server/services/recommendations.ts
whyisee-community/app/src/pages/api/recommendations/see.ts
whyisee-community/app/src/pages/api/recommendations/go.ts
whyisee-community/app/src/pages/api/recommendations/following.ts
whyisee-community/app/src/pages/api/recommendations/events.ts
whyisee-community/app/src/pages/api/recommendations/feedback.ts
```

更新：

```text
whyisee-community/app/src/components/LeftNav.astro
whyisee-community/app/src/components/TopicCard.astro
whyisee-community/app/src/components/ForumFrame.astro
whyisee-community/app/src/pages/index.astro
whyisee-community/app/src/pages/c/[slug].astro
whyisee-community/app/src/pages/tag/[slug].astro
whyisee-community/app/src/pages/u/[username].astro
whyisee-community/app/src/pages/api/interactions/follow.ts
whyisee-community/app/src/server/db/schema.ts
whyisee-community/app/src/lib/i18n.ts
whyisee-community/app/src/lib/types.ts
whyisee-community/app/src/styles/modules/forum-layout.css
whyisee-community/app/src/styles/modules/responsive.css
```

可选新增后台：

```text
whyisee-community/app/src/pages/admin/recommendations.astro
```

## 23. 最终形态

这套设计完成后，左侧栏不再只是分类索引，而是社区的三个核心动作入口：

```text
看见：我今天该看什么。
出发：我现在能参与什么。
关注：我关心的东西有什么更新。
```

三者共用同一套用户兴趣画像和内容质量信号，但目标不同：

```text
看见 = 内容发现。
出发 = 社区参与。
关注 = 订阅跟进。
```

这样 `whyisee.xyz` 会从“按时间排列的话题社区”，变成一个能记住用户、推动互动、持续沉淀内容价值的智能社区入口。
