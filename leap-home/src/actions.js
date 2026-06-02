const fs = require('fs/promises');
const path = require('path');
const vscode = require('vscode');
const { getLanguage, t } = require('./i18n');
const { appendInboxEntry, ensureInboxFile, resolveInboxPath } = require('./inbox');
const {
  createCustomHome,
  getHomeSummaries,
  getTemplateSummaries,
  resetHomeLayout,
  saveHomeLayout,
  setActiveHome
} = require('./layout');
const { addFavorite, addRecent } = require('./state');

async function addCurrentFileToFavorites(context, provider) {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.uri.scheme !== 'file') {
    vscode.window.showInformationMessage(t('请先打开一个本地文件，再收藏到 Leap Home。'));
    return;
  }

  await addFavorite(context, editor.document.uri.fsPath);
  provider.postModel();
  vscode.window.showInformationMessage(t('当前文件已加入 Leap Home 收藏。'));
}

async function captureNote(context, provider) {
  const text = await vscode.window.showInputBox({
    prompt: t('记录一条内容到 Leap Home 收集箱'),
    placeHolder: t('想法、链接、待办、代码片段...')
  });

  if (!text || !text.trim()) {
    return;
  }

  const inboxPath = resolveInboxPath(context);
  await appendInboxEntry(inboxPath, text.trim());
  provider.postModel();

  const openInboxLabel = t('打开收集箱');
  const action = await vscode.window.showInformationMessage(
    `${t('已记录到 ')}${path.basename(inboxPath)}${t('。')}`,
    openInboxLabel
  );
  if (action === openInboxLabel) {
    await openFile(inboxPath, context, provider);
  }
}

async function copyPrompt(index) {
  await index.ensureReady();
  if (index.prompts.length === 0) {
    vscode.window.showInformationMessage(`Leap Home ${t('还没有可用的 Prompt 模板。')}`);
    return;
  }

  const picked = await vscode.window.showQuickPick(
    index.prompts.map((prompt) => ({
      label: prompt.title,
      description: prompt.sourceName,
      detail: prompt.filePath,
      prompt
    })),
    {
      placeHolder: t('复制一个 Leap Home Prompt'),
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (picked) {
    await copyPromptFile(picked.prompt.filePath);
  }
}

async function copyPromptFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    await vscode.env.clipboard.writeText(content);
    vscode.window.showInformationMessage(t('Prompt 已复制到剪贴板。'));
  } catch (error) {
    vscode.window.showWarningMessage(`${t('无法复制 Prompt：')}${error.message}`);
  }
}

async function configureAi() {
  const config = vscode.workspace.getConfiguration('leapHome');
  const apiKey = await vscode.window.showInputBox({
    prompt: t('配置 DeepSeek API Key，用于 Leap Home 四象限 AI 归类'),
    placeHolder: 'sk-...',
    password: true,
    ignoreFocusOut: true
  });

  if (apiKey === undefined) {
    return;
  }

  const cleanApiKey = apiKey.trim();
  if (!cleanApiKey) {
    vscode.window.showInformationMessage(t('未填写 DeepSeek API Key，AI 配置未修改。'));
    return;
  }

  const currentModel = config.get('ai.deepseekModel', 'deepseek-v4-flash');
  const pickedModel = await vscode.window.showQuickPick(
    [
      {
        label: 'deepseek-v4-flash',
        description: t('推荐：响应快，适合事项归类')
      },
      {
        label: 'deepseek-v4-pro',
        description: t('更强模型，适合更复杂判断')
      }
    ],
    {
      placeHolder: t('选择 DeepSeek 模型'),
      ignoreFocusOut: true
    }
  );

  const target = vscode.ConfigurationTarget.Global;
  await config.update('ai.provider', 'deepseek', target);
  await config.update('ai.deepseekApiKey', cleanApiKey, target);
  await config.update('ai.deepseekBaseUrl', config.get('ai.deepseekBaseUrl', 'https://api.deepseek.com'), target);
  await config.update('ai.deepseekModel', pickedModel ? pickedModel.label : currentModel, target);

  const openSettingsLabel = t('打开设置');
  const action = await vscode.window.showInformationMessage(
    t('Leap Home AI 已写入 Cursor 用户设置。'),
    openSettingsLabel
  );
  if (action === openSettingsLabel) {
    await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:z-leap-kit.leap-home ai');
  }
}

async function openFile(filePath, context, provider, options) {
  try {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(filePath));
    const targetLine = Number.parseInt(options && options.line, 10);
    const line = Number.isNaN(targetLine)
      ? undefined
      : Math.min(Math.max(targetLine - 1, 0), Math.max(document.lineCount - 1, 0));
    const selection = line === undefined
      ? undefined
      : new vscode.Range(new vscode.Position(line, 0), new vscode.Position(line, 0));
    await vscode.window.showTextDocument(document, { preview: false, selection });
    await addRecent(context, filePath);
    provider.postModel();
  } catch (error) {
    vscode.window.showWarningMessage(`${t('无法打开文件：')}${error.message}`);
  }
}

async function openInbox(context, provider) {
  const inboxPath = resolveInboxPath(context);
  await ensureInboxFile(inboxPath);
  await openFile(inboxPath, context, provider);
}

async function resetLayout(provider) {
  await resetHomeLayout(provider.context);
  provider.postModel();
  vscode.window.showInformationMessage(`Leap Home ${t('已恢复当前主页布局。')}`);
}

async function saveLayout(layout, provider) {
  try {
    await saveHomeLayout(layout, provider.context);
    provider.postModel();
    vscode.window.showInformationMessage(`Leap Home ${t('主页布局已保存。')}`);
  } catch (error) {
    vscode.window.showWarningMessage(error.message);
  }
}

async function searchKnowledge(index, context, provider) {
  await index.ensureReady();
  if (index.items.length === 0) {
    vscode.window.showInformationMessage(`Leap Home ${t('还没有索引到知识文件。')}`);
    return;
  }

  const picked = await vscode.window.showQuickPick(
    index.items.map((item) => ({
      label: item.title,
      description: item.sourceName,
      detail: item.filePath,
      item
    })),
    {
      placeHolder: t('搜索 Leap Home 知识库'),
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (picked) {
    await openFile(picked.item.filePath, context, provider);
  }
}

async function switchTemplate(provider) {
  const homes = getHomeSummaries(provider.context);
  const picked = await vscode.window.showQuickPick(
    homes.map((home) => ({
      label: home.type === 'custom' ? home.title : `${t('内置：')}${t(home.title)}`,
      description: home.type === 'custom' ? t('自定义主页') : home.id,
      detail: t(home.description),
      home
    })),
    {
      placeHolder: t('切换 Leap Home 主页')
    }
  );

  if (!picked) {
    return;
  }

  await setActiveHome(picked.home.id, provider.context);
  provider.postModel();
  vscode.window.showInformationMessage(`Leap Home ${t('已切换到「')}${picked.home.title}${t('」。')}`);
}

async function createCustomHomePage(provider) {
  const title = await vscode.window.showInputBox({
    prompt: t('新建 Leap Home 自定义主页'),
    placeHolder: t('例如：今日工作台、写作主页、项目驾驶舱'),
    ignoreFocusOut: true
  });
  if (title === undefined) {
    return;
  }

  const pickedTemplate = await vscode.window.showQuickPick(
    getTemplateSummaries().map((template) => ({
      label: template.title,
      description: template.id,
      detail: t(template.description),
      template
    })),
    {
      placeHolder: t('选择一个内置模板作为初始布局'),
      ignoreFocusOut: true
    }
  );
  if (!pickedTemplate) {
    return;
  }

  try {
    const home = await createCustomHome(title, pickedTemplate.template.id, provider.context);
    await provider.openDesigner();
    provider.postModel();
    vscode.window.showInformationMessage(`${t('已新建自定义主页「')}${home.title}${t('」。')}`);
  } catch (error) {
    vscode.window.showWarningMessage(error.message);
  }
}

async function editCustomHomePage(provider) {
  const homes = getHomeSummaries(provider.context).filter((home) => home.type === 'custom');
  if (homes.length === 0) {
    const createLabel = t('新建自定义主页');
    const action = await vscode.window.showInformationMessage(
      t('还没有自定义主页。'),
      createLabel
    );
    if (action === createLabel) {
      await createCustomHomePage(provider);
    }
    return;
  }

  const picked = await vscode.window.showQuickPick(
    homes.map((home) => ({
      label: home.title,
      description: t('自定义主页'),
      detail: home.updatedAt ? `${t('最近修改：')}${new Date(home.updatedAt).toLocaleString(getLanguage() === 'en' ? 'en-US' : 'zh-CN')}` : t(home.description),
      home
    })),
    {
      placeHolder: t('选择要修改的 Leap Home 自定义主页'),
      ignoreFocusOut: true
    }
  );
  if (!picked) {
    return;
  }

  try {
    await setActiveHome(picked.home.id, provider.context);
    await provider.openDesigner();
    provider.postModel();
    vscode.window.showInformationMessage(`${t('正在修改自定义主页「')}${picked.home.title}${t('」。')}`);
  } catch (error) {
    vscode.window.showWarningMessage(error.message);
  }
}

module.exports = {
  addCurrentFileToFavorites,
  captureNote,
  configureAi,
  copyPrompt,
  copyPromptFile,
  createCustomHomePage,
  editCustomHomePage,
  openFile,
  openInbox,
  resetLayout,
  saveLayout,
  searchKnowledge,
  switchTemplate
};
