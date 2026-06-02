import { closeDb, getDb, getDatabasePath } from "../src/server/db/client.ts";
import { renderMarkdown } from "../src/lib/markdown.ts";

const db = getDb();
const now = new Date().toISOString();

const admin = {
  username: "whyisee",
  displayName: "whyisee",
  email: "admin@whyisee.xyz",
};

db.prepare(
  `
  INSERT INTO users (username, display_name, email, role, status, bio, created_at, updated_at)
  VALUES (@username, @displayName, @email, 'admin', 'active', 'whyisee.xyz 站长', @now, @now)
  ON CONFLICT(username) DO UPDATE SET
    display_name = excluded.display_name,
    email = excluded.email,
    role = 'admin',
    status = 'active',
    updated_at = excluded.updated_at
  `,
).run({ ...admin, now });

const categories = [
  ["公告", "announcements", "站务公告、更新、规则调整和反馈收集。", "#7fb3ff", 10],
  ["AI 工具", "ai-tools", "Cursor、Codex、Claude Code、DeepSeek、Agent 和 AI 工作流。", "#66d08c", 20],
  ["独立开发", "indie-dev", "产品想法、MVP、技术选型、上线记录、收入复盘和失败复盘。", "#f3c969", 30],
  ["效率工具", "productivity-tools", "插件、脚本、个人知识库、自动化和开发效率工具。", "#b794f4", 40],
  ["SEO 与流量", "seo-traffic", "Google SEO、内容站、社区推广、外链、广告变现和增长复盘。", "#ff9f6e", 50],
  ["项目展示", "projects", "发布自己的工具、插件、网站、小游戏、开源项目，并接受反馈。", "#ff7a98", 60],
  ["小游戏与内容站", "games-content-sites", "H5 游戏站、内容站、广告接入、用户留存和小游戏社区玩法。", "#69d2e7", 70],
  ["闲聊", "chat", "灵感、吐槽、轻讨论和社区生活。", "#a6afbd", 80],
] as const;

const upsertCategory = db.prepare(
  `
  INSERT INTO categories (name, slug, description, color, sort_order, is_public, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    description = excluded.description,
    color = excluded.color,
    sort_order = excluded.sort_order,
    updated_at = excluded.updated_at
  `,
);

for (const category of categories) {
  upsertCategory.run(...category, now, now);
}

const tags = [
  ["cursor", "cursor", "Cursor 使用、插件开发和工作流"],
  ["codex", "codex", "Codex 使用、开发协作和自动化"],
  ["deepseek", "deepseek", "DeepSeek API、模型能力和接入经验"],
  ["seo", "seo", "搜索引擎优化和自然流量"],
  ["adsense", "adsense", "广告变现和内容站收入"],
  ["open-vsx", "open-vsx", "Open VSX 插件发布和推广"],
  ["github-pages", "github-pages", "GitHub Pages 建站和 SEO"],
  ["独立开发", "indie-dev", "独立开发过程和复盘"],
  ["插件", "plugin", "插件、扩展和工具开发"],
  ["小游戏", "mini-game", "小游戏站和游戏内容"],
  ["复盘", "retrospective", "项目复盘和失败经验"],
  ["求反馈", "feedback", "项目展示和反馈请求"],
] as const;

const upsertTag = db.prepare(
  `
  INSERT INTO tags (name, slug, description, created_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(slug) DO UPDATE SET
    name = excluded.name,
    description = excluded.description
  `,
);

for (const tag of tags) {
  upsertTag.run(...tag, now);
}

const adminId = (db.prepare("SELECT id FROM users WHERE username = ?").get(admin.username) as { id: number }).id;

const topicSeeds = [
  {
    title: "为什么我决定自己开发 whyisee.xyz",
    slug: "why-build-whyisee-community",
    category: "indie-dev",
    type: "article",
    tags: ["indie-dev", "retrospective", "seo"],
    summary: "现成论坛系统跑不起来时，不如先用轻量自研方案验证社区内容、流量和运营节奏。",
    markdown: `
## 背景

whyisee.xyz 不是一个为了炫技而做的论坛项目，而是一次独立开发实验。

我想验证几个问题：

- 独立开发者是否需要一个更真实的复盘社区
- AI 工具、SEO、小产品和游戏站这些内容能不能形成稳定讨论
- 一个 2C2G VPS 能不能先撑起早期社区

## 当前选择

首版不做完整论坛系统，先做轻量内容社区。管理员先发布种子内容，等内容结构和方向稳定后，再逐步开放邀请制互动。
    `,
    pinned: true,
    featured: true,
  },
  {
    title: "Cursor、Codex、DeepSeek 到底怎样接入真实开发流程？",
    slug: "cursor-codex-deepseek-real-workflow",
    category: "ai-tools",
    type: "article",
    tags: ["cursor", "codex", "deepseek"],
    summary: "不是演示 prompt，而是记录从需求、编码、调试、发布到复盘的完整工作流。",
    markdown: `
## 问题

很多 AI 工具演示都停留在“看起来很聪明”的阶段，但真实开发里更重要的是：

- 需求是否被拆清楚
- 代码是否能持续维护
- 调试是否能定位问题
- 发布后是否能复盘

## 方向

whyisee.xyz 会持续记录 AI 工具在真实项目里的使用方式，包括成功经验，也包括踩坑。
    `,
    pinned: false,
    featured: true,
  },
  {
    title: "Open VSX 插件没有下载量时应该检查什么",
    slug: "open-vsx-no-download-checklist",
    category: "seo-traffic",
    type: "article",
    tags: ["open-vsx", "plugin", "seo"],
    summary: "插件发布不是结束，入口、README、关键词、截图、社区传播和真实使用场景都会影响下载量。",
    markdown: `
## 检查项

- README 是否有英文版本
- 截图是否能直接说明插件价值
- 插件标题是否包含用户会搜索的关键词
- 是否在 GitHub、论坛、文章里提供入口
- 是否有真实使用场景，而不是只写功能列表

## 结论

发布只是第一步。插件也需要内容、传播和反馈循环。
    `,
    pinned: false,
    featured: true,
  },
  {
    title: "Leap Home：一个 Cursor 个人知识库首页插件",
    slug: "leap-home-project-showcase",
    category: "projects",
    type: "project",
    tags: ["cursor", "plugin", "feedback"],
    summary: "把知识库首页、四象限、日历、搜索、番茄时钟和做什么推荐整合进 Cursor 编辑窗口。",
    markdown: `
## 项目介绍

Leap Home 是一个 Cursor 插件，目标是把个人知识库首页放进编辑窗口，而不是侧边栏。

## 当前能力

- 自定义主页
- 网格布局
- 搜索组件
- 四象限任务
- 周历和月历
- 番茄时钟
- 做什么推荐
- 知识图谱

## 想要反馈

我想知道大家更希望它像“个人仪表盘”，还是更像“知识库工作台”。
    `,
    pinned: false,
    featured: true,
  },
  {
    title: "2C2G VPS 能不能撑起一个早期社区网站？",
    slug: "2c2g-vps-community-start",
    category: "indie-dev",
    type: "discussion",
    tags: ["indie-dev", "seo"],
    summary: "早期社区的瓶颈通常不是服务器，而是内容、运营和垃圾信息控制。",
    markdown: `
## 初步判断

2C2G VPS 对早期社区完全够用，前提是不要一开始就上太重的技术栈。

## 首版策略

- Nginx 处理静态资源
- Node.js 跑服务端页面和 API
- SQLite 存储内容
- 后续流量起来再迁移 PostgreSQL 和搜索服务
    `,
    pinned: false,
    featured: false,
  },
] as const;

const getCategoryId = db.prepare("SELECT id FROM categories WHERE slug = ?");
const getTagId = db.prepare("SELECT id FROM tags WHERE slug = ?");
const upsertTopic = db.prepare(
  `
  INSERT INTO topics (
    title, slug, summary, content_markdown, content_html, author_id, category_id,
    type, status, is_pinned, is_featured, last_activity_at, published_at, created_at, updated_at
  )
  VALUES (
    @title, @slug, @summary, @contentMarkdown, @contentHtml, @authorId, @categoryId,
    @type, 'published', @isPinned, @isFeatured, @now, @now, @now, @now
  )
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    summary = excluded.summary,
    content_markdown = excluded.content_markdown,
    content_html = excluded.content_html,
    category_id = excluded.category_id,
    type = excluded.type,
    status = 'published',
    is_pinned = excluded.is_pinned,
    is_featured = excluded.is_featured,
    updated_at = excluded.updated_at
  `,
);

const clearTopicTags = db.prepare("DELETE FROM topic_tags WHERE topic_id = ?");
const insertTopicTag = db.prepare(
  `
  INSERT OR IGNORE INTO topic_tags (topic_id, tag_id)
  VALUES (?, ?)
  `,
);
const getTopicId = db.prepare("SELECT id FROM topics WHERE slug = ?");

for (const topic of topicSeeds) {
  const categoryRow = getCategoryId.get(topic.category) as { id: number } | undefined;

  if (!categoryRow) {
    throw new Error(`Missing category: ${topic.category}`);
  }

  upsertTopic.run({
    title: topic.title,
    slug: topic.slug,
    summary: topic.summary,
    contentMarkdown: topic.markdown.trim(),
    contentHtml: renderMarkdown(topic.markdown.trim()),
    authorId: adminId,
    categoryId: categoryRow.id,
    type: topic.type,
    isPinned: topic.pinned ? 1 : 0,
    isFeatured: topic.featured ? 1 : 0,
    now,
  });

  const topicId = (getTopicId.get(topic.slug) as { id: number }).id;
  clearTopicTags.run(topicId);

  for (const tag of topic.tags) {
    const tagRow = getTagId.get(tag) as { id: number } | undefined;

    if (!tagRow) {
      throw new Error(`Missing tag: ${tag}`);
    }

    insertTopicTag.run(topicId, tagRow.id);
  }
}

console.log(`Seed finished: ${getDatabasePath()}`);

closeDb();
