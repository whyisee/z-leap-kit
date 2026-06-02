# Leap Home 官网主页设计文档

## 1. 目标

为 Leap Home 做一个可长期承载 SEO、产品介绍、安装转化和社区传播的官网首页。首页不是营销空壳，而是让用户快速理解：

- Leap Home 是什么
- 为什么它适合 Cursor / VS Code 用户
- 它和普通搜索、任务工具、番茄钟插件有什么区别
- 如何安装、配置 AI、开始使用
- 这个项目是否可信、是否持续维护

首版目标是做一个轻量但完整的产品官网，可以先部署到 GitHub Pages / Cloudflare Pages，再逐步扩展文档、博客和游戏/社区等流量入口。

## 2. 用户画像

### 核心用户

- 使用 Cursor / VS Code 的开发者
- 有个人知识库、项目文档、Prompt、任务和灵感记录的人
- 觉得编辑器里的信息分散，想要一个工作台首页的人
- 希望 AI 帮忙搜索、整理、推荐下一步行动的人

### 次级用户

- 效率工具爱好者
- Obsidian / Notion / Logseq 用户
- 关注开源插件、AI 工具、开发者工作流的人

## 3. 核心定位

一句话：

> Leap Home is a customizable knowledge homepage for Cursor and VS Code.

中文表达：

> Leap Home 是一个给 Cursor / VS Code 用的个人知识库首页，把搜索、任务、日历、番茄时钟、知识图谱和 AI 推荐放进一个可自由布局的工作台。

首页要避免说成“又一个效率插件”。它的差异点是：

- 编辑器内主页，而不是侧边栏小面板
- 可自由网格布局，而不是固定 Dashboard
- 组件化：搜索、四象限、番茄、倒计日、周历、月历、统计、知识图谱、做什么推荐
- 工作区本地数据 `.leap`，适合项目级知识库
- AI 能力不是单点功能，而是参与搜索、任务分类、知识整理和下一步推荐

## 4. SEO 策略

### 首版目标关键词

英文：

- Cursor knowledge homepage
- VS Code knowledge dashboard
- Cursor productivity extension
- Cursor personal knowledge base
- AI task and knowledge dashboard
- Pomodoro knowledge graph Cursor extension

中文：

- Cursor 知识库首页
- Cursor 效率插件
- Cursor 个人知识库
- VS Code 知识库工作台
- Cursor 番茄时钟 四象限 插件
- AI 知识库 搜索 插件

### 页面结构建议

首版先做单页，但内容按可扩展分区设计。后续可以拆成独立页面：

- `/`
- `/en/`
- `/zh/`
- `/features/search`
- `/features/ai-next-action`
- `/features/focus-timer`
- `/features/knowledge-graph`
- `/docs/install`
- `/docs/deepseek-config`
- `/changelog`

### 必备 SEO 元信息

- `title`
- `meta description`
- canonical URL
- Open Graph title / description / image
- Twitter card
- `robots.txt`
- `sitemap.xml`
- `SoftwareApplication` JSON-LD
- 中英文 `hreflang`

## 5. 首页信息架构

### 5.1 首屏

目标：第一屏直接让用户知道这是 Leap Home，不要做泛泛而谈的效率工具 hero。

内容：

- H1：Leap Home
- 副标题：A customizable knowledge homepage for Cursor and VS Code.
- 中文副标题可切换或双语展示：给 Cursor / VS Code 的个人知识库首页
- 主按钮：Install from Open VSX
- 次按钮：View on GitHub
- 第三入口：Read English / 中文文档
- 首屏背景：使用真实产品截图，不做抽象渐变插画

首屏应展示真实 UI 截图，例如：

- 搜索 + 做什么 + 番茄时钟
- 四象限 + 周历/月历
- 知识图谱

### 5.2 核心卖点

建议 4 个模块：

1. Editor-native Home
   - 在编辑器窗口中打开主页
   - 不占用侧边栏
   - 适合每天开始工作时使用

2. Modular Workspace
   - 组件自由布局
   - 内置模板
   - 自定义主页

3. Deep Search
   - 搜索 Markdown、代码、Prompt、任务、日历、收集箱
   - 支持命令语法和 AI 搜索
   - 搜索结果可预览、收藏、加入待办

4. AI Next Action
   - 根据任务、记录、倒计日、番茄记录和知识库推荐下一步
   - 可以拆小任务、写入笔记、创建新事项

### 5.3 组件展示

用紧凑的功能网格，不要做太大的卡片堆砌。

组件列表：

- Search
- Quick Capture
- Four Quadrants
- Focus Timer
- Countdown
- Week Calendar
- Month Calendar
- Stats
- Knowledge Graph
- Next Action

每个组件展示：

- 图标
- 名称
- 1 句价值说明
- 可选小截图或局部截图

### 5.4 AI 能力

说明要真实，不夸大：

- DeepSeek 优先接入
- 可配置 API Key
- AI 用于搜索理解、任务归类、知识图谱整理、下一步建议
- 用户数据保存在本地工作区 `.leap`
- AI 请求只在用户触发相关功能时发生

需要有隐私说明入口。

### 5.5 安装与配置

展示简单步骤：

1. Install Leap Home
2. Open command: `Leap Home: Open`
3. Optional: configure DeepSeek API Key
4. Create or customize your homepage

提供链接：

- Open VSX
- GitHub
- README 中文
- README English

### 5.6 截图展示

截图不需要太多，首版 4 张即可：

- Home overview
- Quick capture
- Planning calendar
- Knowledge graph

截图要真实、清晰、不要过度裁剪。

### 5.7 FAQ

首版 FAQ：

- Does Leap Home work in Cursor?
- Does it work in VS Code?
- Where is my data stored?
- Does AI send my notes to DeepSeek?
- Can I customize the layout?
- Does it support English and Chinese?
- How is it different from normal editor search?

## 6. 视觉方向

风格关键词：

- 开发者工具
- 安静、克制、专业
- 接近 Cursor / VS Code 气质
- 黑色主题优先
- 不要 SaaS 营销页那种大渐变、大卡片、大废话

建议配色：

- 背景：接近 VS Code / Cursor 深色
- 主色：偏蓝，用于按钮和强调
- 辅助色：绿色、黄色、粉色少量用于组件标签
- 避免整页紫蓝渐变

排版：

- 英文为主，中文作为切换语言或双语说明
- 首屏 H1 可以大，但组件区要紧凑
- 截图和功能说明要比装饰更重要

## 7. 技术方案

首版推荐：

- Astro 或 Next.js
- 静态导出
- 部署到 GitHub Pages / Cloudflare Pages
- 后续可接入 Plausible / Umami / Google Analytics
- 接入 Google Search Console

如果优先简单：

- 使用 Astro
- 内容页用 Markdown
- 自动生成 sitemap
- 中英文路由清晰

目录建议：

```text
leap-home-site/
  docs/
    homepage-design.md
  src/
  public/
  package.json
  astro.config.mjs
```

## 8. 首版页面内容草案

### Hero

标题：

```text
Leap Home
```

副标题：

```text
A customizable knowledge homepage for Cursor and VS Code.
```

说明：

```text
Search your workspace, capture ideas, plan tasks, track focus, explore knowledge graphs, and let AI suggest what to do next.
```

中文说明：

```text
在 Cursor / VS Code 中，把知识库搜索、快速记录、四象限、番茄时钟、日历、知识图谱和 AI 下一步推荐放进一个可自由布局的首页。
```

按钮：

- Install from Open VSX
- View on GitHub
- Read docs

### Feature copy

Search:

```text
Search Markdown, code, prompts, tasks, calendar events, and captures with command syntax or AI understanding.
```

Next Action:

```text
Let AI turn scattered tasks, notes, countdowns, and focus history into practical next actions.
```

Focus Timer:

```text
Track Pomodoro sessions, external app focus, interruptions, and task-linked focus history.
```

Knowledge Graph:

```text
Discover relationships between documents, tags, topics, prompts, and workspace knowledge.
```

## 9. 首版 TODO

- [ ] 确认域名和最终站点名称
- [ ] 确认部署平台：GitHub Pages / Cloudflare Pages / 其他
- [ ] 选择技术栈：Astro / Next.js
- [ ] 准备 4 张压缩后的产品截图
- [ ] 准备 Open Graph 图片
- [ ] 实现首页首屏
- [ ] 实现功能区和组件区
- [ ] 实现安装步骤和 FAQ
- [ ] 添加中英文内容
- [ ] 添加 `sitemap.xml` 和 `robots.txt`
- [ ] 添加 `SoftwareApplication` 结构化数据
- [ ] 配置 Search Console
- [ ] 部署并检查 Lighthouse / SEO 基础项

## 10. 后续扩展

- 独立文档页
- DeepSeek 配置教程
- 搜索组件深度介绍
- AI Next Action 使用示例
- 更新日志页面
- 博客文章：如何用 Cursor 搭个人知识库首页
- 社区传播页：截图、GIF、好评文案、发布帖素材
