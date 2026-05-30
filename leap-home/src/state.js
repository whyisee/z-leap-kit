const vscode = require('vscode');
const { FAVORITES_KEY, RECENT_KEY } = require('./constants');
const { readLeapState, updateLeapState } = require('./storage');

async function addFavorite(context, filePath) {
  await updateLeapState(context, (state) => {
    const favorites = state.favorites.filter((candidate) => candidate !== filePath);
    state.favorites = [filePath, ...favorites].slice(0, 100);
    return state;
  });
}

async function addRecent(context, filePath) {
  await updateLeapState(context, (state) => {
    const recent = state.recent.filter((candidate) => candidate !== filePath);
    state.recent = [filePath, ...recent].slice(0, getMaxRecentItems());
    return state;
  });
}

function getMaxRecentItems() {
  const value = vscode.workspace.getConfiguration('leapHome').get('maxRecentItems', 12);
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return 12;
  }
  return Math.min(Math.max(Math.floor(value), 1), 50);
}

function getStoredPaths(context, key) {
  const state = readLeapState(context);
  const value = key === FAVORITES_KEY ? state.favorites : key === RECENT_KEY ? state.recent : [];
  return Array.isArray(value) ? value.filter((entry) => typeof entry === 'string') : [];
}

async function toggleFavorite(context, filePath) {
  await updateLeapState(context, (state) => {
    const favorites = state.favorites;
    state.favorites = favorites.includes(filePath)
      ? favorites.filter((candidate) => candidate !== filePath)
      : [filePath, ...favorites].slice(0, 100);
    return state;
  });
}

module.exports = {
  addFavorite,
  addRecent,
  getMaxRecentItems,
  getStoredPaths,
  toggleFavorite
};
