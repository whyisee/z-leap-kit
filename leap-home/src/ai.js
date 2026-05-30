const https = require('https');
const vscode = require('vscode');
const { QUADRANT_DEFINITIONS } = require('./storage');

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

function getChoiceContent(response) {
  return response &&
    response.choices &&
    response.choices[0] &&
    response.choices[0].message &&
    response.choices[0].message.content;
}

function parseJsonObject(content, errorMessage) {
  try {
    return JSON.parse(content);
  } catch (error) {
    const match = String(content).match(/\{[\s\S]*\}/);
    if (!match) {
      throw new Error(errorMessage);
    }
    return JSON.parse(match[0]);
  }
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
  understandSearchQuery
};
