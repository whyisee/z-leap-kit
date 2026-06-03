# whyisee.xyz 自研社区开发设计文档

## 1. 文档目标

本文档用于指导 `whyisee.xyz` 从备案静态页逐步开发成一个可运营、可增长、可长期沉淀内容的独立开发社区。

当前决策：

> 不再优先依赖 Discourse、Flarum、NodeBB 等现成论坛系统。先按独立开发项目自研核心功能，用最小可用产品验证社区方向、内容质量和流量来源。

本文档关注：

- 做什么，不做什么
- 先做什么，后做什么
- 怎么用 2C2G VPS 跑起来
- 怎么兼顾 SEO、社区运营和后续扩展
- 如何避免一个人开发时被论坛复杂度拖死

完整论坛账号、权限、发帖、回复、通知、治理和后台设计见：[whyisee.xyz 论坛系统完整功能设计](./forum-system-design.md)。

## 2. 项目定位

`whyisee.xyz` 是一个面向独立开发者、AI 工具玩家、效率工具作者、小产品站长和游戏站/内容站实践者的实战社区。

一句话定位：

> 看见想法，验证想法，做出东西。

更具体一点：

> 一个记录独立开发、AI 工作流、SEO 流量实验、小产品上线和失败复盘的社区。

社区不是泛技术论坛，也不是卖课引流站。核心价值是让真实做项目的人留下过程、问题、数据、复盘和工具经验。

## 3. 独立开发原则

### 3.1 先验证，不先造大系统

社区项目最容易死在“功能很完整，但没人说话”。首版不要追求完整论坛能力，而是验证：

- 有没有人愿意看这些内容
- 有没有人愿意回复和提问
- 哪些主题能带来自然搜索流量
- 哪些内容会被收藏、转发、再次访问
- 站长一个人能不能稳定维护

### 3.2 内容是产品的一部分

社区不是空壳软件，首版必须带内容种子。

初期内容由站长主导：

- 独立开发复盘
- AI 工具实战文章
- SEO 实验记录
- 小产品上线记录
- 开源插件推广复盘
- 游戏站/内容站踩坑记录

用户功能可以逐步开放，但内容节奏不能等用户自然产生。

### 3.3 每个功能都要服务运营

不做“看起来像社区”的功能，优先做对运营有帮助的功能：

- 话题列表：帮助用户快速发现内容
- 标签：帮助 SEO 和专题沉淀
- 评论/回复：帮助形成讨论
- 项目展示：帮助用户愿意发帖
- 搜索：帮助老内容继续有价值
- 管理后台：帮助站长省时间
- 数据统计：帮助判断内容方向

### 3.4 小服务器优先

当前 VPS 是阿里云 2C2G。首版技术方案必须能在这个规格上稳定运行。

原则：

- 避免 Docker Hub 依赖
- 避免重型论坛系统
- 避免过多常驻服务
- 首版数据库直接使用 PostgreSQL
- 后续按压力再增加 Redis、独立全文搜索服务

官方依据：

- Astro 支持按需服务端渲染，可以用于动态页面和 SEO 页面：https://docs.astro.build/en/guides/on-demand-rendering/
- Hono 可以通过 Node.js Adapter 在 Node 环境运行：https://hono.dev/docs/getting-started/nodejs
- PostgreSQL 是成熟的关系型数据库，适合论坛的用户、话题、回复、通知、审核等长期数据模型。

## 4. 阶段路线

### 4.1 阶段 0：备案静态页

状态：已开始。

目标：

- 域名备案期间可以展示一个正常首页
- 明确社区方向
- 不依赖后端服务
- 可以直接部署在 Nginx 根目录

已完成内容：

- 静态首页
- 站点标识
- `robots.txt`
- `sitemap.xml`
- Nginx 示例配置

下一步：

- 备案通过后替换真实备案号
- 域名从阿里云备案拦截切换到真实页面
- 开始准备种子内容

### 4.2 阶段 1：内容型社区 MVP

目标：

先做一个“可浏览、可 SEO、可手动运营”的社区，而不是一上来做完整开放注册论坛。

核心能力：

- 首页话题流
- 分类页
- 标签页
- 话题详情页
- 项目展示页
- 管理员登录
- 管理员发布话题
- 管理员编辑话题
- Markdown 内容渲染
- Sitemap 自动生成
- RSS 输出

暂不开放：

- 普通用户自由注册
- 私信
- 通知中心
- 积分系统
- 复杂权限
- 实时消息

这个阶段的目标是先让网站有内容、有结构、有收录。

### 4.3 阶段 2：邀请制互动

目标：

开始形成真实讨论，但控制垃圾内容和运营压力。

新增能力：

- 邮箱登录或 GitHub 登录
- 邀请码注册
- 用户资料页
- 回复话题
- 编辑自己的回复
- 收藏话题
- 点赞或感谢
- 举报内容
- 管理员审核和删除

运营策略：

- 首批只邀请熟人、开源项目作者、工具作者
- 控制发帖权限
- 允许回复优先于允许发帖
- 项目展示帖优先开放

### 4.4 阶段 3：开放社区

目标：

当内容质量、访问量和运营流程基本稳定后，再逐步开放更完整的社区能力。

新增能力：

- 开放注册
- 发帖审核队列
- 用户等级
- 每周精选
- 热门话题
- 站内通知
- 内容搜索
- 相关推荐
- 项目库
- 资源库

### 4.5 阶段 4：AI 辅助运营

目标：

AI 不替代用户发言，而是帮助站长运营、整理和发现内容价值。

新增能力：

- 自动生成话题摘要
- 自动推荐标签
- 自动识别低质量内容
- 自动生成每周精选草稿
- 自动发现相似话题
- 自动生成项目展示的结构化卡片
- 根据站内内容生成“本周值得做什么”

## 5. 首版 MVP 范围

### 5.1 必须做

- 首页
- 分类列表
- 话题列表
- 话题详情
- 标签聚合
- 项目展示聚合
- 管理员发布/编辑话题
- Markdown 渲染
- 基础 SEO
- Sitemap
- RSS
- 本地备份
- Nginx 部署

### 5.2 可以晚点做

- 普通用户注册
- 回复
- 搜索
- 图片上传
- 用户头像
- 邮件通知
- 内容举报
- AI 总结

### 5.3 首版绝对不做

- 私信
- 实时聊天
- 积分商城
- 复杂等级体系
- 第三方支付
- 多语言完整站点
- 大规模推荐算法
- 复杂富文本编辑器
- 复杂后台 CMS

## 6. 信息架构

### 6.1 顶层导航

```text
首页
最新
热门
分类
项目展示
资源
关于
```

首版可以先隐藏“热门”和“资源”，但路由设计要预留。

### 6.2 核心页面

```text
/                       首页
/latest                 最新话题
/categories             分类列表
/c/:categorySlug        分类详情
/tag/:tagSlug           标签详情
/t/:topicId/:slug       话题详情
/projects               项目展示
/p/:projectSlug         项目详情
/about                  关于社区
/guidelines             社区规则
/rss.xml                RSS
/sitemap.xml            Sitemap
/admin                  管理后台
```

### 6.3 首版分类

- 公告
- AI 工具
- 独立开发
- 效率工具
- SEO 与流量
- 项目展示
- 小游戏与内容站
- 闲聊

### 6.4 首版标签

```text
cursor
codex
deepseek
claude-code
ai-agent
seo
adsense
search-console
open-vsx
github-pages
cloudflare
独立开发
插件
小游戏
内容站
复盘
求反馈
踩坑
教程
收入记录
```

## 7. 页面设计

### 7.1 首页

目标：

首页不是宣传页，而是社区入口和内容入口。

结构：

- 顶部导航
- 社区定位短句
- 最新话题流
- 右侧公告
- 热门标签
- 项目展示入口
- 新人指南入口

话题卡片字段：

- 标题
- 分类
- 标签
- 摘要
- 作者
- 发布时间
- 回复数
- 浏览量
- 最后活动时间

### 7.2 话题详情页

结构：

- 标题
- 分类和标签
- 作者信息
- 发布时间
- 正文
- 相关话题
- 回复区
- 站长精选提示

SEO 要求：

- 服务端渲染 HTML
- 标题包含核心关键词
- 摘要进入 meta description
- 使用 canonical URL
- 支持 Open Graph

### 7.3 项目展示页

目标：

项目展示是社区首批最容易形成参与感的栏目。

项目字段：

- 项目名称
- 一句话介绍
- 项目链接
- GitHub 链接
- 作者
- 当前阶段
- 技术栈
- 想要反馈的问题
- 更新记录

首版可以把项目展示作为特殊话题类型实现，不单独做复杂项目系统。

### 7.4 管理后台

首版后台只服务站长。

功能：

- 登录
- 新建话题
- 编辑话题
- 发布/草稿切换
- 设置分类和标签
- 置顶
- 删除
- 查看基础访问统计

不做复杂 CMS。编辑器先用 Markdown textarea，后续再优化预览。

## 8. 技术架构

### 8.1 推荐栈

首版推荐：

```text
Nginx
  -> Node.js App
      -> Astro SSR 页面
      -> Hono API
      -> PostgreSQL
      -> 本地文件存储
```

理由：

- Astro 适合内容页、SEO 和静态/动态混合渲染
- Hono 足够轻，API 结构清楚
- PostgreSQL 更适合账号、权限、回复、通知、审核等论坛核心数据
- 一台 2C2G VPS 可以承受首版流量
- TypeScript 可以保持前后端类型一致

### 8.2 不选重型方案的原因

不选完整论坛系统：

- 国内 Docker Hub 链路不稳定
- 2C2G 资源压力更大
- 定制成本不一定低
- 社区早期更需要内容和运营，不需要完整论坛功能

不选纯静态长期方案：

- 不能支撑用户回复
- 不能支撑项目展示互动
- 后续管理成本会升高

不选一开始就 Redis + 独立搜索服务：

- 除 PostgreSQL 外的常驻服务太多
- 早期流量不值得
- 增加备份和监控复杂度

### 8.3 目录结构

建议在 `whyisee-community/app` 下开发真实应用。

```text
whyisee-community/
  docs/
    indie-community-development-design.md
  site/
    index.html
    styles.css
  app/
    package.json
    astro.config.mjs
    src/
      pages/
        index.astro
        latest.astro
        categories.astro
        c/[slug].astro
        tag/[slug].astro
        t/[id]/[slug].astro
        projects.astro
        admin/
      components/
        Layout.astro
        TopicCard.astro
        Sidebar.astro
        MarkdownContent.astro
      server/
        api/
        db/
        auth/
        services/
      styles/
        global.css
      content/
    scripts/
      backup-db.mjs
      seed.mjs
      migrate.mjs
```

## 9. 数据设计

### 9.1 users

用户表。

字段：

- `id`
- `username`
- `display_name`
- `email`
- `avatar_url`
- `role`
- `status`
- `bio`
- `website_url`
- `github_url`
- `created_at`
- `updated_at`

首版只需要管理员用户，后续开放普通用户。

### 9.2 categories

分类表。

字段：

- `id`
- `name`
- `slug`
- `description`
- `color`
- `sort_order`
- `is_public`
- `created_at`
- `updated_at`

### 9.3 topics

话题表。

字段：

- `id`
- `title`
- `slug`
- `summary`
- `content_markdown`
- `content_html`
- `author_id`
- `category_id`
- `type`
- `status`
- `is_pinned`
- `is_featured`
- `view_count`
- `reply_count`
- `last_activity_at`
- `published_at`
- `created_at`
- `updated_at`

`type` 可选：

```text
discussion
article
project
resource
announcement
```

`status` 可选：

```text
draft
published
hidden
deleted
```

### 9.4 posts

回复表。

字段：

- `id`
- `topic_id`
- `author_id`
- `content_markdown`
- `content_html`
- `status`
- `created_at`
- `updated_at`

阶段 1 可以不启用，阶段 2 开始启用。

### 9.5 tags

标签表。

字段：

- `id`
- `name`
- `slug`
- `description`
- `created_at`

### 9.6 topic_tags

话题标签关联表。

字段：

- `topic_id`
- `tag_id`

### 9.7 projects

项目展示扩展表。

首版可以不单独建表，直接用 `topics.type = project`。当项目展示变多后再拆出来。

后续字段：

- `topic_id`
- `project_name`
- `project_url`
- `repo_url`
- `stage`
- `tech_stack`
- `feedback_request`
- `launched_at`

### 9.8 reactions

点赞/感谢表。

字段：

- `id`
- `target_type`
- `target_id`
- `user_id`
- `reaction_type`
- `created_at`

### 9.9 bookmarks

收藏表。

字段：

- `id`
- `user_id`
- `topic_id`
- `created_at`

### 9.10 audit_logs

操作日志。

字段：

- `id`
- `actor_id`
- `action`
- `target_type`
- `target_id`
- `metadata_json`
- `created_at`

后台操作必须记录，方便恢复和排查。

## 10. API 设计

### 10.1 公开 API

```text
GET /api/topics
GET /api/topics/:id
GET /api/categories
GET /api/tags
GET /api/projects
GET /api/search
```

### 10.2 管理 API

```text
POST /api/admin/login
POST /api/admin/logout
POST /api/admin/topics
PATCH /api/admin/topics/:id
DELETE /api/admin/topics/:id
POST /api/admin/topics/:id/publish
POST /api/admin/topics/:id/unpublish
```

### 10.3 用户 API

阶段 2 开始：

```text
POST /api/auth/login
POST /api/auth/logout
GET /api/me
POST /api/topics/:id/replies
PATCH /api/replies/:id
POST /api/topics/:id/bookmark
POST /api/topics/:id/reaction
POST /api/reports
```

## 11. SEO 设计

SEO 是这个项目的核心能力之一，不是后补项。

### 11.1 页面级 SEO

每个公开页面需要：

- 唯一 title
- meta description
- canonical
- Open Graph
- 清晰 H1
- 面包屑
- 语义化 HTML
- 服务端渲染正文内容

### 11.2 URL 设计

话题 URL：

```text
/t/:topicId/:slug
```

原因：

- `topicId` 保证唯一
- `slug` 保证可读
- 标题修改后仍能重定向

分类 URL：

```text
/c/ai-tools
/c/indie-dev
/c/seo-traffic
```

标签 URL：

```text
/tag/cursor
/tag/seo
```

### 11.3 内容策略

首批内容建议：

- 10 篇工具实战
- 10 篇独立开发复盘
- 6 篇 SEO 和流量实验
- 4 篇项目展示
- 3 篇新人指南
- 2 篇社区规则

内容标题要具体，不要空泛。

示例：

- Cursor 插件从 0 到发布 Open VSX 的完整记录
- 为什么我的插件发布后没有下载量
- GitHub Pages 做 SEO 到底有什么限制
- 游戏站接广告前应该先验证哪些流量指标
- 2C2G 阿里云 VPS 自研社区部署记录

### 11.4 Sitemap 和 RSS

必须自动生成：

- `/sitemap.xml`
- `/rss.xml`

Sitemap 包含：

- 首页
- 分类页
- 标签页
- 话题详情页
- 项目页

RSS 包含：

- 最新公开话题
- 标题
- 摘要
- 链接
- 发布时间

## 12. 账号和权限

### 12.1 阶段 1

只有管理员账号。

权限：

- 登录后台
- 发布内容
- 编辑内容
- 删除内容
- 管理分类和标签

### 12.2 阶段 2

开放邀请制账号。

用户角色：

```text
admin
member
pending
banned
```

权限：

- `admin`：全部权限
- `member`：回复、收藏、点赞、发布项目展示
- `pending`：只能浏览和完善资料
- `banned`：禁止互动

### 12.3 阶段 3

再考虑用户等级。

等级不要一开始复杂化，只需要：

- 新用户
- 普通成员
- 可信成员
- 管理员

## 13. 内容审核

早期一定要控制垃圾内容。

策略：

- 邀请码注册
- 新用户发帖进入审核
- 回复频率限制
- 同 IP 注册限制
- 敏感词提示
- 举报入口
- 管理员一键隐藏

不做复杂自动审核，先保证站长可控。

## 14. AI 功能规划

AI 不是首版核心依赖。先把社区跑起来，再让 AI 提高运营效率。

### 14.1 管理端 AI

优先做：

- 根据正文推荐标题
- 根据正文生成摘要
- 根据正文推荐标签
- 根据正文生成 SEO description
- 根据多篇内容生成周报草稿

### 14.2 用户端 AI

后续做：

- 帮用户把项目展示帖整理成标准格式
- 帮用户拆分问题，让提问更清楚
- 推荐相关话题
- 总结长讨论

### 14.3 不做

- 不让 AI 自动大量发帖
- 不鼓励纯 AI 水文
- 不把 AI 当成社区内容主体

## 15. 部署设计

### 15.1 基础架构

```text
访客
  -> Nginx
      -> 静态资源
      -> Node.js App
          -> PostgreSQL
          -> 本地上传目录
```

### 15.2 服务器

当前服务器：

- 阿里云
- 2C2G
- 需要备案
- 先 HTTP 测试
- 备案后绑定域名和 HTTPS

### 15.3 运行方式

推荐：

- Nginx 反向代理
- Node.js 应用监听 `127.0.0.1:3000`
- systemd 管理进程
- PostgreSQL 监听 `127.0.0.1:15432`，业务 schema 使用 `ws`
- 上传文件放在 `/var/www/whyisee.xyz/uploads/`

数据库环境变量：

```text
DB_HOST=127.0.0.1
DB_PORT=15432
DB_NAME=zi
DB_USER=postgres
DB_PASSWORD=123456
DB_SCHEMA=ws
PG_DUMP_BIN=pg_dump
```

### 15.4 备份

必须做：

- 每日 PostgreSQL schema 备份
- 每日上传目录备份
- 保留最近 7 天
- 每周手动下载一份到本地

PostgreSQL 备份使用 `pg_dump --schema ws` 导出，恢复前需要确认目标库、schema 和权限，避免覆盖线上数据。`pg_dump` 客户端主版本必须不低于服务端主版本；如果本机或服务器有多个版本，可以通过 `PG_DUMP_BIN` 指定。

### 15.5 日志

需要记录：

- 访问日志
- 应用错误日志
- 后台操作日志
- 登录失败日志

首版可以先使用 Nginx 日志 + 应用文本日志。

## 16. UI 方向

视觉目标：

- 更像社区，不像 SaaS 落地页
- 内容密度适中
- 深色主题可以保留，但要提高阅读舒适度
- 不堆装饰
- 话题列表要清楚
- 标签和分类要可扫读

页面风格：

- 顶部简洁导航
- 首页以话题流为主
- 右侧栏只放运营信息
- 话题详情强调阅读体验
- 项目展示用更结构化卡片

响应式：

虽然核心用户多在桌面端，但这是公网网站，不是 Cursor 插件。手机端至少要保证可阅读、可点击、可提交基础表单。

## 17. 数据指标

每周关注：

- 页面访问量
- 搜索来源访问量
- 被收录页面数
- 话题访问排行
- 用户停留时间
- 回复数
- 收藏数
- 新用户数
- 项目展示数
- 站内搜索关键词

判断社区是否值得继续做：

- 是否有自然搜索流量增长
- 是否有人主动留言或反馈
- 是否有人愿意发布项目
- 是否有内容被反复访问
- 是否能每周稳定产出内容

## 18. 开发计划

### 18.1 V0.1 内容社区骨架

目标：管理员可发布内容，用户可浏览。

TODO：

- [x] 初始化 `whyisee-community/app`
- [x] 搭建 Astro SSR 项目
- [x] 接入 Hono API
- [x] 接入 PostgreSQL 数据库
- [x] 创建 migration 脚本
- [x] 创建 seed 脚本
- [x] 实现首页
- [x] 实现话题列表
- [x] 实现话题详情
- [x] 实现分类页
- [x] 实现标签页
- [x] 实现项目展示页
- [ ] 实现管理员登录
- [ ] 实现管理员发布话题
- [ ] 实现管理员编辑话题
- [x] 实现 Markdown 渲染
- [x] 自动生成 sitemap
- [x] 自动生成 RSS
- [x] 写部署文档

### 18.2 V0.2 互动能力

目标：邀请制用户可以参与讨论。

TODO：

- [ ] 用户登录
- [ ] 邀请码注册
- [ ] 用户资料页
- [ ] 回复话题
- [ ] 编辑回复
- [ ] 收藏话题
- [ ] 点赞/感谢
- [ ] 举报内容
- [ ] 后台审核回复
- [ ] 邮件基础配置

### 18.3 V0.3 搜索与 SEO

目标：提升内容发现和搜索流量。

TODO：

- [ ] 站内搜索
- [ ] 热门话题
- [ ] 相关话题
- [ ] 面包屑
- [ ] canonical
- [ ] Open Graph 图片
- [ ] 页面结构化数据
- [ ] 搜索关键词统计
- [ ] 404 和重定向优化

### 18.4 V0.4 项目库

目标：让项目展示成为社区特色。

TODO：

- [ ] 项目展示独立详情页
- [ ] 项目阶段字段
- [ ] 技术栈字段
- [ ] 项目更新记录
- [ ] 求反馈问题模板
- [ ] 项目作者主页
- [ ] 项目精选

### 18.5 V0.5 AI 辅助运营

目标：让 AI 帮站长省时间。

TODO：

- [ ] AI 生成摘要
- [ ] AI 推荐标签
- [ ] AI 生成 SEO description
- [ ] AI 总结长讨论
- [ ] AI 生成周报草稿
- [ ] AI 推荐相似话题

## 19. 风险和应对

### 19.1 没有内容

风险：

社区最怕空。

应对：

- 站长每周至少写 2 篇实战内容
- 先做项目展示和复盘，降低用户参与门槛
- 把自己开发 Leap Home、建站、SEO 的过程全部写出来

### 19.2 没有用户

风险：

没有人发帖，社区像个人博客。

应对：

- 初期接受它像个人博客
- 用 SEO 和项目复盘积累入口
- 在 GitHub、Open VSX、V2EX、linux.do、知乎等地方自然引流
- 先找 5 到 10 个真实做项目的人参与

### 19.3 垃圾内容

风险：

一开放注册就被灌水。

应对：

- 邀请制
- 审核队列
- 限制新用户发帖
- 举报和一键隐藏

### 19.4 技术复杂度失控

风险：

一个人做论坛容易越做越大。

应对：

- 阶段 1 不做普通用户
- 阶段 2 不做私信和通知
- 阶段 3 再做等级
- 所有功能先服务运营

### 19.5 服务器资源不足

风险：

2C2G 后续可能不够。

应对：

- 首版 PostgreSQL + Nginx 缓存
- 图片限制大小
- 热门页面可缓存
- 后续可增加 Redis 和独立搜索服务
- 静态资源可放 CDN

## 20. 首批种子内容清单

建议备案通过前先准备。

### 20.1 独立开发

- 为什么我决定自己开发 whyisee.xyz
- 一个 Cursor 插件从想法到发布的完整记录
- Open VSX 插件没有下载量时应该检查什么
- 独立开发项目如何判断是否值得继续做
- 2C2G VPS 能不能撑起一个社区网站

### 20.2 AI 工具

- Codex 和 Cursor 在真实项目中的分工
- DeepSeek 接入个人工具的经验和坑
- AI 生成代码时如何控制质量
- 如何让 AI 帮你写项目复盘
- AI 工具不是魔法，真正省时间的地方在哪里

### 20.3 SEO 与流量

- GitHub Pages 能不能做 SEO
- 新域名建站前 30 天应该做什么
- 游戏站接广告前先验证哪些指标
- 中文社区如何自然推广
- 为什么教程站比工具站更容易起量

### 20.4 项目展示

- Leap Home：一个 Cursor 个人知识库首页插件
- whyisee.xyz：从静态备案页到自研社区
- 一个小游戏站的 MVP 规划
- 一个效率工具插件的推广复盘

## 21. 下一步

建议下一步直接开始 V0.1 开发：

1. 在 `whyisee-community/app` 初始化项目。
2. 把当前 `site` 静态页迁移成 Astro 首页。
3. 建 PostgreSQL schema。
4. 用 seed 脚本写入首批分类和 5 篇种子话题。
5. 实现话题列表和详情页。
6. 部署到 VPS 的 `127.0.0.1:3000`，由 Nginx 反向代理。

只要 V0.1 做出来，网站就从“备案占位页”变成“可持续更新的内容社区”。这才是独立开发真正开始的地方。
