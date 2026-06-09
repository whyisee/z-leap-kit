export type Lang = "zh" | "en";

export const defaultLang: Lang = "zh";
export const langCookieName = "whyisee_lang";

const supportedLanguages = new Set(["zh", "en"]);

export function normalizeLang(value: string | undefined | null): Lang {
  return supportedLanguages.has(value || "") ? (value as Lang) : defaultLang;
}

export function getLangFromAstro(astro: {
  cookies: { get(name: string): { value?: string } | undefined };
  url: URL;
}): Lang {
  return normalizeLang(
    astro.url.searchParams.get("lang") ||
      astro.cookies.get(langCookieName)?.value,
  );
}

export function getLangFromRequest(request: Request): Lang {
  const url = new URL(request.url);
  const queryLang = url.searchParams.get("lang");
  const cookieLang = request.headers
    .get("cookie")
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${langCookieName}=`))
    ?.split("=")[1];

  return normalizeLang(queryLang || cookieLang);
}

type TranslationKey =
  | "site.title"
  | "site.description"
  | "site.slogan"
  | "header.login"
  | "header.language"
  | "header.sidebarToggle"
  | "header.sidebarExpand"
  | "header.sidebarCollapse"
  | "header.admin"
  | "nav.see"
  | "nav.seeHint"
  | "nav.go"
  | "nav.goHint"
  | "nav.following"
  | "nav.followingHint"
  | "nav.latest"
  | "nav.categories"
  | "nav.projects"
  | "nav.about"
  | "nav.guidelines"
  | "page.see"
  | "page.seeDescription"
  | "page.go"
  | "page.goDescription"
  | "page.following"
  | "page.followingDescription"
  | "home.feed"
  | "home.latestTopics"
  | "home.allTopics"
  | "home.allTopicsAria"
  | "topic.topic"
  | "topic.replies"
  | "topic.views"
  | "topic.activity"
  | "topic.pinned"
  | "topic.project"
  | "topic.info"
  | "topic.published"
  | "topic.related"
  | "topic.notFound"
  | "topic.notFoundDescription"
  | "category.category"
  | "category.notFound"
  | "category.notFoundDescription"
  | "tag.tag"
  | "tag.notFound"
  | "tag.notFoundDescription"
  | "sidebar.status"
  | "sidebar.statusText"
  | "sidebar.featured"
  | "sidebar.categories"
  | "sidebar.tags"
  | "page.latest"
  | "page.categories"
  | "page.projects"
  | "page.about"
  | "page.guidelines"
  | "page.latestDescription"
  | "page.categoriesDescription"
  | "page.projectsDescription"
  | "page.aboutDescription"
  | "page.guidelinesDescription"
  | "page.submitProjectDraft"
  | "page.items"
  | "about.body1"
  | "about.body2"
  | "guidelines.item1"
  | "guidelines.item2"
  | "guidelines.item3"
  | "guidelines.item4"
  | "guidelines.item5"
  | "admin.title"
  | "admin.description"
  | "admin.newTopic"
  | "admin.newTopicDescription"
  | "admin.newTopicPageDescription"
  | "admin.titleLabel"
  | "admin.titlePlaceholder"
  | "admin.bodyLabel"
  | "admin.bodyPlaceholder"
  | "admin.saveDraft"
  | "admin.backToSite"
  | "auth.loginTitle"
  | "auth.loginDescription"
  | "auth.username"
  | "auth.password"
  | "auth.usernamePlaceholder"
  | "auth.passwordPlaceholder"
  | "auth.loginAction"
  | "auth.loginError"
  | "auth.loginDisabled"
  | "auth.devHint"
  | "auth.logout"
  | "auth.loggedInAs"
  | "footer.icpPending"
  | "404.title"
  | "404.description"
  | "404.backHome";

const translations: Record<Lang, Record<TranslationKey, string>> = {
  zh: {
    "site.title": "whyisee - 独立开发与 AI 工具实战社区",
    "site.description":
      "whyisee 是一个面向独立开发者、AI 工具玩家、效率工具作者和小产品站长的实战社区。",
    "site.slogan": "看见想法，让灵感出发",
    "header.login": "登录",
    "header.language": "语言",
    "header.sidebarToggle": "展开或收起侧边栏",
    "header.sidebarExpand": "展开侧边栏",
    "header.sidebarCollapse": "收起侧边栏",
    "header.admin": "管理后台",
    "nav.see": "看见",
    "nav.seeHint": "首页推荐",
    "nav.go": "出发",
    "nav.goHint": "值得参与",
    "nav.following": "关注",
    "nav.followingHint": "用户关注",
    "nav.latest": "最新",
    "nav.categories": "分类",
    "nav.projects": "项目展示",
    "nav.about": "关于",
    "nav.guidelines": "社区规则",
    "page.see": "看见",
    "page.seeDescription": "根据你的关注、阅读、收藏和社区质量信号推荐内容。",
    "page.go": "出发",
    "page.goDescription": "这里是你现在最值得参与的讨论、项目、问题和任务。",
    "page.following": "关注",
    "page.followingDescription": "来自你关注的人、话题、分类和标签的更新。",
    "home.feed": "话题流",
    "home.latestTopics": "最新话题",
    "home.allTopics": "全部话题",
    "home.allTopicsAria": "查看全部话题",
    "topic.topic": "话题",
    "topic.replies": "回复",
    "topic.views": "浏览",
    "topic.activity": "活动",
    "topic.pinned": "置顶",
    "topic.project": "项目",
    "topic.info": "话题信息",
    "topic.published": "发布",
    "topic.related": "相关话题",
    "topic.notFound": "话题未找到",
    "topic.notFoundDescription": "这个话题不存在，或者尚未发布。",
    "category.category": "分类",
    "category.notFound": "分类未找到",
    "category.notFoundDescription": "这个分类还没有创建，或者已经被隐藏。",
    "tag.tag": "标签",
    "tag.notFound": "标签未找到",
    "tag.notFoundDescription": "这个标签还没有创建。",
    "sidebar.status": "社区状态",
    "sidebar.statusText":
      "当前处于自研 MVP 阶段。先沉淀内容，再逐步开放邀请制互动。",
    "sidebar.featured": "精选话题",
    "sidebar.categories": "分类",
    "sidebar.tags": "标签",
    "page.latest": "最新话题",
    "page.categories": "社区分类",
    "page.projects": "项目展示",
    "page.about": "关于 whyisee",
    "page.guidelines": "社区规则",
    "page.latestDescription": "whyisee 最新话题、项目展示和独立开发复盘。",
    "page.categoriesDescription":
      "whyisee 社区分类：AI、小A、读书、沙雕、福利、资源、文档、项目和树洞。",
    "page.projectsDescription":
      "whyisee 项目展示，发布工具、插件、网站、小游戏和开源项目。",
    "page.aboutDescription":
      "whyisee 是一个给独立开发者、AI 工具玩家和小产品站长的实战社区。",
    "page.guidelinesDescription": "whyisee 社区规则和内容边界。",
    "page.submitProjectDraft": "提交项目草稿",
    "page.items": "条",
    "about.body1":
      "whyisee 是一个面向独立开发者、AI 工具玩家、效率工具作者和小产品站长的实战社区。这里关注真实项目、真实复盘、真实踩坑，而不是泛泛的概念讨论。",
    "about.body2":
      "首版会先由站长发布种子内容，等内容结构和运营节奏稳定后，再逐步开放邀请制互动。",
    "guidelines.item1": "鼓励真实项目、真实复盘和具体问题。",
    "guidelines.item2": "允许 AI 辅助写作，但内容必须有人的判断和上下文。",
    "guidelines.item3": "不做刷量、互点广告、灰产和标题党内容。",
    "guidelines.item4": "提问时请提供背景、目标、已经尝试的方法和卡住的位置。",
    "guidelines.item5": "项目展示请说明当前阶段、希望获得什么反馈。",
    "admin.title": "管理后台",
    "admin.description": "管理社区话题、草稿、发布状态、置顶和精选内容。",
    "admin.newTopic": "新建话题",
    "admin.newTopicDescription":
      "填写标题、正文、分类、标签和发布状态，保存为草稿或直接发布。",
    "admin.newTopicPageDescription": "whyisee 新建话题。",
    "admin.titleLabel": "标题",
    "admin.titlePlaceholder": "写一个具体的问题或复盘标题",
    "admin.bodyLabel": "正文",
    "admin.bodyPlaceholder": "Markdown 正文",
    "admin.saveDraft": "保存草稿",
    "admin.backToSite": "返回前台",
    "auth.loginTitle": "登录 whyisee",
    "auth.loginDescription":
      "登录后可以发帖、回复、维护个人资料。早期社区采用邀请制注册。",
    "auth.username": "用户名",
    "auth.password": "密码",
    "auth.usernamePlaceholder": "输入用户名或邮箱",
    "auth.passwordPlaceholder": "输入管理员密码",
    "auth.loginAction": "登录",
    "auth.loginError": "用户名或密码不正确。",
    "auth.loginDisabled":
      "登录尚未配置。生产环境请设置 WHYISEE_ADMIN_PASSWORD。",
    "auth.devHint": "开发环境默认账号：whyisee / whyisee。上线前必须修改。",
    "auth.logout": "退出登录",
    "auth.loggedInAs": "当前登录",
    "footer.icpPending": "ICP备案号：备案完成后展示",
    "404.title": "页面未找到",
    "404.description": "这个页面不存在，或者已经移动到新的位置。",
    "404.backHome": "回到首页",
  },
  en: {
    "site.title": "whyisee - Indie Building and AI Tools Community",
    "site.description":
      "whyisee is a practical community for indie builders, AI tool users, productivity tool makers, and small product founders.",
    "site.slogan": "See ideas. Launch inspiration.",
    "header.login": "Log In",
    "header.language": "Language",
    "header.sidebarToggle": "Toggle sidebar",
    "header.sidebarExpand": "Expand sidebar",
    "header.sidebarCollapse": "Collapse sidebar",
    "header.admin": "Admin",
    "nav.see": "See",
    "nav.seeHint": "Home recommendations",
    "nav.go": "Go",
    "nav.goHint": "Worth joining",
    "nav.following": "Following",
    "nav.followingHint": "Your follows",
    "nav.latest": "Latest",
    "nav.categories": "Categories",
    "nav.projects": "Projects",
    "nav.about": "About",
    "nav.guidelines": "Guidelines",
    "page.see": "See",
    "page.seeDescription": "Recommended content based on your follows, reading, saves, and community quality signals.",
    "page.go": "Go",
    "page.goDescription": "Discussions, projects, questions, and tasks worth joining now.",
    "page.following": "Following",
    "page.followingDescription": "Updates from people, topics, categories, and tags you follow.",
    "home.feed": "Topic Feed",
    "home.latestTopics": "Latest Topics",
    "home.allTopics": "All Topics",
    "home.allTopicsAria": "View all topics",
    "topic.topic": "Topic",
    "topic.replies": "Replies",
    "topic.views": "Views",
    "topic.activity": "Activity",
    "topic.pinned": "Pinned",
    "topic.project": "Project",
    "topic.info": "Topic Info",
    "topic.published": "Published",
    "topic.related": "Related Topics",
    "topic.notFound": "Topic Not Found",
    "topic.notFoundDescription":
      "This topic does not exist or has not been published yet.",
    "category.category": "Category",
    "category.notFound": "Category Not Found",
    "category.notFoundDescription":
      "This category has not been created or is hidden.",
    "tag.tag": "Tag",
    "tag.notFound": "Tag Not Found",
    "tag.notFoundDescription": "This tag has not been created yet.",
    "sidebar.status": "Community Status",
    "sidebar.statusText":
      "The community is in its self-built MVP stage. We are building content first, then opening invited interactions gradually.",
    "sidebar.featured": "Featured Topics",
    "sidebar.categories": "Categories",
    "sidebar.tags": "Tags",
    "page.latest": "Latest Topics",
    "page.categories": "Categories",
    "page.projects": "Projects",
    "page.about": "About whyisee",
    "page.guidelines": "Community Guidelines",
    "page.latestDescription":
      "Latest topics, project showcases, and indie building retrospectives from whyisee.",
    "page.categoriesDescription":
      "Community categories for AI, Xiao A, reading, fun, benefits, resources, docs, projects, and tree holes.",
    "page.projectsDescription":
      "Project showcases for tools, plugins, websites, small games, and open-source projects.",
    "page.aboutDescription":
      "whyisee is a practical community for indie builders, AI tool users, and small product founders.",
    "page.guidelinesDescription":
      "Community guidelines and content boundaries for whyisee.",
    "page.submitProjectDraft": "Submit Project Draft",
    "page.items": "items",
    "about.body1":
      "whyisee is a practical community for indie builders, AI tool users, productivity tool makers, and small product founders. It focuses on real projects, real retrospectives, and real lessons learned.",
    "about.body2":
      "The first version is seeded by the maintainer. Once content structure and operating rhythm are stable, invited interaction will open gradually.",
    "guidelines.item1":
      "Share real projects, real retrospectives, and specific questions.",
    "guidelines.item2":
      "AI-assisted writing is welcome, but posts must include human judgment and context.",
    "guidelines.item3":
      "No traffic manipulation, ad-click exchange, gray-market tactics, or clickbait.",
    "guidelines.item4":
      "When asking questions, include context, goal, what you tried, and where you are stuck.",
    "guidelines.item5":
      "Project showcase posts should explain the current stage and the feedback you want.",
    "admin.title": "Admin",
    "admin.description":
      "Manage community topics, drafts, publishing status, pinned items, and featured content.",
    "admin.newTopic": "New Topic",
    "admin.newTopicDescription":
      "Write the title, body, category, tags, and publishing status. Save as draft or publish directly.",
    "admin.newTopicPageDescription": "Create a new topic on whyisee.",
    "admin.titleLabel": "Title",
    "admin.titlePlaceholder":
      "Write a specific question or retrospective title",
    "admin.bodyLabel": "Body",
    "admin.bodyPlaceholder": "Markdown body",
    "admin.saveDraft": "Save Draft",
    "admin.backToSite": "Back to Site",
    "auth.loginTitle": "Log in to whyisee",
    "auth.loginDescription":
      "Log in to post topics, reply, and maintain your profile. Early access uses invitation codes.",
    "auth.username": "Username",
    "auth.password": "Password",
    "auth.usernamePlaceholder": "Enter username or email",
    "auth.passwordPlaceholder": "Enter admin password",
    "auth.loginAction": "Log In",
    "auth.loginError": "Invalid username or password.",
    "auth.loginDisabled":
      "Login is not configured. Set WHYISEE_ADMIN_PASSWORD in production.",
    "auth.devHint":
      "Development default: whyisee / whyisee. Change it before going live.",
    "auth.logout": "Log Out",
    "auth.loggedInAs": "Signed in as",
    "footer.icpPending": "ICP filing number: pending",
    "404.title": "Page Not Found",
    "404.description": "This page does not exist or has moved.",
    "404.backHome": "Back Home",
  },
};

export function t(lang: Lang, key: TranslationKey) {
  return translations[lang][key] || translations[defaultLang][key] || key;
}

export const categoryTranslations: Record<
  string,
  Partial<Record<Lang, { name: string; description: string }>>
> = {
  ai: {
    en: {
      name: "AI",
      description:
        "AI tools, models, agents, prompts, automation, and real workflows.",
    },
  },
  "xiao-a": {
    en: {
      name: "Xiao A",
      description:
        "Whyisee AI agents, Xiao A features, automated tasks, co-creation experiments, and feedback.",
    },
  },
  reading: {
    en: {
      name: "Reading",
      description:
        "Book lists, excerpts, reading notes, long-term learning, and knowledge organization.",
    },
  },
  funny: {
    en: {
      name: "Fun",
      description:
        "Lightweight posts, absurd findings, jokes, roasts, and community fun.",
    },
  },
  benefits: {
    en: {
      name: "Benefits",
      description:
        "Deals, campaigns, free resources, perks, and practical benefit alerts.",
    },
  },
  resources: {
    en: {
      name: "Resources",
      description:
        "Tools, links, tutorials, references, service recommendations, and reusable sources.",
    },
  },
  docs: {
    en: {
      name: "Docs",
      description:
        "Guides, tutorials, rules, explanations, retrospectives, and structured long-lived content.",
    },
  },
  projects: {
    en: {
      name: "Projects",
      description:
        "Show projects, products, websites, plugins, open-source work, and building progress.",
    },
  },
  "tree-hole": {
    en: {
      name: "Tree Hole",
      description:
        "Confusion, pressure, failure, rough ideas, and thoughts that do not fit formal discussion.",
    },
  },
  announcements: {
    en: {
      name: "Announcements",
      description:
        "Site updates, rules, feedback collection, and community operations.",
    },
  },
  "ai-tools": {
    en: {
      name: "AI Tools",
      description:
        "Cursor, Codex, Claude Code, DeepSeek, agents, prompts, and AI workflows.",
    },
  },
  "indie-dev": {
    en: {
      name: "Indie Building",
      description:
        "Ideas, MVPs, tech choices, launch notes, revenue reviews, and failure retrospectives.",
    },
  },
  "productivity-tools": {
    en: {
      name: "Productivity Tools",
      description:
        "Plugins, scripts, personal knowledge bases, automation, and developer productivity tools.",
    },
  },
  "seo-traffic": {
    en: {
      name: "SEO and Traffic",
      description:
        "Google SEO, content sites, community promotion, links, ads, and growth experiments.",
    },
  },
  "games-content-sites": {
    en: {
      name: "Games and Content Sites",
      description:
        "H5 game sites, content sites, ads, retention, and lightweight community experiments.",
    },
  },
  chat: {
    en: {
      name: "Chat",
      description:
        "Ideas, casual discussion, small updates, and community life.",
    },
  },
};

export const tagTranslations: Record<
  string,
  Partial<Record<Lang, { name: string; description: string }>>
> = {
  cursor: {
    en: {
      name: "cursor",
      description: "Cursor usage, plugin development, and workflows",
    },
  },
  codex: {
    en: {
      name: "codex",
      description: "Codex usage, development collaboration, and automation",
    },
  },
  deepseek: {
    en: {
      name: "deepseek",
      description: "DeepSeek API, model capabilities, and integration notes",
    },
  },
  seo: {
    en: {
      name: "seo",
      description: "Search engine optimization and organic traffic",
    },
  },
  adsense: {
    en: {
      name: "adsense",
      description: "Ad monetization and content-site revenue",
    },
  },
  "open-vsx": {
    en: {
      name: "open-vsx",
      description: "Open VSX extension publishing and promotion",
    },
  },
  "github-pages": {
    en: { name: "github-pages", description: "GitHub Pages sites and SEO" },
  },
  "indie-dev": {
    en: {
      name: "indie-dev",
      description: "Indie building process and retrospectives",
    },
  },
  plugin: {
    en: {
      name: "plugin",
      description: "Plugins, extensions, and tool development",
    },
  },
  "mini-game": {
    en: { name: "mini-game", description: "Small games and game sites" },
  },
  retrospective: {
    en: {
      name: "retrospective",
      description: "Project retrospectives and lessons learned",
    },
  },
  feedback: {
    en: {
      name: "feedback",
      description: "Project showcase and feedback requests",
    },
  },
};

export const topicTranslations: Record<
  string,
  Partial<
    Record<Lang, { title: string; summary: string; contentMarkdown: string }>
  >
> = {
  "why-build-whyisee-community": {
    en: {
      title: "Why I Decided to Build whyisee Myself",
      summary:
        "When ready-made forum systems become friction, a lightweight self-built MVP can validate content, traffic, and operating rhythm first.",
      contentMarkdown: `## Background

whyisee is not a forum built for technical vanity. It is an indie building experiment.

I want to validate a few questions:

- Do indie builders need a place for more honest retrospectives?
- Can AI tools, SEO, small products, and game sites form stable discussions?
- Can a 2C2G VPS support an early community?

## Current Choice

The first version will not be a full forum system. It starts as a lightweight content community. The maintainer will seed posts first, and invited interaction will open after the content structure and operating rhythm become stable.`,
    },
  },
  "cursor-codex-deepseek-real-workflow": {
    en: {
      title: "How Do Cursor, Codex, and DeepSeek Fit Into Real Development?",
      summary:
        "Not prompt demos, but a full workflow from requirements and coding to debugging, release, and retrospective.",
      contentMarkdown: `## The Problem

Many AI tool demos stop at looking smart. In real development, the harder questions are:

- Are requirements clear enough?
- Can the code be maintained?
- Can debugging locate real issues?
- Can the release be reviewed afterward?

## Direction

whyisee will keep documenting how AI tools work in real projects, including useful patterns and failed attempts.`,
    },
  },
  "open-vsx-no-download-checklist": {
    en: {
      title: "What to Check When an Open VSX Extension Gets No Downloads",
      summary:
        "Publishing is not the finish line. README, keywords, screenshots, community links, and real use cases all affect downloads.",
      contentMarkdown: `## Checklist

- Does the README have an English version?
- Do screenshots explain the value immediately?
- Does the extension title include searchable keywords?
- Are there links from GitHub, forums, and articles?
- Is there a real use case instead of only a feature list?

## Conclusion

Publishing is only step one. Extensions also need content, distribution, and a feedback loop.`,
    },
  },
  "leap-home-project-showcase": {
    en: {
      title: "Leap Home: A Cursor Homepage Plugin for Personal Knowledge Bases",
      summary:
        "A Cursor plugin that combines a knowledge homepage, Eisenhower matrix, calendar, search, Pomodoro, and next-action recommendations.",
      contentMarkdown: `## Project Intro

Leap Home is a Cursor plugin that puts a personal knowledge homepage in the editor area instead of the sidebar.

## Current Features

- Custom homepages
- Grid layout
- Search component
- Eisenhower matrix tasks
- Week and month calendars
- Pomodoro timer
- Next-action recommendations
- Knowledge graph

## Feedback Wanted

Should it feel more like a personal dashboard or a knowledge-base workbench?`,
    },
  },
  "2c2g-vps-community-start": {
    en: {
      title: "Can a 2C2G VPS Support an Early Community Site?",
      summary:
        "The early bottleneck is usually not the server. It is content, operations, and spam control.",
      contentMarkdown: `## Initial Judgment

A 2C2G VPS is enough for an early community if the first version avoids a heavy stack.

## First-Version Strategy

- Nginx handles static assets
- Node.js serves SSR pages and APIs
- PostgreSQL stores content
- Add dedicated search and cache services only after traffic grows`,
    },
  },
};
