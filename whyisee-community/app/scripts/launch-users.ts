export interface LaunchUserSeed {
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
}

export const launchUsers: LaunchUserSeed[] = [
  user("qiao_dev", "桥边开发", "独立开发者，喜欢把小工具做成可长期维护的产品。", "#8ab4f8", "#5ee0a0", "M 18 19 L 25 11 L 31 19 L 39 11 L 46 20 M 22 38 Q 32 45 42 38"),
  user("nora_flow", "Nora Flow", "关注 AI 工作流、写作辅助和项目协作效率。", "#b69cff", "#8ab4f8", "M 16 20 C 23 10 41 10 48 20 M 22 38 Q 32 44 42 38"),
  user("minseo", "敏 SEO", "长期观察内容站、搜索流量和小站增长。", "#5bd7e8", "#66d08c", "M 17 21 L 26 14 M 38 14 L 47 21 M 24 39 Q 32 43 40 39"),
  user("oldriver", "旧河", "偏爱复盘、长期主义和慢一点但更稳的产品节奏。", "#7fb3ff", "#ffd166", "M 18 22 C 25 14 39 14 46 22 M 24 38 Q 32 41 40 38"),
  user("gridpilot", "GridPilot", "习惯用网格、看板和自动化系统整理复杂任务。", "#5ee0a0", "#8ab4f8", "M 17 18 H 47 M 20 38 Q 32 45 44 38"),
  user("yue_ops", "月半运维", "喜欢简单可靠的部署、备份、日志和服务器管理。", "#ffd166", "#8ab4f8", "M 18 20 Q 32 9 46 20 M 25 39 Q 32 43 39 39"),
  user("stone_mvp", "石头 MVP", "产品验证爱好者，常把需求拆到最小闭环。", "#ff9f7a", "#ffd166", "M 16 21 L 25 14 L 32 21 L 39 14 L 48 21 M 24 39 Q 32 45 40 39"),
  user("cyanstack", "青栈", "后端、数据库和工具脚本都沾一点，喜欢可观测性。", "#5bd7e8", "#b69cff", "M 17 19 C 26 14 38 14 47 19 M 24 40 Q 32 43 40 40"),
  user("echo_growth", "Echo Growth", "研究社区冷启动、内容分发和早期增长实验。", "#ff7aa8", "#8ab4f8", "M 19 18 Q 32 9 45 18 M 25 39 Q 32 45 39 39"),
  user("lin_notes", "林间笔记", "把知识库、笔记和项目记录当成长期资产来维护。", "#66d08c", "#ffd166", "M 16 21 C 23 12 41 12 48 21 M 24 38 Q 32 42 40 38"),
  user("bytekai", "ByteKai", "AI 编程、插件开发和工程体验的重度使用者。", "#8ab4f8", "#ff7aa8", "M 18 19 L 25 12 M 39 12 L 46 19 M 24 39 Q 32 44 40 39"),
  user("zora_build", "Zora Build", "喜欢做发布清单、项目展示和真实反馈收集。", "#b69cff", "#ffd166", "M 18 21 Q 32 11 46 21 M 23 38 Q 32 46 41 38"),
  user("draftmoon", "DraftMoon", "写作、内容结构和去模板味表达的实践者。", "#ffd166", "#ff7aa8", "M 17 20 C 26 12 38 12 47 20 M 25 39 Q 32 42 39 39"),
  user("mika_ai", "Mika AI", "关注模型接入、提示设计和 AI 功能产品化。", "#5ee0a0", "#b69cff", "M 18 18 L 24 12 L 31 19 L 40 12 L 46 18 M 24 39 Q 32 44 40 39"),
];

export const launchTopicAuthorPools: Record<string, string[]> = {
  announcements: ["whyisee"],
  "ai-tools": ["nora_flow", "mika_ai", "bytekai", "gridpilot"],
  "indie-dev": ["stone_mvp", "qiao_dev", "zora_build", "oldriver", "lin_notes"],
  "seo-traffic": ["minseo", "echo_growth", "oldriver"],
  "productivity-tools": ["gridpilot", "yue_ops", "cyanstack", "lin_notes"],
  projects: ["qiao_dev", "zora_build", "lin_notes"],
};

export const launchReplyAuthorPool = [
  "qiao_dev",
  "nora_flow",
  "minseo",
  "oldriver",
  "gridpilot",
  "yue_ops",
  "stone_mvp",
  "cyanstack",
  "echo_growth",
  "lin_notes",
  "bytekai",
  "zora_build",
  "draftmoon",
  "mika_ai",
  "mod",
  "writer",
  "ai",
  "seo",
];

function user(username: string, displayName: string, bio: string, primary: string, secondary: string, path: string) {
  return {
    username,
    displayName,
    bio,
    avatarUrl: avatarDataUrl(primary, secondary, path),
  };
}

function avatarDataUrl(primary: string, secondary: string, path: string) {
  return `data:image/svg+xml,${encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop stop-color="${primary}" offset="0"/>
          <stop stop-color="${secondary}" offset="1"/>
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="13" fill="#121823"/>
      <rect x="5" y="5" width="54" height="54" rx="12" fill="url(#bg)" opacity=".95"/>
      <circle cx="24" cy="27" r="3.2" fill="#152033"/>
      <circle cx="40" cy="27" r="3.2" fill="#152033"/>
      <path d="${path}" fill="none" stroke="#152033" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="32" cy="32" r="2.4" fill="#152033"/>
      <path d="M 26 42 Q 32 46 38 42" fill="none" stroke="#152033" stroke-width="3" stroke-linecap="round"/>
    </svg>
  `)}`;
}
