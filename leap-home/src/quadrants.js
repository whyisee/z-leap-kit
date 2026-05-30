const { QUADRANT_DEFINITIONS, updateLeapState } = require('./storage');

function addQuadrantTask(context, quadrantId, text, metadata) {
  const taskText = cleanText(text);
  const dueDate = metadata && typeof metadata.dueDate === 'string' ? normalizeDate(metadata.dueDate) : '';
  if (!taskText || !isQuadrantId(quadrantId)) {
    return Promise.resolve();
  }

  return updateLeapState(context, (state) => {
    state.quadrants[quadrantId] = [
      createTask(taskText, Object.assign({}, metadata || {}, { dueDate })),
      ...(state.quadrants[quadrantId] || [])
    ];
    return state;
  });
}

function deleteQuadrantTask(context, quadrantId, taskId) {
  if (!isQuadrantId(quadrantId) || !taskId) {
    return Promise.resolve();
  }

  return updateLeapState(context, (state) => {
    state.quadrants[quadrantId] = (state.quadrants[quadrantId] || [])
      .filter((task) => task.id !== taskId);
    return state;
  });
}

function toggleQuadrantTask(context, quadrantId, taskId, done) {
  if (!isQuadrantId(quadrantId) || !taskId) {
    return Promise.resolve();
  }

  return updateLeapState(context, (state) => {
    state.quadrants[quadrantId] = (state.quadrants[quadrantId] || []).map((task) => (
      task.id === taskId
        ? Object.assign({}, task, { done: Boolean(done), updatedAt: new Date().toISOString() })
        : task
    ));
    return state;
  });
}

function updateQuadrantTask(context, quadrantId, taskId, patch) {
  if (!isQuadrantId(quadrantId) || !taskId) {
    return Promise.resolve();
  }

  return updateLeapState(context, (state) => {
    state.quadrants[quadrantId] = (state.quadrants[quadrantId] || []).map((task) => (
      task.id === taskId
        ? Object.assign({}, task, normalizeTaskPatch(patch, task), { updatedAt: new Date().toISOString() })
        : task
    ));
    return state;
  });
}

function createTask(text, metadata) {
  const now = new Date().toISOString();
  const source = metadata && typeof metadata.source === 'string' ? metadata.source : 'manual';
  const reason = metadata && typeof metadata.reason === 'string' ? metadata.reason : '';
  const confidence = metadata && Number.isFinite(Number(metadata.confidence))
    ? Math.min(Math.max(Number(metadata.confidence), 0), 1)
    : undefined;
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
    done: false,
    note: '',
    dueDate: metadata && typeof metadata.dueDate === 'string' ? normalizeDate(metadata.dueDate) : '',
    source,
    reason,
    confidence,
    createdAt: now,
    updatedAt: now
  };
}

function normalizeTaskPatch(patch, task) {
  const source = patch && typeof patch === 'object' ? patch : { text: patch };
  const result = {};
  if (Object.prototype.hasOwnProperty.call(source, 'text')) {
    const text = cleanText(source.text);
    result.text = text || task.text;
  }
  if (Object.prototype.hasOwnProperty.call(source, 'dueDate')) {
    result.dueDate = normalizeDate(source.dueDate);
  }
  return result;
}

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDate(value) {
  const text = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
}

function isQuadrantId(value) {
  return QUADRANT_DEFINITIONS.some((definition) => definition.id === value);
}

module.exports = {
  addQuadrantTask,
  deleteQuadrantTask,
  toggleQuadrantTask,
  updateQuadrantTask
};
