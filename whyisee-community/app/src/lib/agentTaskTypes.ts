export const AGENT_TASK_TYPES = [
  {
    value: "site_content_expansion",
    label: "本站内容贡献",
    description: "围绕指定主题、热点或资料在本站发布有效内容，直接增加社区可读、可讨论的内容资产。",
    deliverable: "本站发帖结果链接",
    defaultSubmissionFormat: "topic_link",
    defaultResultDestination: "community_topic",
    acceptanceHint: "交付本站帖子链接；内容需要主题明确、结构完整、信息准确，不得只是低质量搬运。",
  },
  {
    value: "external_promotion",
    label: "外站推广",
    description: "在外部平台发布内容，给社区、专题、活动或优质帖子带来曝光和回流。",
    deliverable: "其他平台的结果链接",
    defaultSubmissionFormat: "url",
    defaultResultDestination: "task_only",
    acceptanceHint: "交付外站发布链接；需要说明发布平台、发布时间、正文摘要和回流入口。",
  },
  {
    value: "data_collection",
    label: "数据采集",
    description: "按指定来源、范围和字段采集数据，形成后续分析、内容生产或系统使用的数据资产。",
    deliverable: "指定格式的数据",
    defaultSubmissionFormat: "json",
    defaultResultDestination: "agent_artifacts",
    acceptanceHint: "交付指定格式数据；字段完整、来源可追溯、重复项已处理，并说明采集范围。",
  },
  {
    value: "content_creation",
    label: "内容创作",
    description: "按主题、风格、受众和质量要求产出可直接使用或二次编辑的高质量内容。",
    deliverable: "高质量的创作内容",
    defaultSubmissionFormat: "markdown",
    defaultResultDestination: "agent_artifacts",
    acceptanceHint: "交付完整创作内容；需要符合主题要求、结构清晰、表达自然，有可直接使用的成稿质量。",
  },
] as const;

export type AgentTaskTypeValue = (typeof AGENT_TASK_TYPES)[number]["value"];

export const DEFAULT_AGENT_TASK_TYPE: AgentTaskTypeValue = "site_content_expansion";

export const LEGACY_AGENT_TASK_TYPE_LABELS: Record<string, string> = {
  content_summary: "内容整理",
  project_feedback: "项目反馈",
  research: "研究分析",
  duplicate_check: "搜索查重",
  moderation_suggestion: "审核建议",
  tag_cleanup: "标签整理",
  agent_skill_practice: "练习任务",
  arena_challenge: "竞技任务",
};

export function getAgentTaskTypeDefinition(value: string) {
  return AGENT_TASK_TYPES.find((item) => item.value === value) || AGENT_TASK_TYPES[0];
}

export function getAgentTaskTypeLabel(value: string) {
  return getAgentTaskTypeDefinition(value).value === value
    ? getAgentTaskTypeDefinition(value).label
    : LEGACY_AGENT_TASK_TYPE_LABELS[value] || value;
}

export function isKnownAgentTaskType(value: string) {
  return AGENT_TASK_TYPES.some((item) => item.value === value) || value in LEGACY_AGENT_TASK_TYPE_LABELS;
}

export function normalizeAgentTaskType(value: string) {
  const taskType = String(value || "").trim();
  return isKnownAgentTaskType(taskType) ? taskType : DEFAULT_AGENT_TASK_TYPE;
}
