const vscode = require('vscode');
const { COMPONENT_DEFINITIONS } = require('./components');
const { getTemplate, getTemplateSummaries } = require('./templates');
const { readLeapState, updateLeapState } = require('./storage');
const { clampInteger, isObject } = require('./utils');

function getHomeConfiguration(context) {
  const config = vscode.workspace.getConfiguration('leapHome');
  const workspaceState = context ? readLeapState(context) : {};
  const activeCustomHome = getActiveCustomHome(workspaceState);
  if (activeCustomHome) {
    const layout = normalizeLayout(activeCustomHome.layout);
    return {
      activeTemplate: activeCustomHome.id,
      activeTemplateTitle: `${activeCustomHome.title} · 自定义主页`,
      activeHomeId: activeCustomHome.id,
      activeHomeType: 'custom',
      layout: layout.length > 0 ? layout : normalizeLayout(getTemplate(activeCustomHome.baseTemplate || 'minimal').layout)
    };
  }

  const configuredTemplate = workspaceState.homeTemplate || config.get('homeTemplate', 'project-workbench');
  const storedLayout = Array.isArray(workspaceState.homeLayout) && workspaceState.homeLayout.length > 0
    ? workspaceState.homeLayout
    : config.get('homeLayout', []);
  const customLayout = storedLayout;
  const template = getTemplate(configuredTemplate);
  const hasCustomLayout = Array.isArray(customLayout) && customLayout.length > 0;
  const rawLayout = hasCustomLayout ? customLayout : template.layout;
  const layout = normalizeLayout(rawLayout);

  return {
    activeTemplate: template.id,
    activeHomeId: template.id,
    activeHomeType: hasCustomLayout ? 'legacy-custom' : 'template',
    activeTemplateTitle: hasCustomLayout ? `${template.title} · 自定义布局` : template.title,
    layout: layout.length > 0 ? layout : normalizeLayout(getTemplate('minimal').layout)
  };
}

function getHomeSummaries(context) {
  const state = context ? readLeapState(context) : {};
  const builtins = getTemplateSummaries().map((template) => ({
    id: template.id,
    type: 'template',
    title: template.title,
    description: template.description
  }));
  const customHomes = (state.customHomes || []).map((home) => ({
    id: home.id,
    type: 'custom',
    title: home.title,
    description: `自定义主页 · 基于 ${getTemplate(home.baseTemplate).title}`,
    updatedAt: home.updatedAt
  }));
  return customHomes.concat(builtins);
}

function normalizeLayout(rawLayout) {
  if (!Array.isArray(rawLayout)) {
    return normalizeLayout(getTemplate('minimal').layout);
  }

  return rawLayout
    .map((item, index) => normalizeLayoutItem(item, index))
    .filter(Boolean);
}

function normalizeLayoutItem(item, index) {
  if (!item || typeof item.component !== 'string') {
    return undefined;
  }

  const definition = COMPONENT_DEFINITIONS[item.component];
  if (!definition) {
    return undefined;
  }

  const colSpan = clampInteger(item.colSpan ?? item.w ?? item.span ?? definition.defaultColSpan, 1, 12);
  const rowSpan = clampInteger(item.rowSpan ?? item.h ?? definition.defaultRowSpan, 1, 12);
  const col = item.col === undefined && item.x === undefined
    ? undefined
    : clampInteger(item.col ?? item.x, 1, 13 - colSpan);
  const row = item.row === undefined && item.y === undefined
    ? undefined
    : clampInteger(item.row ?? item.y, 1, 99);

  return {
    id: String(item.id || `${item.component}-${index}`),
    component: item.component,
    title: String(item.title || definition.title),
    col,
    row,
    colSpan,
    rowSpan,
    options: isObject(item.options) ? item.options : {}
  };
}

async function saveHomeLayout(layout, context) {
  const normalized = normalizeLayout(layout).map((item) => ({
    id: item.id,
    component: item.component,
    title: item.title,
    col: item.col,
    row: item.row,
    colSpan: item.colSpan,
    rowSpan: item.rowSpan,
    options: item.options
  }));

  if (normalized.length === 0) {
    throw new Error('没有可保存的 Leap Home 布局。');
  }

  if (context) {
    await updateLeapState(context, (state) => {
      const customHome = getActiveCustomHome(state);
      if (customHome) {
        state.customHomes = state.customHomes.map((home) => (
          home.id === customHome.id
            ? Object.assign({}, home, { layout: normalized, updatedAt: new Date().toISOString() })
            : home
        ));
      } else {
        state.homeLayout = normalized;
      }
      return state;
    });
    return;
  }

  await vscode.workspace.getConfiguration('leapHome').update('homeLayout', normalized, getConfigurationTarget());
}

async function resetHomeLayout(context) {
  if (context) {
    await updateLeapState(context, (state) => {
      const customHome = getActiveCustomHome(state);
      if (customHome) {
        state.customHomes = state.customHomes.map((home) => (
          home.id === customHome.id
            ? Object.assign({}, home, {
              layout: serializeLayout(getTemplate(home.baseTemplate || 'project-workbench').layout),
              updatedAt: new Date().toISOString()
            })
            : home
        ));
      } else {
        state.homeLayout = [];
      }
      return state;
    });
    return;
  }

  await vscode.workspace.getConfiguration('leapHome').update('homeLayout', [], getConfigurationTarget());
}

async function setHomeTemplate(templateId, context) {
  if (context) {
    await updateLeapState(context, (state) => {
      state.activeHomeId = '';
      state.homeTemplate = templateId;
      state.homeLayout = [];
      return state;
    });
    return;
  }

  const config = vscode.workspace.getConfiguration('leapHome');
  const target = getConfigurationTarget();
  await config.update('homeTemplate', templateId, target);
  await config.update('homeLayout', [], target);
}

async function setActiveHome(homeId, context) {
  const template = getTemplate(homeId);
  if (template.id === homeId) {
    await setHomeTemplate(homeId, context);
    return;
  }
  if (!context) {
    throw new Error('自定义主页需要工作区状态。');
  }
  await updateLeapState(context, (state) => {
    const customHome = (state.customHomes || []).find((home) => home.id === homeId);
    if (!customHome) {
      throw new Error('没有找到这个自定义主页。');
    }
    state.activeHomeId = customHome.id;
    state.homeLayout = [];
    return state;
  });
}

async function createCustomHome(title, templateId, context) {
  if (!context) {
    throw new Error('创建自定义主页需要打开工作区。');
  }
  const template = getTemplate(templateId || 'project-workbench');
  const now = new Date().toISOString();
  const home = {
    id: `custom-home-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: cleanHomeTitle(title),
    baseTemplate: template.id,
    layout: serializeLayout(template.layout),
    createdAt: now,
    updatedAt: now
  };
  await updateLeapState(context, (state) => {
    state.customHomes = [home, ...(state.customHomes || [])];
    state.activeHomeId = home.id;
    state.homeTemplate = template.id;
    state.homeLayout = [];
    return state;
  });
  return home;
}

function getActiveCustomHome(state) {
  if (!state || !state.activeHomeId || !Array.isArray(state.customHomes)) {
    return undefined;
  }
  return state.customHomes.find((home) => home.id === state.activeHomeId);
}

function serializeLayout(layout) {
  return normalizeLayout(layout).map((item) => ({
    id: item.id,
    component: item.component,
    title: item.title,
    col: item.col,
    row: item.row,
    colSpan: item.colSpan,
    rowSpan: item.rowSpan,
    options: item.options
  }));
}

function cleanHomeTitle(value) {
  const title = String(value || '').replace(/\s+/g, ' ').trim();
  return title || `自定义主页 ${new Date().toLocaleString('zh-CN')}`;
}

function getConfigurationTarget() {
  return vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0
    ? vscode.ConfigurationTarget.Workspace
    : vscode.ConfigurationTarget.Global;
}

module.exports = {
  createCustomHome,
  getHomeConfiguration,
  getHomeSummaries,
  getTemplateSummaries,
  normalizeLayout,
  resetHomeLayout,
  saveHomeLayout,
  setActiveHome,
  setHomeTemplate
};
