const https = require('https');
const vscode = require('vscode');
const { LANGUAGE_EN, getLanguage, t } = require('./i18n');
const { QUADRANT_DEFINITIONS } = require('./storage');
const { normalizeTaskLinks } = require('./taskLinks');

async function classifyQuadrantTask(text, options) {
  const taskText = String(text || '').trim();
  if (!taskText) {
    throw new Error('事项内容不能为空。');
  }

  const dueDate = normalizeDate(options && options.dueDate);
  const config = getAiConfiguration();
  if (config.provider !== 'deepseek') {
    throw new Error(`暂不支持 AI 服务：${config.provider}`);
  }
  if (!config.apiKey) {
    throw new Error('未配置 DeepSeek API Key。请设置环境变量 DEEPSEEK_API_KEY，或配置 leapHome.ai.deepseekApiKey。');
  }

  const response = await requestDeepSeekClassification(config, taskText, dueDate);
  return parseClassification(response, dueDate);
}

async function understandSearchQuery(text, options) {
  const queryText = String(text || '').trim();
  if (!queryText) {
    return undefined;
  }

  const force = Boolean(options && options.force);
  const config = getAiConfiguration();
  if (!config.searchQueryUnderstanding && !force) {
    return undefined;
  }
  if (config.provider !== 'deepseek') {
    if (force) {
      throw new Error(`暂不支持 AI 服务：${config.provider}`);
    }
    return undefined;
  }
  if (!config.apiKey) {
    if (force) {
      throw new Error('未配置 DeepSeek API Key。请设置环境变量 DEEPSEEK_API_KEY，或配置 leapHome.ai.deepseekApiKey。');
    }
    return undefined;
  }

  const response = await requestDeepSeekSearchQuery(config, queryText);
  return parseSearchQueryUnderstanding(response, queryText);
}

async function recommendNextActions(candidates, context) {
  const items = Array.isArray(candidates) ? candidates.slice(0, 8) : [];
  const config = getAiConfiguration();
  if (config.provider !== 'deepseek') {
    throw new Error(`暂不支持 AI 服务：${config.provider}`);
  }
  if (!config.apiKey) {
    throw new Error('未配置 DeepSeek API Key。请设置环境变量 DEEPSEEK_API_KEY，或配置 leapHome.ai.deepseekApiKey。');
  }

  const sourceContext = Object.assign({ locale: getLanguage() }, context || {});
  const response = await requestDeepSeekNextActions(config, items, sourceContext);
  try {
    return parseNextActionRecommendation(response, items);
  } catch (error) {
    if (!isJsonParseFailure(error)) {
      throw error;
    }
    const retryResponse = await requestDeepSeekNextActions(config, items, Object.assign({}, sourceContext, {
      jsonRetry: true
    }));
    return parseNextActionRecommendation(retryResponse, items);
  }
}

async function organizeKnowledgeInsight(insight, context) {
  const source = insight && typeof insight === 'object' ? insight : {};
  if (!source.title && !source.reason) {
    throw new Error('图谱洞察内容不能为空。');
  }
  const config = getAiConfiguration();
  if (config.provider !== 'deepseek') {
    throw new Error(`暂不支持 AI 服务：${config.provider}`);
  }
  if (!config.apiKey) {
    throw new Error('未配置 DeepSeek API Key。请设置环境变量 DEEPSEEK_API_KEY，或配置 leapHome.ai.deepseekApiKey。');
  }

  const response = await requestDeepSeekKnowledgeOrganization(config, source, context || {});
  return parseKnowledgeOrganization(response, source);
}

function getAiConfiguration() {
  const config = vscode.workspace.getConfiguration('leapHome');
  return {
    provider: config.get('ai.provider', 'deepseek'),
    apiKey: config.get('ai.deepseekApiKey', '') || process.env.DEEPSEEK_API_KEY || '',
    baseUrl: config.get('ai.deepseekBaseUrl', 'https://api.deepseek.com'),
    model: config.get('ai.deepseekModel', 'deepseek-v4-flash'),
    timeoutMs: clampNumber(config.get('ai.timeoutMs', 12000), 3000, 60000),
    searchQueryUnderstanding: Boolean(config.get('ai.searchQueryUnderstanding', false))
  };
}

function requestDeepSeekClassification(config, taskText, dueDate) {
  const endpoint = `${String(config.baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const today = formatDate(new Date());
  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: [
          '你是个人任务四象限分类器。',
          `今天日期：${today}。`,
          dueDate ? `用户提供的截止日期：${dueDate}。` : '用户没有提供截止日期。',
          '你必须先独立判断 important 和 urgent，然后再给 quadrantId。',
          'important=true 的标准：影响长期目标、项目关键产出、客户/用户承诺、财务/健康/风险、核心工作推进。',
          'important=false 的标准：琐碎杂事、通知响应、低价值打断、可委托或可删除事项。',
          'urgent=true 的标准：今天/明天必须处理、已逾期、3 天内截止、正在阻塞别人、存在马上扩大的风险。',
          'urgent=false 的标准：没有明确近期截止、只是长期改进、可计划推进、可延后。',
          '如果用户提供了截止日期，必须把它作为紧急性的重要依据：',
          '- 截止日期早于今天、今天、明天、或未来 3 天内：urgent=true。',
          '- 截止日期晚于未来 3 天：默认 urgent=false，除非事项文本明确表示正在阻塞或马上出风险。',
          '象限映射规则：',
          '- important=true, urgent=true => importantUrgent',
          '- important=true, urgent=false => importantNotUrgent',
          '- important=false, urgent=true => notImportantUrgent',
          '- important=false, urgent=false => notImportantNotUrgent',
          '只返回严格 JSON/json 对象，不要 Markdown，不要解释性段落。',
          'JSON/json 格式：{"important":true,"urgent":false,"quadrantId":"importantNotUrgent","reason":"一句话理由","confidence":0.85,"dueDate":"YYYY-MM-DD 或空字符串"}'
        ].join('\n')
      },
      {
        role: 'user',
        content: [
          `事项：${taskText}`,
          `截止日期：${dueDate || '未设置'}`
        ].join('\n')
      }
    ],
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    max_tokens: 180,
    stream: false
  };

  return postJson(endpoint, body, config.apiKey, config.timeoutMs);
}

function requestDeepSeekSearchQuery(config, queryText) {
  const endpoint = `${String(config.baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: [
          '你是 Leap Home 个人知识库搜索查询改写器。',
          '把用户的自然语言搜索请求改写为 Leap Search 查询语法。',
          '支持的类型命令：@docs、@code、@prompt、@task、@calendar、@inbox。',
          '支持的范围命令：@project、@favorite、@recent。',
          '支持的任务命令：@todo、@done。',
          '支持的时间命令：@today、@week、@month、recent:7d、date:YYYY-MM-DD、after:YYYY-MM-DD、before:YYYY-MM-DD。',
          '支持的排序和数量：@latest、@oldest、sort:latest、sort:oldest、limit:数字、top:数字。',
          '支持的字段过滤：path:xxx、ext:js、title:xxx、source:xxx、#tag。',
          '例子：用户说“最新1篇文档” => @docs @latest limit:1。',
          '例子：用户说“最近打开的代码” => @code @recent。',
          '例子：用户说“本周未完成事项” => @todo @week。',
          '原则：保留用户真正要搜索的关键词；只在意图明确时添加过滤器；不要编造路径、标签或不存在的命令。',
          '如果用户已经输入 Leap Search 语法，尽量原样保留并只做轻微规范化。',
          '只返回严格 JSON，不要 Markdown，不要解释性段落。',
          'JSON 格式：{"query":"改写后的查询","reason":"一句话说明"}'
        ].join('\n')
      },
      {
        role: 'user',
        content: queryText
      }
    ],
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    max_tokens: 160,
    stream: false
  };

  return postJson(endpoint, body, config.apiKey, config.timeoutMs);
}

function requestDeepSeekNextActions(config, candidates, context) {
  const endpoint = `${String(config.baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const today = formatDate(new Date());
  const outputLanguage = normalizeAiOutputLanguage(context.locale || getLanguage());
  const question = String(context.question || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  const compactCandidates = candidates.map((item) => ({
    key: item.key,
    type: item.type,
    title: item.title,
    reason: item.reason,
    score: item.score,
    source: item.source,
    actions: (item.actions || []).map((action) => action.type)
  }));
  const knowledgeSources = (Array.isArray(context.knowledgeSources) ? context.knowledgeSources : []).slice(0, 8).map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type
  }));
  const existingDocuments = (Array.isArray(context.existingDocuments) ? context.existingDocuments : []).slice(0, 40).map((item) => ({
    sourceId: item.sourceId,
    sourceName: item.sourceName,
    relativePath: item.relativePath,
    title: item.title,
    category: item.category
  }));
  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: [
          '你是 Leap Home 的个人行动教练。',
          `今天日期：${today}。`,
          '目标：帮用户更愿意开始行动，而不是只做排序。',
          '你会收到本地候选推荐，以及最近任务、快速记录、倒计节点、番茄记录、搜索历史等上下文。',
          '你可以做两类输出：',
          '1. 选择/重排本地候选：必须保留候选 key，不能修改不可执行的 source/action。',
          '2. 生成新的 AI 建议：key 必须以 ai: 开头，sourceType 使用 microtask、insight、encouragement 或 idea。',
          question
            ? `用户这次明确提问：${question}。你必须优先回答这个问题，再给出可执行建议。`
            : '如果用户没有输入问题，就主动判断现在最值得开始的事。',
          '新的 AI 建议必须来自上下文，不允许凭空编事实；要尽量小、具体、能立刻开始。',
          '尤其要做：总结最近笔记，建议新事项；把用户可能不愿意开始的大任务拆成 10-15 分钟小步骤；给一句具体鼓励；推荐一个创新探索方向。',
          outputLanguage === LANGUAGE_EN
            ? 'Output language: English. summary, encouragement, reason, item title, item reason, action label, note title, and note content must be written in English. Keep JSON keys, action type, key, sourceType, quadrantId, sourceId, relativePath, and search query syntax unchanged.'
            : '输出语言：中文。summary、encouragement、reason、行动标题、行动理由、按钮文案、笔记标题和笔记内容都使用中文。JSON key、action type、key、sourceType、quadrantId、sourceId、relativePath 和搜索查询语法保持不变。',
          '允许的新建议 action 类型只有 createTask、startFocus、createNote、appendNote、search、openInbox、dismiss。',
          'createTask/startFocus 必须包含 title 和 quadrantId；可选 dueDate 使用 YYYY-MM-DD；startFocus 可选 durationMs，例如 600000 表示 10 分钟。',
          outputLanguage === LANGUAGE_EN
            ? 'createTask may optionally include links, sourceDocument, or outputDocument to link an existing document or suggest a task output document. Document paths must come from existingDocuments.relativePath, or use a safe new Markdown relativePath.'
            : 'createTask 可以可选包含 links、sourceDocument 或 outputDocument，用于关联已有文档或建议产出文档；文档路径必须来自 existingDocuments 的 relativePath，或使用安全的新 Markdown 相对路径。',
          'quadrantId 只能是 importantUrgent、importantNotUrgent、notImportantUrgent、notImportantNotUrgent。',
          'createNote/appendNote 用于直接写入知识库：必须包含 sourceId、relativePath、title、content。sourceId 必须从 knowledgeSources 中选择。',
          'appendNote 应优先选择 existingDocuments 中已有的 relativePath；createNote 可以根据已有目录结构设计新的 Markdown 路径。',
          'relativePath 必须是相对路径，不能以 / 开头，不能包含 ..；content 必须是可以直接写入的 Markdown 内容，控制在 500 字以内。',
          '一次最多输出 1 个 createNote 或 appendNote 动作；如果需要更多笔记内容，先生成一个最小可用版本。',
          'content 如果包含换行，必须作为 JSON 字符串中的 \\n 转义，不要输出裸换行。',
          context.jsonRetry ? '这是 JSON 修复重试：必须输出更短、更简单、100% 可 JSON.parse 的对象；不要输出多余文本。' : '',
          'search 必须包含 query。',
          '如果是选择本地候选，可以省略 actions，系统会保留原动作。',
          '只返回严格 JSON 对象，不要 Markdown，不要解释性段落。',
          outputLanguage === LANGUAGE_EN
            ? 'JSON format: {"summary":"one-sentence context summary","encouragement":"specific encouragement","reason":"overall recommendation reason","items":[{"key":"candidate key or ai:xxx","type":"do-now|plan|review|break","sourceType":"candidate|microtask|insight|encouragement|idea","title":"action title","reason":"one-sentence reason","basedOnKey":"optional source candidate key","actions":[{"type":"createTask|startFocus|createNote|appendNote|search|openInbox|dismiss","label":"button label","title":"title","quadrantId":"importantNotUrgent","dueDate":"2026-06-01","durationMs":600000,"sourceId":"source-id","relativePath":"notes/topic.md","sourceDocument":{"relativePath":"docs/context.md","title":"Context"},"outputDocument":{"relativePath":"notes/output.md","title":"Output"},"content":"Markdown content","query":"search query"}]}]}'
            : 'JSON 格式：{"summary":"最近上下文一句话总结","encouragement":"一句具体鼓励","reason":"整体推荐理由","items":[{"key":"候选 key 或 ai:xxx","type":"do-now|plan|review|break","sourceType":"candidate|microtask|insight|encouragement|idea","title":"行动标题","reason":"一句话解释","basedOnKey":"可选，来源候选 key","actions":[{"type":"createTask|startFocus|createNote|appendNote|search|openInbox|dismiss","label":"按钮文案","title":"标题","quadrantId":"importantNotUrgent","dueDate":"2026-06-01","durationMs":600000,"sourceId":"source-id","relativePath":"notes/topic.md","sourceDocument":{"relativePath":"docs/context.md","title":"上下文"},"outputDocument":{"relativePath":"notes/output.md","title":"产出"},"content":"Markdown 内容","query":"搜索词"}]}]}'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          workspaceName: context.workspaceName || '',
          locale: outputLanguage,
          question,
          candidates: compactCandidates,
          recentNotes: context.recentNotes || [],
          openTasks: context.openTasks || [],
          countdowns: context.countdowns || [],
          focus: context.focus || {},
          recentSearches: context.recentSearches || [],
          knowledgeSources,
          existingDocuments
        })
      }
    ],
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    max_tokens: 2200,
    stream: false
  };

  return postJson(endpoint, body, config.apiKey, config.timeoutMs);
}

function requestDeepSeekKnowledgeOrganization(config, insight, context) {
  const endpoint = `${String(config.baseUrl).replace(/\/+$/, '')}/chat/completions`;
  const body = {
    model: config.model,
    messages: [
      {
        role: 'system',
        content: [
          '你是 Leap Home 的个人知识库文档整理助手。',
          '你会收到一个知识图谱洞察、目标文档片段和相关文档摘要。',
          '你的任务是为目标 Markdown 文档补充结构化元数据，帮助知识图谱形成更准确的关系。',
          '要求：',
          '- 不要重写全文。',
          '- 不要编造不存在的文件或事实。',
          '- tags 是简短标签，适合放进 Markdown frontmatter 的 tags 字段。',
          '- topics 是主题词，可比 tags 更接近自然语言。',
          '- related 只能从输入的 relatedDocuments.relativePath 中选择，不要创造新路径。',
          '- summary 是一句话文档摘要，适合放进 frontmatter。',
          '只返回严格 JSON，不要 Markdown 代码围栏，不要解释性段落。',
          'JSON 格式：{"summary":"一句话文档摘要","metadata":{"tags":["tag"],"topics":["主题"],"related":["docs/example.md"],"aliases":["可选别名"]}}'
        ].join('\n')
      },
      {
        role: 'user',
        content: JSON.stringify({
          insight: {
            type: insight.type || '',
            title: insight.title || '',
            reason: insight.reason || '',
            query: insight.query || ''
          },
          targetDocument: context.targetDocument || {},
          relatedDocuments: context.relatedDocuments || []
        })
      }
    ],
    response_format: { type: 'json_object' },
    thinking: { type: 'disabled' },
    max_tokens: 500,
    stream: false
  };

  return postJson(endpoint, body, config.apiKey, config.timeoutMs);
}

function postJson(endpoint, body, apiKey, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const url = new URL(endpoint);
    const request = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (response) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(new Error(`DeepSeek 请求失败：HTTP ${response.statusCode} ${text.slice(0, 300)}`));
            return;
          }

          try {
            resolve(JSON.parse(text));
          } catch (error) {
            reject(new Error(`DeepSeek 返回了无法解析的 JSON：${error.message}`));
          }
        });
      }
    );

    request.on('error', reject);
    request.setTimeout(timeoutMs, () => {
      request.destroy(new Error(`DeepSeek 请求超时（${timeoutMs}ms）。`));
    });
    request.write(payload);
    request.end();
  });
}

function parseClassification(response, providedDueDate) {
  const content = getChoiceContent(response);

  if (!content) {
    throw new Error('DeepSeek 没有返回分类结果。');
  }

  const parsed = parseJsonObject(content, 'DeepSeek 分类结果不是 JSON。');

  const parsedImportant = parseBoolean(parsed.important);
  const parsedUrgent = parseBoolean(parsed.urgent);
  const dueDate = providedDueDate || normalizeDate(parsed.dueDate);
  const urgent = dueDate ? applyDueDateUrgency(dueDate, parsedUrgent) : parsedUrgent;
  const quadrantId = typeof parsedImportant === 'boolean' && typeof urgent === 'boolean'
    ? quadrantFromBooleans(parsedImportant, urgent)
    : normalizeQuadrantId(parsed.quadrantId || parsed.id);

  return {
    quadrantId,
    reason: String(parsed.reason || '').trim(),
    confidence: clampNumber(parsed.confidence, 0, 1),
    dueDate
  };
}

function parseSearchQueryUnderstanding(response, fallbackQuery) {
  const content = getChoiceContent(response);
  if (!content) {
    return undefined;
  }
  const parsed = parseJsonObject(content, 'DeepSeek 查询理解结果不是 JSON。');
  const query = normalizeSearchRewrite(parsed.query, fallbackQuery);
  return {
    query,
    reason: String(parsed.reason || '').trim().slice(0, 160)
  };
}

function parseNextActionRecommendation(response, candidates) {
  const content = getChoiceContent(response);
  if (!content) {
    throw new Error('DeepSeek 没有返回推荐结果。');
  }
  const candidateKeys = new Set(candidates.map((item) => item.key));
  const parsed = parseJsonObject(content, 'DeepSeek 推荐结果不是 JSON。');
  const items = Array.isArray(parsed.items) ? parsed.items : [];
  return {
    question: String(parsed.question || '').replace(/\s+/g, ' ').trim().slice(0, 240),
    reason: String(parsed.reason || '').replace(/\s+/g, ' ').trim().slice(0, 220),
    summary: String(parsed.summary || '').replace(/\s+/g, ' ').trim().slice(0, 220),
    encouragement: String(parsed.encouragement || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    items: items
      .map((item) => normalizeNextActionAiItem(item, candidateKeys))
      .filter(Boolean)
      .slice(0, 6)
  };
}

function parseKnowledgeOrganization(response, insight) {
  const content = getChoiceContent(response);
  if (!content) {
    throw new Error('DeepSeek 没有返回整理内容。');
  }
  const parsed = parseJsonObject(content, 'DeepSeek 整理结果不是 JSON。');
  const metadata = parsed.metadata && typeof parsed.metadata === 'object' ? parsed.metadata : parsed;
  return {
    summary: String(parsed.summary || insight.title || '已整理图谱洞察').replace(/\s+/g, ' ').trim().slice(0, 160),
    metadata: {
      tags: normalizeMetadataList(metadata.tags, 8, normalizeMetadataTag),
      topics: normalizeMetadataList(metadata.topics, 8, normalizeMetadataText),
      related: normalizeMetadataList(metadata.related || metadata.relatedPaths, 8, normalizeMetadataPath),
      aliases: normalizeMetadataList(metadata.aliases, 6, normalizeMetadataText)
    }
  };
}

function normalizeNextActionAiItem(value, candidateKeys) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const key = String(value.key || '').trim();
  const generated = key.startsWith('ai:');
  if (!generated && !candidateKeys.has(key)) {
    return undefined;
  }
  const type = normalizeNextActionType(value.type);
  return {
    key,
    type,
    sourceType: normalizeNextActionSourceType(value.sourceType, generated),
    title: String(value.title || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    reason: String(value.reason || '').replace(/\s+/g, ' ').trim().slice(0, 180),
    basedOnKey: String(value.basedOnKey || '').trim(),
    actions: normalizeNextActionAiActions(value.actions)
  };
}

function normalizeNextActionType(value) {
  const type = String(value || '').trim();
  return ['do-now', 'plan', 'review', 'break'].includes(type) ? type : '';
}

function normalizeNextActionSourceType(value, generated) {
  const sourceType = String(value || '').trim();
  if (['candidate', 'microtask', 'insight', 'encouragement', 'idea'].includes(sourceType)) {
    return sourceType;
  }
  return generated ? 'insight' : 'candidate';
}

function normalizeNextActionAiActions(value) {
  const actions = Array.isArray(value) ? value : [];
  return actions.map(normalizeNextActionAiAction).filter(Boolean).slice(0, 4);
}

function normalizeAiOutputLanguage(value) {
  return String(value || '').toLowerCase().startsWith('en') ? LANGUAGE_EN : 'zh-CN';
}

function normalizeNextActionAiAction(value) {
  if (!value || typeof value !== 'object') {
    return undefined;
  }
  const type = String(value.type || '').trim();
  const label = String(value.label || '').replace(/\s+/g, ' ').trim().slice(0, 16);
  if (type === 'createTask' || type === 'startFocus') {
    const title = String(value.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const quadrantId = normalizeOptionalQuadrantId(value.quadrantId);
    if (!title || !quadrantId) return undefined;
    const dueDate = normalizeOptionalDate(value.dueDate);
    const durationMs = clampNumber(value.durationMs, 0, 4 * 60 * 60 * 1000);
    const links = normalizeNextActionTaskLinks(value);
    return Object.assign({ type, label: label || (type === 'startFocus' ? t('开始专注') : t('加入待办')), title, quadrantId }, dueDate ? { dueDate } : {}, durationMs ? { durationMs } : {}, links.length ? { links } : {});
  }
  if (type === 'search') {
    const query = String(value.query || '').replace(/\s+/g, ' ').trim().slice(0, 180);
    if (!query) return undefined;
    return { type, label: label || t('查上下文'), query };
  }
  if (type === 'dismiss') {
    return { type, label: label || t('忽略') };
  }
  if (type === 'openInbox') {
    return { type, label: label || t('打开收集箱') };
  }
  if (type === 'createNote' || type === 'appendNote') {
    const content = String(value.content || '').replace(/\r\n/g, '\n').trim().slice(0, 4000);
    const title = String(value.title || '').replace(/\s+/g, ' ').trim().slice(0, 120);
    const sourceId = String(value.sourceId || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    const sourceName = String(value.sourceName || '').replace(/\s+/g, ' ').trim().slice(0, 80);
    const relativePath = normalizeNoteRelativePath(value.relativePath || value.targetPath || value.path).slice(0, 240);
    if (!content || (!title && !relativePath)) return undefined;
    return {
      type,
      label: label || (type === 'appendNote' ? t('写入笔记') : t('新建笔记')),
      title,
      sourceId,
      sourceName,
      relativePath,
      content
    };
  }
  return undefined;
}

function normalizeOptionalQuadrantId(value) {
  const quadrantId = String(value || '').trim();
  return QUADRANT_DEFINITIONS.some((definition) => definition.id === quadrantId)
    ? quadrantId
    : '';
}

function normalizeOptionalDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function normalizeNoteRelativePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/\s+/g, ' ').trim();
}

function normalizeNextActionTaskLinks(value) {
  const raw = [];
  if (Array.isArray(value.links)) {
    raw.push(...value.links);
  }
  if (value.sourceDocument && typeof value.sourceDocument === 'object') {
    raw.push(Object.assign({ role: 'source' }, value.sourceDocument));
  }
  if (value.outputDocument && typeof value.outputDocument === 'object') {
    raw.push(Object.assign({ role: 'output', status: 'draft' }, value.outputDocument));
  }
  return normalizeTaskLinks(raw.map((link) => Object.assign({}, link, {
    filePath: '',
    relativePath: normalizeNoteRelativePath(link.relativePath || link.path || link.filePath),
    title: String(link.title || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    sourceId: String(link.sourceId || value.sourceId || '').replace(/\s+/g, ' ').trim().slice(0, 160),
    sourceName: String(link.sourceName || value.sourceName || '').replace(/\s+/g, ' ').trim().slice(0, 80)
  })));
}

function getChoiceContent(response) {
  return response &&
    response.choices &&
    response.choices[0] &&
    response.choices[0].message &&
    response.choices[0].message.content;
}

function parseJsonObject(content, errorMessage) {
  const text = stripJsonFences(String(content || '').trim());
  const candidates = [text];
  const objectText = extractJsonObjectText(text);
  if (objectText && objectText !== text) {
    candidates.push(objectText);
  }
  const repaired = repairCommonJsonIssues(objectText || text);
  if (repaired && !candidates.includes(repaired)) {
    candidates.push(repaired);
  }

  let lastError;
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError && lastError.message ? lastError.message : '未知 JSON 解析错误';
  throw new Error(`${errorMessage} DeepSeek 这次返回的 JSON 可能被截断或格式不完整，请重试。原始错误：${detail}`);
}

function isJsonParseFailure(error) {
  const message = String(error && error.message || '');
  return message.includes('不是 JSON') || message.includes('JSON 可能被截断') || message.includes('JSON.parse');
}

function stripJsonFences(value) {
  return String(value || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function extractJsonObjectText(value) {
  const text = String(value || '');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) {
    return '';
  }
  return text.slice(start, end + 1).trim();
}

function repairCommonJsonIssues(value) {
  const text = String(value || '').trim();
  if (!text) {
    return '';
  }
  return text
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function normalizeSearchRewrite(value, fallbackQuery) {
  const query = String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  return query || String(fallbackQuery || '').trim();
}

function normalizeQuadrantId(value) {
  const quadrantId = String(value || '').trim();
  if (!QUADRANT_DEFINITIONS.some((definition) => definition.id === quadrantId)) {
    throw new Error(`DeepSeek 返回了未知象限：${quadrantId || '空'}`);
  }
  return quadrantId;
}

function normalizeMetadataList(value, limit, normalize) {
  const source = Array.isArray(value) ? value : String(value || '').split(/[,，、\n]/);
  const result = [];
  const seen = new Set();
  for (const item of source) {
    const normalized = normalize(item);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function normalizeMetadataTag(value) {
  return String(value || '')
    .replace(/^#/, '')
    .replace(/[^\p{L}\p{N}_/-]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, 40);
}

function normalizeMetadataText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function normalizeMetadataPath(value) {
  return String(value && typeof value === 'object' ? value.relativePath || value.path || value.filePath || value.title : value || '')
    .replace(/\\/g, '/')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 220);
}

function quadrantFromBooleans(important, urgent) {
  if (important && urgent) return 'importantUrgent';
  if (important && !urgent) return 'importantNotUrgent';
  if (!important && urgent) return 'notImportantUrgent';
  return 'notImportantNotUrgent';
}

function applyDueDateUrgency(dueDate, modelUrgent) {
  const days = daysUntil(dueDate);
  if (days <= 3) return true;
  if (days > 3) return Boolean(modelUrgent);
  return Boolean(modelUrgent);
}

function daysUntil(dueDate) {
  const target = parseDate(dueDate);
  const today = parseDate(formatDate(new Date()));
  if (!target || !today) return Number.POSITIVE_INFINITY;
  return Math.floor((target.getTime() - today.getTime()) / 86400000);
}

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', '1', '重要', '紧急'].includes(normalized)) return true;
    if (['false', 'no', '0', '不重要', '不紧急'].includes(normalized)) return false;
  }
  return undefined;
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')
  ].join('-');
}

function parseDate(value) {
  const normalized = normalizeDate(value);
  if (!normalized) return undefined;
  const parts = normalized.split('-').map((part) => Number.parseInt(part, 10));
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return min;
  }
  return Math.min(Math.max(number, min), max);
}

module.exports = {
  classifyQuadrantTask,
  organizeKnowledgeInsight,
  recommendNextActions,
  understandSearchQuery
};
