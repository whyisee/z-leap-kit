import type { TopicType } from "../src/lib/types.ts";

export interface LaunchTopicSeed {
  title: string;
  slug: string;
  category: string;
  type: TopicType;
  tags: string[];
  summary: string;
  body: string;
  pinned?: boolean;
  featured?: boolean;
  replies?: string[];
}

interface LaunchTopicInput extends Omit<LaunchTopicSeed, "body"> {
  context: string;
  actions: string[];
  tradeoff: string;
  question: string;
}

function topic(input: LaunchTopicInput): LaunchTopicSeed {
  const { context, actions, tradeoff, question, ...seed } = input;

  return {
    ...seed,
    body: [
      "## 场景",
      context,
      "## 可执行做法",
      actions.map((item) => `- ${item}`).join("\n"),
      "## 取舍",
      tradeoff,
      "## 想讨论",
      question,
    ].join("\n\n"),
  };
}

export const launchTopics: LaunchTopicSeed[] = [
  topic({
    title: "whyisee.xyz 首版内容会先解决哪些真实问题",
    slug: "whyisee-first-content-real-user-needs",
    category: "announcements",
    type: "announcement",
    tags: ["community-ops", "indie-dev", "user-feedback"],
    summary: "首版内容不再按分类填满，而是围绕 AI 开发、独立开发、上线和流量里的真实卡点组织。",
    context:
      "早期社区最容易犯的错，是把首页填成一组看起来完整、但没人想点的分类样板文。whyisee.xyz 第一版内容会先服务几类明确需求：工具不知道怎么选、项目上线没人用、AI 写代码失控、网站没有流量、想发帖求反馈但不知道怎么描述问题。",
    actions: [
      "首批内容缩到 24 篇左右，只保留能让用户下一步行动的主题。",
      "每篇帖子必须有具体场景、可执行步骤、取舍和一个明确讨论问题。",
      "不伪装真实经历，不用 AI 批量堆泛泛教程。",
      "首页优先展示卡点、工具选择、上线复盘和项目求反馈，而不是单纯按分类铺内容。",
    ],
    tradeoff:
      "内容少会让社区显得没那么热闹，但内容密度更高。早期要先让用户觉得这里值得看，再考虑规模。",
    question: "如果你第一次打开 whyisee.xyz，最希望先解决哪类问题：AI 工具、项目方向、上线部署，还是流量增长？",
    pinned: true,
    featured: true,
    replies: [
      "我会优先看“卡住排查”类内容。能解决一个具体错误，比十篇趋势判断更容易让我留下。",
      "项目求反馈入口也很重要。很多人不是没有想法，是不知道怎么把问题讲到别人愿意帮忙看。",
    ],
  }),
  topic({
    title: "Cursor 一直改错同一个 bug，怎么让它先收敛上下文？",
    slug: "cursor-keeps-fixing-wrong-bug-context",
    category: "ai-tools",
    type: "question",
    tags: ["cursor", "ai-workflow", "codex"],
    summary: "当 AI 反复改错位置时，先停止追加指令，把复现路径、文件边界和验收方式收窄。",
    context:
      "现在很多人用 Cursor 或类似 AI IDE 修 bug，最常见的崩溃点不是模型完全不会，而是上下文太散。它看到一些相关文件，就开始猜；你继续催，它就继续扩大修改范围。最后 bug 没修好，旁边的 UI、文案、类型定义都被动过。",
    actions: [
      "先写一条最小复现命令或复现步骤，不要让 AI 自己猜错误是否存在。",
      "指定只读范围和可修改范围，例如“先只看这 3 个文件，不要改代码”。",
      "要求 AI 先列 3 个可能根因，并说明每个根因要验证什么。",
      "一次只允许一个最小补丁，补丁后立刻跑同一个验证命令。",
      "如果两次都失败，换成“整理当前失败事实”，不要继续让它自由修。",
    ],
    tradeoff:
      "这会比直接说“继续修”慢一点，但能避免 AI 进入无效循环。真正省时间的是缩小错误空间，不是让模型多试几次。",
    question: "你遇到 AI 反复改错同一个问题时，最有效的收敛办法是什么？",
    featured: true,
    replies: [
      "我现在会先让 AI 输出“我不能确定的部分”。这个比它自信给方案更有用，因为能暴露上下文缺口。",
      "如果没有测试命令，我会先让它写一个很小的断言或日志点。否则它每次都像在凭感觉修。",
    ],
  }),
  topic({
    title: "Codex、Claude Code、Cursor 同时用，任务到底怎么分才不乱？",
    slug: "codex-claude-code-cursor-task-split",
    category: "ai-tools",
    type: "article",
    tags: ["codex", "claude-code", "cursor", "ai-workflow"],
    summary: "多工具不是同时开火，而是按读代码、改代码、验收、解释和复盘拆出角色边界。",
    context:
      "AI 编程工具已经从补全变成 Agent、后台任务、代码库理解和自动审查。问题也随之变了：不是工具不够强，而是多个工具同时参与后，谁读、谁改、谁验收、谁解释没有边界。",
    actions: [
      "Cursor 负责编辑器内的小步修改和即时上下文，不让它承担长链路任务。",
      "Codex 负责跨文件任务、跑命令、整理变更和收尾验证。",
      "Claude Code 或长上下文工具负责阅读旧系统、比较方案和解释复杂代码。",
      "每轮只指定一个主执行者，其他工具只做审阅或反问。",
      "所有工具交接时必须输出：已知事实、改动边界、未验证风险。",
    ],
    tradeoff:
      "分工会减少“一个工具全包”的爽感，但能降低互相覆盖、重复推翻和上下文污染。项目越大，边界越重要。",
    question: "你的 AI 工具链里，现在最混乱的是上下文、代码修改，还是验证闭环？",
    featured: true,
    replies: [
      "我会把“方案讨论”和“动手改代码”分开。方案阶段允许多模型讨论，执行阶段只留一个主 Agent。",
    ],
  }),
  topic({
    title: "DeepSeek 返回 JSON 又乱了，是提示词问题还是产品设计问题？",
    slug: "deepseek-json-output-product-design",
    category: "ai-tools",
    type: "question",
    tags: ["deepseek", "model-integration", "ai-workflow"],
    summary: "结构化输出失败时，不能只改提示词，也要给产品层做校验、重试、降级和可解释反馈。",
    context:
      "很多 AI 功能第一次接入时看起来能用，真实输入一多就出现 JSON 缺逗号、字段丢失、类型不对、解释文本混进结构体。用户看到的是“AI 不智能”，开发者看到的是解析异常。",
    actions: [
      "把输出 schema 写成代码里的校验，而不是只写在 prompt 里。",
      "让模型只输出最小结构，复杂解释放到另一个字段或后续请求。",
      "解析失败时做一次修复请求，但不要无限重试。",
      "给用户展示“AI 已理解为哪些搜索条件/分类结果”，让结果可检查。",
      "记录模型名、提示词版本、耗时、失败类型和原始错误摘要。",
    ],
    tradeoff:
      "严格结构化会牺牲一点生成自由度，但产品功能需要可控。越是要驱动系统行为的 AI 输出，越不能只靠自然语言。",
    question: "你接入模型时，最常见的问题是输出格式、速度、成本，还是结果不稳定？",
    featured: true,
    replies: [
      "我现在会把“模型生成”和“系统执行”隔开。模型给建议，系统决定哪些字段可信。",
      "最好能把 AI 实际使用的指令展示给用户，不然用户不知道它为什么搜不到。",
    ],
  }),
  topic({
    title: "VPS 上 systemd 启动正常，但网页就是登录不了，先查哪里？",
    slug: "vps-systemd-login-session-debug",
    category: "indie-dev",
    type: "question",
    tags: ["vps", "postgresql", "community-ops"],
    summary: "服务器能启动不代表会话正常，登录问题常常在环境变量、Cookie、安全头和反向代理。",
    context:
      "很多自建社区上线时会遇到一个尴尬问题：本地能登录，服务器上点完登录还是未登录。日志里没有明显崩溃，用户只觉得网站坏了。这个问题通常不是前端按钮，而是部署环境和会话链路。",
    actions: [
      "确认生产环境 `.env` 或 EnvironmentFile 是否真的被 systemd 读取。",
      "检查 SESSION_SECRET、PUBLIC_SITE_URL、Cookie secure/sameSite 和域名是否匹配。",
      "确认 Nginx 是否转发 X-Forwarded-Proto、Host 和真实 IP。",
      "登录后看响应里有没有 Set-Cookie，再看下一次请求是否带 Cookie。",
      "数据库连接失败和登录失败要分开排查，不要被同一个页面表现误导。",
    ],
    tradeoff:
      "这些检查不炫，但很省命。自建产品最大的敌人不是写不出功能，而是上线后缺少可定位的运行状态。",
    question: "你部署 Web 项目时，最容易踩的是数据库、反向代理、Cookie，还是 systemd 环境变量？",
    featured: true,
  }),
  topic({
    title: "新站 2 周不收录，是内容问题还是技术问题？",
    slug: "new-site-not-indexed-content-or-technical",
    category: "seo-traffic",
    type: "question",
    tags: ["google-search", "seo", "content-site"],
    summary: "新站不收录时，先区分可抓取、可索引、内容价值、内部链接和真实需求，不要只重复提交 URL。",
    context:
      "AI 搜索和 AI Overviews 改变了流量结构，但基础 SEO 仍然不能跳过。新站不收录时，如果只盯着 Search Console 提交，很容易忽略页面本身是不是值得被索引。",
    actions: [
      "先用 site:、URL Inspection 和服务器日志确认是否被抓取过。",
      "检查 robots、canonical、noindex、状态码和 sitemap。",
      "看首页到目标内容是否有清晰内部链接，而不是孤立页面。",
      "判断内容是不是回答了真实问题，还是只是泛泛介绍。",
      "首批内容先写可验证的问题和案例，不要急着批量铺长尾词。",
    ],
    tradeoff:
      "技术问题可以很快修，内容价值问题修起来慢。越早区分两者，越少浪费时间。",
    question: "你做新站时，通常多久开始看收录和搜索数据？",
    featured: true,
    replies: [
      "我会先查服务器日志有没有 Googlebot。没有抓取和抓取后不索引，是两个完全不同的问题。",
    ],
  }),
  topic({
    title: "AI 写出来像大纲复读机，怎么改到能发布？",
    slug: "ai-writing-outline-repetition-fix",
    category: "ai-tools",
    type: "question",
    tags: ["ai-writing", "community-ops"],
    summary: "AI 正文像大纲，通常是因为输入只有主题，没有立场、冲突、例子和读者任务。",
    context:
      "很多 AI 写作功能会把大纲扩写成一堆正确但无聊的话。看起来完整，读起来没有人味，也没有让读者下一步能做什么。社区里这种内容越多，越像批量生成站。",
    actions: [
      "先给 AI 一个具体读者和具体困境，而不是只给标题。",
      "要求正文必须包含一个反例、一个取舍和一个失败边界。",
      "生成后删除开场套话和结尾升华，保留具体判断。",
      "让 AI 标注哪些内容是推断，哪些来自已有资料。",
      "最后由人补入真实项目细节或操作截图。",
    ],
    tradeoff:
      "AI 适合起草，不适合替你拥有经验。真正能发布的内容，通常需要人把判断和边界补进去。",
    question: "你愿意在社区里读 AI 辅助写作的内容吗？前提是什么？",
    featured: false,
  }),
  topic({
    title: "图片上传功能上线前，不要只测本地目录能写",
    slug: "image-upload-server-directory-checklist",
    category: "productivity-tools",
    type: "article",
    tags: ["vps", "automation", "community-ops"],
    summary: "图片上传保存到服务器目录时，要同时检查权限、URL 映射、大小限制、清理策略和安全边界。",
    context:
      "社区发帖离不开图片，但上传功能很容易本地能用、服务器出错。尤其是把图片保存到服务器目录时，文件权限、静态访问路径和 Nginx 映射任何一个错了，用户都会觉得按钮坏了。",
    actions: [
      "上传目录放到明确的持久化路径，不要放进会被构建清理的目录。",
      "限制文件类型、大小和文件名，避免直接信任用户上传名。",
      "保存后立刻生成可访问 URL，并用 HTTP 请求验证。",
      "给编辑器插入 Markdown 图片语法，而不是只返回文件路径。",
      "记录上传失败原因，区分权限、体积、类型和网络错误。",
    ],
    tradeoff:
      "本地文件存储简单省钱，但后续要面对备份、清理和 CDN 问题。首版可以这样做，但边界要清楚。",
    question: "早期社区图片应该先本地存储，还是一开始就接对象存储？",
    featured: false,
  }),
  topic({
    title: "自动审核机器人没有跑，是调度问题还是数据库问题？",
    slug: "auto-review-bot-not-running-debug",
    category: "ai-tools",
    type: "question",
    tags: ["ai-agent", "automation", "postgresql"],
    summary: "后台自动任务要能展示下一次运行、上次运行、失败原因和手动触发结果，否则用户不知道它是否活着。",
    context:
      "不用 @ 的自动任务很适合社区审核，但用户点开后台只看到“启用”，却不知道任务有没有真的跑。调度器、数据库连接、AI 配置、任务状态任何一层失败，页面都可能看起来没变化。",
    actions: [
      "后台展示 lastRunAt、nextRunAt、lastError、processedCount 和建议结果。",
      "立即运行按钮必须返回本次扫描了几条内容、跳过了什么、失败在哪里。",
      "调度器启动时写日志，避免生产环境沉默失败。",
      "AI 配置缺失时不要假装运行，直接显示缺少默认模型。",
      "自动通过和只建议不执行要在 UI 上明确区分。",
    ],
    tradeoff:
      "自动任务的第一版可以简单，但必须可观察。看不见状态的自动化，只会制造新的不信任。",
    question: "你能接受审核机器人自动通过低风险内容吗，还是应该只给建议？",
    featured: false,
  }),
  topic({
    title: "低预算独立开发者，现在怎么搭一套 AI 编程工具链？",
    slug: "low-budget-ai-coding-toolchain",
    category: "ai-tools",
    type: "discussion",
    tags: ["cursor", "deepseek", "ai-workflow", "indie-dev"],
    summary: "预算有限时，不要追求所有工具都订阅，而要按任务频率和失败成本配置工具。",
    context:
      "中文独立开发者的现实约束很明显：预算、网络、账号、支付、模型限额都会影响工具选择。不是每个人都适合同时付费使用多个海外工具。",
    actions: [
      "高频小改动放在 IDE 内完成，避免每次都开长上下文 Agent。",
      "复杂任务集中使用一个强 Agent，减少重复消耗。",
      "低成本模型适合分类、摘要、草稿和结构化建议。",
      "重要代码改动必须保留测试和人工验收，不靠模型自证。",
      "每月复盘一次 AI 成本对应节省了哪些具体时间。",
    ],
    tradeoff:
      "省钱工具链可能不够丝滑，但能逼你把 AI 用在真正高价值的环节。",
    question: "如果每月 AI 工具预算有限，你会优先买编辑器、Agent，还是模型 API？",
    featured: true,
  }),
  topic({
    title: "什么时候该用 Agent，什么时候只该自己写？",
    slug: "when-to-use-agent-or-code-yourself",
    category: "ai-tools",
    type: "article",
    tags: ["ai-agent", "codex", "ai-workflow"],
    summary: "Agent 适合边界清楚、可验证的任务，不适合需求还没想明白的混沌探索。",
    context:
      "AI Agent 让人很容易把所有事情都丢出去。但任务越模糊，Agent 越可能把模糊理解成自由发挥。最后不是省时间，而是产生一堆需要你审查的变化。",
    actions: [
      "适合 Agent：迁移、批量重命名、补测试、按已有模式加页面、跑验证。",
      "不适合 Agent：产品方向、交互取舍、审美判断、没有验收标准的新功能。",
      "先写验收清单，再交给 Agent 执行。",
      "任务超过 30 分钟时，中间必须要求汇报当前状态和风险。",
    ],
    tradeoff:
      "Agent 不是越自治越好。独立开发者最需要的是可控产出，不是看起来很聪明的长过程。",
    question: "你最近一次让 Agent 做过头的任务是什么？",
    featured: false,
  }),
  topic({
    title: "AI 代码审查应该看风险，不应该只挑格式",
    slug: "ai-code-review-should-focus-risk",
    category: "ai-tools",
    type: "article",
    tags: ["codex", "ai-workflow", "automation"],
    summary: "自动审查的价值不在于多找几个命名问题，而在于发现行为回归、边界条件和缺失验证。",
    context:
      "AI 自动审查越来越常见，但如果它只是输出一堆风格建议，开发者很快会忽略它。真正有价值的审查应该优先指向会影响用户和线上稳定性的风险。",
    actions: [
      "要求 AI 按严重程度排序，只保留可复现或有明确依据的问题。",
      "重点检查权限、数据一致性、状态切换、错误处理和未跑测试。",
      "让 AI 引用文件和行号，不接受泛泛建议。",
      "把低风险风格问题放到格式化工具，不交给审查评论。",
    ],
    tradeoff:
      "严格限制输出会让 AI 审查显得没那么热闹，但会提升信任度。",
    question: "你会接受 AI 自动审查你的 PR 吗？什么样的评论会让你立刻忽略它？",
    featured: false,
  }),
  topic({
    title: "给 Agent 的知识库，不应该只是文档列表",
    slug: "agent-knowledge-base-not-document-list",
    category: "ai-tools",
    type: "article",
    tags: ["ai-agent", "knowledge-base", "ai-workflow"],
    summary: "Agent 真正需要的是任务相关的上下文入口、决策历史、代码边界和失败案例。",
    context:
      "把所有文档塞给 Agent，常常不如给它一份结构清楚的项目记忆。文档列表告诉它有什么，项目记忆告诉它为什么这么做、哪里不能动、以前失败过什么。",
    actions: [
      "为每个项目维护一页决策记录：为什么选这个方案，替代方案是什么。",
      "把常见失败和禁止事项写成 Agent 规则。",
      "给关键模块写“修改前先读”的入口文档。",
      "让 Agent 每次任务结束后补充一条可复用事实，而不是生成长总结。",
    ],
    tradeoff:
      "维护项目记忆需要额外成本，但能减少 Agent 反复问同样问题或踩同样坑。",
    question: "你的项目里，最希望 AI 永远记住哪三件事？",
    featured: false,
  }),
  topic({
    title: "AI 功能上线后，怎么判断建议到底准不准？",
    slug: "measure-ai-suggestion-quality",
    category: "ai-tools",
    type: "article",
    tags: ["model-integration", "ai-agent", "automation"],
    summary: "AI 建议不能只看生成是否成功，还要记录采纳、忽略、修改和后续结果。",
    context:
      "很多产品加了 AI 推荐，但没有记录用户是否采纳。结果只能说“AI 功能可用”，却不知道它是否真的帮用户做了决定。",
    actions: [
      "每条 AI 建议记录类型、理由、置信度和来源上下文。",
      "用户操作分成采纳、部分采纳、忽略、转为任务、继续追问。",
      "统计不同建议类型的采纳率和后续完成率。",
      "允许用户反馈“为什么不准”，用来修正提示词和上下文。",
    ],
    tradeoff:
      "记录行为会增加产品复杂度，但没有反馈闭环的 AI 推荐很难越用越好。",
    question: "你觉得 AI 建议的准确率，应该按采纳率、完成率，还是用户主观评分来算？",
    featured: false,
  }),
  topic({
    title: "2C2G VPS 能不能撑起一个早期社区网站？",
    slug: "can-2c2g-vps-run-early-community",
    category: "indie-dev",
    type: "question",
    tags: ["vps", "postgresql", "community-ops"],
    summary: "早期社区可以从 2C2G 起步，但要控制运行组件、图片存储、日志和后台任务。",
    context:
      "很多人一开始就纠结要不要上复杂架构。对早期社区来说，真正的问题不是 2C2G 能不能跑，而是你的首版功能有没有把资源浪费在不必要的东西上。",
    actions: [
      "先让 Node 服务、PostgreSQL、Nginx 和静态资源链路稳定。",
      "图片上传限制大小，避免服务器磁盘被快速打满。",
      "后台任务控制频率，失败时不要无限重试。",
      "开启基础监控：CPU、内存、磁盘、请求量和错误日志。",
      "当慢查询、图片流量或并发增长时，再考虑拆分服务。",
    ],
    tradeoff:
      "小机器能逼你保持简单，但也要求你认真做可观察性。没有监控，小配置会变成玄学。",
    question: "你会先用小 VPS 验证社区，还是一开始就上托管数据库和对象存储？",
    featured: true,
  }),
  topic({
    title: "小游戏站接广告，第一周到底该验证什么？",
    slug: "mini-game-site-first-week-validation",
    category: "indie-dev",
    type: "discussion",
    tags: ["mini-game", "adsense", "product-validation"],
    summary: "小游戏站不是先铺 100 个游戏，而是先验证用户入口、停留时间、版权边界和广告体验。",
    context:
      "很多课程会把小游戏站接广告讲得很轻松，好像只要买域名、搬游戏、等流量就行。真实难点是持续流量、内容差异化、用户停留和合规风险。",
    actions: [
      "先选一个细分主题或玩法，不要泛泛做大全站。",
      "第一周只验证 5 到 10 个页面的加载速度、停留时间和跳出率。",
      "每个游戏补原创介绍、玩法说明或攻略，而不是只有嵌入页面。",
      "确认素材、游戏来源和广告位置不会带来版权或体验问题。",
      "先看用户是否愿意玩完一局，再谈广告收益。",
    ],
    tradeoff:
      "小游戏站可以做，但它不是被动收入机器。它更像内容产品，需要持续维护体验和流量入口。",
    question: "你判断小游戏站是否值得做，会优先看搜索量、游戏来源，还是用户停留？",
    featured: true,
  }),
  topic({
    title: "Open VSX 插件 3 天 0 下载，我先改 README 还是先推广？",
    slug: "open-vsx-zero-downloads-readme-or-promotion",
    category: "seo-traffic",
    type: "question",
    tags: ["open-vsx", "cursor-plugin", "plugin"],
    summary: "0 下载不一定是推广问题，先检查用户能否在 30 秒内看懂插件解决什么、怎么安装、是否可信。",
    context:
      "插件发布后没人下载，很容易归因到平台没流量。但用户点进页面后，如果看不到截图、真实场景、安装方式、权限边界和更新记录，就算有流量也不会转化。",
    actions: [
      "README 首屏写清：插件解决什么问题，适合谁，不适合谁。",
      "放 3 到 5 张真实截图，不要只放概念图。",
      "补充安装方式、配置项、数据存储位置和隐私说明。",
      "把核心功能录成短动图或截图序列。",
      "再去社区发帖求反馈，而不是直接求下载。",
    ],
    tradeoff:
      "推广能带来曝光，但没有可信页面，曝光会浪费。先把落地页当产品体验的一部分。",
    question: "你安装编辑器插件前，最需要看到的是截图、功能清单、评价，还是数据安全说明？",
    featured: true,
    replies: [
      "我会先看截图。如果截图里看不出真实工作流，基本不会继续读 README。",
    ],
  }),
  topic({
    title: "内容站在 AI 搜索时代还值得做吗？",
    slug: "content-site-worth-building-in-ai-search-era",
    category: "seo-traffic",
    type: "discussion",
    tags: ["content-site", "seo", "traffic-growth"],
    summary: "纯搬运和泛教程会更难，但有独立经验、工具、案例和社区讨论的内容仍然有价值。",
    context:
      "AI Overviews 和 AI Mode 让搜索结果更像答案聚合。小站如果只写通用知识，很可能被摘要吃掉点击。但这不代表内容站完全没机会。",
    actions: [
      "写搜索结果里难以合成的内容：真实错误、数据复盘、具体配置和决策过程。",
      "把文章和工具、模板、清单、讨论入口结合起来。",
      "每篇内容回答一个真实问题，不要追求泛泛大全。",
      "用内部链接把同一类问题串起来，形成专题入口。",
      "不要只看搜索展示，也要看收藏、回访和站内搜索。",
    ],
    tradeoff:
      "AI 搜索降低了低质量内容的价值，但提高了真实经验和可操作内容的稀缺性。",
    question: "你现在还会点开搜索结果里的文章吗？什么情况下会点？",
    featured: true,
  }),
  topic({
    title: "AI wrapper 还能做，但别再从聊天框开始",
    slug: "ai-wrapper-start-from-workflow-not-chatbox",
    category: "indie-dev",
    type: "article",
    tags: ["ai-agent", "product-validation", "mvp"],
    summary: "AI wrapper 的机会不在“也能聊天”，而在把模型嵌进一个高频、具体、可复盘的工作流。",
    context:
      "现在很多人一听 AI wrapper 就觉得没机会。其实问题不在调用模型，而在用户为什么不直接用通用模型。如果你的产品只是多一个输入框，就很难成立。",
    actions: [
      "从用户已有流程里找最痛的一步，不从模型能力开始想产品。",
      "让 AI 输出直接改变系统状态，例如创建任务、整理文档、生成配置。",
      "沉淀用户历史、模板、上下文和结果复盘，让产品越用越贴合。",
      "首版只做一个 10 分钟能验证的窄场景。",
    ],
    tradeoff:
      "窄场景会限制想象空间，但也更容易建立差异化。通用入口很大，也最容易被大产品吞掉。",
    question: "你见过真正有价值的 AI wrapper 吗？它的价值来自模型，还是来自工作流？",
    featured: false,
  }),
  topic({
    title: "失败复盘：功能越做越多，用户反而不知道入口在哪里",
    slug: "failure-review-too-many-features-no-entry",
    category: "indie-dev",
    type: "article",
    tags: ["failure-review", "mvp", "user-feedback"],
    summary: "功能数量不能替代产品入口。早期产品最需要的是一个用户马上能理解的主动作。",
    context:
      "独立开发最容易出现一种假进展：每天都在加功能，截图越来越丰富，但用户打开后不知道第一步该做什么。功能变多不等于产品变强，尤其是工具型产品。",
    actions: [
      "列出用户打开页面后的第一个动作，只保留最重要的一个。",
      "把其他功能收进二级入口，不要和主动作抢注意力。",
      "用 5 个新用户测试是否能在 30 秒内说出产品解决什么。",
      "每次加功能前先问：它是否强化主路径，还是只是让页面更满。",
    ],
    tradeoff:
      "砍功能会让开发者心疼，但用户只会为清晰价值留下，不会为你的工作量留下。",
    question: "你有没有做过一个自己很满意、但别人打开后不知道怎么用的功能？",
    featured: true,
  }),
  topic({
    title: "社区冷启动没人回复，是内容不行还是入口太高？",
    slug: "community-cold-start-no-replies",
    category: "indie-dev",
    type: "discussion",
    tags: ["community-ops", "cold-start", "user-feedback"],
    summary: "早期没人回复不一定是没人看，也可能是问题太大、身份压力太高、回复成本太高。",
    context:
      "小社区最难受的不是没有帖子，而是帖子下面空空的。很多站长会开始刷互动，但如果主题本身让人不知道怎么接，刷再多也没有讨论感。",
    actions: [
      "把大问题改成小问题，例如“你会怎么排查这个错误”而不是“AI 开发怎么看”。",
      "提供回复模板：经验、反例、工具、下一步建议。",
      "允许短回复和求助，不要一开始就要求长文质量。",
      "站长优先回复具体卡点，不要只回复欢迎语。",
      "每周整理一次值得继续讨论的问题，让沉下去的帖有第二次曝光。",
    ],
    tradeoff:
      "早期社区要降低参与门槛，但不能降低内容质量。关键是让低成本回复也能有信息量。",
    question: "你在一个新社区愿意第一次回复，通常是因为什么？",
    featured: false,
  }),
  topic({
    title: "Leap Home 做了很多组件，下一步该砍掉什么？",
    slug: "leap-home-too-many-components-next-step",
    category: "projects",
    type: "project",
    tags: ["project-showcase", "cursor-plugin", "knowledge-base", "feedback"],
    summary: "组件化工作台不能只靠组件数量取胜，必须找到用户每天打开它的高频理由。",
    context:
      "Leap Home 的方向是 Cursor 里的个人知识库首页，已经有搜索、四象限、日历、统计、番茄、知识图谱和推荐。但组件多了以后，真正的问题变成：哪几个组件构成每天必开的闭环？",
    actions: [
      "把搜索、任务、番茄和日历作为第一组高频闭环验证。",
      "把知识图谱和做什么推荐定位为增强组件，而不是首屏必备。",
      "模板少而精，每个模板对应一个真实工作流。",
      "记录组件使用频率，而不是只按开发者喜好继续加。",
    ],
    tradeoff:
      "自由布局让产品有想象力，但首版仍然需要强默认模板。用户不是来装修页面的，是来更快进入工作状态的。",
    question: "如果你只能在 Cursor 首页保留 3 个组件，会选哪 3 个？",
    featured: true,
  }),
  topic({
    title: "写作页面做得太强，为什么反而更难发帖？",
    slug: "writing-page-too-powerful-harder-to-post",
    category: "indie-dev",
    type: "article",
    tags: ["failure-review", "ai-writing", "user-feedback"],
    summary: "发帖页不是功能展示厅，标题、正文、AI 辅助、发布设置和底部操作要服务一个流畅写作路径。",
    context:
      "社区发帖页很容易越做越复杂：分类、类型、标签、AI 写作、图片上传、发布设置、草稿、审核。功能都合理，但堆在一起会让用户感觉还没开始写就被配置淹没。",
    actions: [
      "标题和正文保持最强视觉优先级，其他配置默认收起或放侧边。",
      "AI 写作只在用户需要时出现，不抢输入区域。",
      "底部只保留草稿、取消、提交等必要动作。",
      "工具条固定，但不要像后台表单一样沉重。",
      "默认值要足够好，让用户不配置也能提交。",
    ],
    tradeoff:
      "高级功能需要保留，但不能牺牲第一次发帖的顺滑感。写作界面越强，越要懂得隐藏复杂度。",
    question: "你发帖时最讨厌先配置什么：分类、标签、类型，还是 AI 选项？",
    featured: false,
  }),
  topic({
    title: "帮我看一下这个项目，第一步应该改哪里？",
    slug: "project-clinic-first-thing-to-improve",
    category: "projects",
    type: "project",
    tags: ["project-showcase", "feedback", "product-validation"],
    summary: "项目求反馈最好不要只贴链接，而要说明目标用户、当前阶段、最担心的问题和希望别人看什么。",
    context:
      "很多项目展示帖没人回复，不是项目差，而是读者不知道该评价什么。只贴一个链接，别人要自己猜你的目标、阶段、问题和希望得到的反馈，成本太高。",
    actions: [
      "用一句话说明项目解决什么问题，以及目标用户是谁。",
      "列出当前阶段：想法、Demo、已上线、已有用户、准备收费。",
      "明确最需要反馈的 1 到 2 个点，例如首页、定价、交互或推广。",
      "贴出截图、Demo、仓库或测试账号，但不要让用户必须先安装才能理解。",
      "回复别人的建议时记录下一步是否会采纳。",
    ],
    tradeoff:
      "求反馈写得越具体，收到的回复越少但越有用。泛泛求评价通常只能得到泛泛鼓励。",
    question: "如果你愿意帮别人看项目，最希望对方先提供哪些信息？",
    featured: true,
  }),
  topic({
    title: "今天你被哪个问题卡住了？贴日志也行",
    slug: "daily-stuck-thread-post-your-blocker",
    category: "projects",
    type: "discussion",
    tags: ["feedback", "community-ops", "ai-workflow"],
    summary: "给不想写长文的人一个低成本入口：贴出卡点、环境、已经试过什么，社区一起拆下一步。",
    context:
      "不是每个用户都有精力写完整复盘。有时候他们只是卡在一个错误、一个选择、一个不确定的下一步。社区应该允许这种低成本求助，但要让求助足够清楚。",
    actions: [
      "描述你想达成什么，而不是只贴报错。",
      "写清环境：系统、工具、版本、部署方式或模型。",
      "列出已经试过的 2 到 3 件事。",
      "说明你希望别人帮你判断根因、给步骤，还是帮你选方向。",
    ],
    tradeoff:
      "这种帖不一定能沉淀成长文，但能让新用户更容易参与，也能暴露真实需求。",
    question: "你今天最想让别人帮你看的一件小事是什么？",
    featured: true,
  }),
];
