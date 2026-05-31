const { getNonce } = require('./utils');

function getWebviewHtml(webview) {
  const nonce = getNonce();
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <title>Leap Home</title>
  <style nonce="${nonce}">
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      line-height: 1.45;
    }
    button, input, select, textarea { font: inherit; }
    button {
      min-height: 30px;
      border: 1px solid var(--vscode-button-border, transparent);
      border-radius: 4px;
      padding: 5px 10px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      white-space: nowrap;
    }
    button:hover { background: var(--vscode-button-hoverBackground); }
    button.secondary {
      color: var(--vscode-foreground);
      background: var(--vscode-button-secondaryBackground);
    }
    button.secondary:hover { background: var(--vscode-button-secondaryHoverBackground); }
    input, select, textarea {
      width: 100%;
      border: 1px solid var(--vscode-input-border, transparent);
      border-radius: 4px;
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      outline: none;
    }
    input, select {
      height: 32px;
      padding: 0 8px;
    }
    textarea {
      min-height: 76px;
      padding: 7px 8px;
      resize: vertical;
      line-height: 1.45;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--vscode-focusBorder); }
    .app {
      width: min(1180px, 100%);
      margin: 0 auto;
      padding: 24px;
    }
    .top {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      min-height: 34px;
      margin-bottom: 18px;
    }
    .title-area {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
    }
    .title {
      min-width: 0;
      margin: 0;
      font-size: 28px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .title-edit-button {
      height: 28px;
      min-height: 28px;
      border-color: var(--vscode-panel-border);
      padding: 0 9px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 12px;
    }
    .title-edit-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    body.design-mode .title-edit-button {
      display: none;
    }
    .template-name {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 4px;
      padding: 4px 9px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      white-space: nowrap;
    }
    .design-toolbar {
      display: none;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    body.design-mode .design-toolbar { display: flex; }
    .toolbar-group {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
    }
    .toolbar-select {
      width: 190px;
      height: 30px;
    }
    .design-toolbar button {
      height: 30px;
      min-height: 30px;
      padding: 0 10px;
    }
    .design-toolbar .save-button {
      font-weight: 700;
    }
    .toolbar-divider {
      width: 1px;
      min-height: 24px;
      background: var(--vscode-panel-border);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-auto-rows: 92px;
      grid-auto-flow: row dense;
      gap: 12px;
      align-items: stretch;
    }
    body.design-mode .grid {
      min-height: 720px;
      grid-auto-rows: 92px;
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      background:
        linear-gradient(to right, var(--vscode-panel-border) 1px, transparent 1px) 0 0 / calc((100% - 22px) / 12) 100%,
        var(--vscode-editor-background);
    }
    .block {
      position: relative;
      display: flex;
      flex-direction: column;
      min-width: 0;
      min-height: 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      background: var(--vscode-sideBar-background);
      overflow: hidden;
    }
    body.design-mode .block { cursor: move; }
    body.design-mode .block.dragging,
    body.design-mode .block.resizing {
      opacity: 0.78;
    }
    body.design-mode .block.dragging {
      cursor: grabbing;
    }
    body.design-mode .block.resizing {
      cursor: nwse-resize;
    }
    body.design-mode .block.selected {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
    }
    body.design-mode .block.shifted {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-focusBorder));
      box-shadow: 0 0 0 1px var(--vscode-inputValidation-warningBorder, var(--vscode-focusBorder)) inset;
    }
    .resize-handle {
      display: none;
      position: absolute;
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      border-top: 1px solid var(--vscode-focusBorder);
      border-left: 1px solid var(--vscode-focusBorder);
      border-radius: 6px 0 6px 0;
      background:
        linear-gradient(135deg, transparent 0 40%, var(--vscode-focusBorder) 41% 47%, transparent 48% 62%, var(--vscode-focusBorder) 63% 69%, transparent 70% 100%),
        var(--vscode-sideBar-background);
      cursor: nwse-resize;
    }
    body.design-mode .block.selected .resize-handle,
    body.design-mode .block:hover .resize-handle {
      display: block;
    }
    .block-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 36px;
      border-bottom: 1px solid var(--vscode-panel-border);
      padding: 8px 10px;
      background: var(--vscode-sideBarSectionHeader-background, transparent);
    }
    .block-header-actions {
      display: flex;
      align-items: center;
      gap: 6px;
      flex: 0 0 auto;
    }
    .block-header-button {
      min-height: 22px;
      height: 22px;
      border-color: var(--vscode-panel-border);
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      line-height: 20px;
    }
    .block-header-button.active,
    .block-header-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .block-title {
      overflow: hidden;
      min-width: 0;
      margin: 0;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .count, .muted {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .block-body {
      flex: 1 1 auto;
      min-height: 0;
      padding: 10px;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
    }
    .block-body-knowledge-graph {
      overflow: hidden;
    }
    .block-search {
      overflow: visible;
      z-index: 30;
    }
    .block-search:focus-within {
      z-index: 80;
    }
    .block-body-search {
      overflow: visible;
    }
    .stack, .list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .inline-actions, .item-actions, .designer-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .item {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      min-height: 44px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 6px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .item-main { min-width: 0; }
    .item-title {
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .item-meta {
      overflow: hidden;
      margin-top: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-results {
      gap: 10px;
    }
    .block-body-search .stack {
      position: relative;
      z-index: 1;
    }
    .block-body-search .search-results[data-floating="true"] {
      position: relative;
      z-index: 40;
      max-height: min(560px, calc(100vh - 220px));
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      margin-top: 2px;
      padding: 8px;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      box-shadow: 0 10px 28px rgba(0, 0, 0, 0.22);
    }
    .search-input-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }
    .search-ai-button {
      min-width: 42px;
      height: 32px;
      min-height: 32px;
      border-color: var(--vscode-panel-border);
      padding: 0 9px;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      background: transparent;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .search-ai-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .search-command-bar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-top: -2px;
    }
    .search-command {
      min-height: 24px;
      height: 24px;
      min-width: 0;
      border-color: var(--vscode-panel-border);
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .search-command:hover,
    .search-command.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .search-suggest {
      display: flex;
      flex-direction: column;
      gap: 3px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 4px;
      background: var(--vscode-editorWidget-background, var(--vscode-sideBar-background));
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.16);
    }
    .block-body-search .search-suggest {
      position: absolute;
      top: 38px;
      right: 50px;
      left: 0;
      z-index: 90;
      max-height: 210px;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
    }
    .search-suggest[hidden] {
      display: none;
    }
    .search-suggest-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 8px;
      align-items: center;
      min-height: 26px;
      border-color: transparent;
      padding: 0 7px;
      color: var(--vscode-foreground);
      background: transparent;
      text-align: left;
    }
    .search-suggest-item:hover {
      background: var(--vscode-list-hoverBackground);
    }
    .search-suggest-item.selected {
      color: var(--vscode-list-activeSelectionForeground, var(--vscode-foreground));
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-list-hoverBackground));
    }
    .search-suggest-desc {
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-suggest-label {
      min-width: 0;
      overflow: hidden;
      font-weight: 600;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .search-group-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .search-result {
      min-height: 0;
      align-items: start;
      transition: border-color 120ms ease, background-color 120ms ease;
    }
    .search-result.openable {
      cursor: pointer;
    }
    .search-result.openable:hover {
      border-color: var(--vscode-list-hoverForeground, var(--vscode-panel-border));
      background: var(--vscode-list-hoverBackground, var(--vscode-editor-background));
    }
    .search-result .item-actions {
      align-items: center;
      justify-content: flex-end;
      gap: 4px;
      padding-top: 1px;
      opacity: 0.28;
      transition: opacity 120ms ease;
    }
    .search-result:hover .item-actions,
    .search-result:focus-within .item-actions {
      opacity: 1;
    }
    .search-action {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      min-width: 28px;
      height: 28px;
      min-height: 28px;
      border-color: transparent;
      border-radius: 4px;
      padding: 0;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 15px;
      line-height: 1;
    }
    .search-action:hover {
      color: var(--vscode-foreground);
      background: var(--vscode-toolbar-hoverBackground, var(--vscode-list-hoverBackground));
    }
    .search-action.primary {
      color: var(--vscode-textLink-foreground, var(--vscode-focusBorder));
    }
    .search-action.active {
      color: var(--vscode-charts-yellow, var(--vscode-textLink-foreground));
      background: var(--vscode-toolbar-hoverBackground, transparent);
    }
    .search-ai-note {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      max-width: 100%;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 7px 8px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
      font-size: 12px;
      cursor: help;
    }
    .search-ai-note strong {
      margin-right: 6px;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      font-weight: 700;
    }
    .search-ai-command {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .search-snippet {
      display: -webkit-box;
      overflow: hidden;
      margin-top: 5px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.35;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .search-preview {
      display: none;
      margin-top: 8px;
      border-left: 2px solid var(--vscode-focusBorder);
      padding: 7px 8px;
      color: var(--vscode-foreground);
      background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
      font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
      font-size: 12px;
      line-height: 1.5;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .search-result:hover .search-preview,
    .search-result:focus-within .search-preview {
      display: block;
    }
    .search-hit {
      border-radius: 3px;
      padding: 0 2px;
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-findMatchHighlightBackground, rgba(255, 214, 10, 0.32));
    }
    .reason-list {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 6px;
    }
    .reason-chip {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 1px 6px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-sideBar-background);
      font-size: 11px;
      line-height: 1.45;
    }
    .small-button {
      min-width: 44px;
      height: 28px;
      padding: 0 8px;
    }
    .empty {
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
    }
    .grid > .empty {
      grid-column: 1 / -1;
    }
    .quick-capture-form {
      display: flex;
      flex-direction: column;
      gap: 7px;
    }
    .quick-capture-input {
      min-height: 78px;
      max-height: 180px;
    }
    .quick-capture-controls {
      display: grid;
      grid-template-columns: minmax(80px, 116px) minmax(126px, 160px) auto auto auto;
      gap: 6px;
      align-items: start;
    }
    .quick-capture-controls select,
    .quick-capture-controls button {
      height: 28px;
      min-height: 28px;
    }
    .quick-capture-controls button {
      padding: 0 8px;
    }
    .quick-capture-actions {
      display: flex;
      gap: 6px;
    }
    .quick-capture-recent {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }
    .quick-capture-recent-title {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
    }
    .quick-capture-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
      min-height: 28px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 5px;
      padding: 4px 6px;
      background: var(--vscode-editor-background);
    }
    .quick-capture-kind {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 0 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 18px;
      white-space: nowrap;
    }
    .quick-capture-text {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .quick-capture-meta {
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-timer {
      display: grid;
      gap: 10px;
    }
    .focus-timer-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 76px 58px;
      gap: 12px;
      align-items: center;
    }
    .focus-main {
      display: grid;
      grid-template-columns: minmax(108px, 132px) minmax(0, 1fr);
      gap: 12px;
      align-items: center;
      min-width: 0;
    }
    .focus-main.active {
      grid-template-columns: minmax(0, 1fr);
    }
    .focus-time-panel {
      min-width: 0;
    }
    .focus-status {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      font-weight: 700;
    }
    .focus-time {
      margin-top: 1px;
      font-size: 26px;
      font-weight: 700;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .focus-duration-hero {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      min-width: 0;
      margin-top: 1px;
    }
    .focus-duration-display {
      display: flex;
      align-items: baseline;
      gap: 4px;
      min-width: 0;
    }
    .focus-duration-input {
      width: 54px;
      height: 38px;
      border-color: transparent;
      padding: 0;
      color: var(--vscode-foreground);
      background: transparent;
      font-size: 34px;
      font-weight: 700;
      line-height: 1.1;
    }
    .focus-duration-input:hover,
    .focus-duration-input:focus {
      border-bottom-color: var(--vscode-focusBorder);
    }
    .focus-duration-input::-webkit-inner-spin-button,
    .focus-duration-input::-webkit-outer-spin-button {
      margin: 0;
      appearance: none;
    }
    .focus-duration-unit {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .focus-duration-presets {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .focus-duration-preset {
      min-height: 24px;
      height: 24px;
      min-width: 34px;
      border-color: var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .focus-duration-preset.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .focus-task-binding {
      display: grid;
      gap: 7px;
      min-width: 0;
      border-left: 1px solid var(--vscode-panel-border);
      padding-left: 12px;
    }
    .focus-task-select,
    .focus-task-new-input,
    .focus-task-quadrant {
      min-height: 30px;
      height: 30px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--vscode-foreground);
      background: var(--vscode-input-background, var(--vscode-editor-background));
      font-size: 12px;
    }
    .focus-task-select {
      width: 100%;
    }
    .focus-task-new-input.invalid {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-focusBorder));
    }
    .focus-task-new {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(94px, 112px);
      gap: 8px;
      width: 100%;
    }
    .focus-task-new[hidden] {
      display: none;
    }
    .focus-linked-task {
      overflow: hidden;
      margin-top: 5px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.25;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-ring {
      display: grid;
      place-items: center;
      width: 58px;
      height: 58px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 50%;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      background: conic-gradient(var(--vscode-progressBar-background, var(--vscode-focusBorder)) var(--focus-progress), var(--vscode-editor-background) 0);
      font-size: 11px;
      font-weight: 700;
    }
    .focus-ring-inner {
      display: grid;
      place-items: center;
      width: 46px;
      height: 46px;
      border-radius: 50%;
      background: var(--vscode-sideBar-background);
    }
    .focus-head-actions {
      display: flex;
      flex-direction: column;
      gap: 5px;
      align-items: stretch;
      min-width: 76px;
    }
    .focus-head-actions button {
      min-height: 30px;
      height: 30px;
      border-radius: 6px;
      padding: 0 9px;
      font-size: 12px;
    }
    .focus-metrics {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 0;
      border-top: 1px solid var(--vscode-panel-border);
      padding-top: 8px;
    }
    .focus-metric {
      border-right: 1px solid var(--vscode-panel-border);
      padding: 0 10px;
      background: transparent;
      min-width: 0;
    }
    .focus-metric:last-child { border-right: 0; }
    .focus-metric-value {
      overflow: hidden;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-metric-label {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.2;
    }
    .focus-history {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .focus-history-title {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }
    .focus-history-item {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr) auto;
      gap: 5px;
      align-items: center;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 5px;
      padding: 4px 5px;
      background: var(--vscode-editor-background);
      font-size: 11px;
    }
    .focus-history-type {
      color: var(--vscode-descriptionForeground);
      font-weight: 700;
      white-space: nowrap;
    }
    .focus-history-main,
    .focus-history-meta {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .focus-history-meta {
      color: var(--vscode-descriptionForeground);
    }
    .focus-history-empty {
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 5px;
      padding: 5px 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .countdown {
      display: grid;
      gap: 8px;
    }
    .countdown-toolbar {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      align-items: center;
    }
    .countdown-toolbar-actions {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .countdown-add-button,
    .countdown-toggle-button {
      min-height: 24px;
      height: 24px;
      border-color: var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
    }
    .countdown-add-button:hover,
    .countdown-toggle-button:hover,
    .countdown-toggle-button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .countdown-hero,
    .countdown-item {
      --countdown-accent: var(--vscode-charts-blue, var(--vscode-focusBorder));
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 10px;
      align-items: center;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-left: 3px solid var(--countdown-accent);
      border-radius: 7px;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--countdown-accent) 14%, transparent), transparent 44%),
        var(--vscode-editor-background);
    }
    .countdown-hero {
      min-height: 74px;
      padding: 10px 12px;
    }
    .countdown-item {
      min-height: 42px;
      padding: 7px 9px;
    }
    .countdown-item.done,
    .countdown-hero.done {
      opacity: 0.58;
    }
    .countdown-hero.overdue,
    .countdown-item.overdue {
      --countdown-accent: var(--vscode-charts-red, #d94b4b);
    }
    .countdown-hero.due-soon,
    .countdown-item.due-soon {
      --countdown-accent: var(--vscode-charts-yellow, #d7ba7d);
    }
    .countdown-hero.blue,
    .countdown-item.blue { --countdown-accent: var(--vscode-charts-blue, #3794ff); }
    .countdown-hero.green,
    .countdown-item.green { --countdown-accent: var(--vscode-charts-green, #89d185); }
    .countdown-hero.yellow,
    .countdown-item.yellow { --countdown-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .countdown-hero.red,
    .countdown-item.red { --countdown-accent: var(--vscode-charts-red, #d94b4b); }
    .countdown-hero.purple,
    .countdown-item.purple { --countdown-accent: var(--vscode-charts-purple, #b180d7); }
    .countdown-title {
      overflow: hidden;
      font-weight: 700;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .countdown-meta {
      overflow: hidden;
      margin-top: 3px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .countdown-value {
      color: var(--countdown-accent);
      font-size: 22px;
      font-weight: 800;
      line-height: 1.1;
      text-align: right;
      white-space: nowrap;
    }
    .countdown-side {
      display: grid;
      justify-items: end;
      gap: 5px;
    }
    .countdown-item .countdown-value {
      font-size: 13px;
      font-weight: 700;
    }
    .countdown-list {
      display: grid;
      gap: 6px;
    }
    .countdown-actions {
      display: flex;
      gap: 4px;
      opacity: 0;
      transition: opacity 120ms ease;
    }
    .countdown-hero:hover .countdown-actions,
    .countdown-hero:focus-within .countdown-actions,
    .countdown-item:hover .countdown-actions,
    .countdown-item:focus-within .countdown-actions {
      opacity: 1;
    }
    .countdown-actions button {
      min-height: 22px;
      height: 22px;
      border-color: var(--vscode-panel-border);
      border-radius: 5px;
      padding: 0 6px;
      background: transparent;
      font-size: 11px;
    }
    .countdown-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 132px 96px 96px auto auto;
      gap: 6px;
      align-items: start;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .countdown-form input,
    .countdown-form select {
      height: 28px;
      min-height: 28px;
      border-radius: 5px;
      font-size: 12px;
    }
    .countdown-form-note {
      grid-column: 1 / -1;
    }
    .countdown-form button {
      min-height: 28px;
      height: 28px;
      padding: 0 8px;
      font-size: 12px;
    }
    .next-action {
      display: grid;
      gap: 8px;
    }
    .next-action-tabs {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 0;
    }
    .next-action-tab-list {
      display: inline-flex;
      align-items: center;
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 2px;
      background: var(--vscode-editor-background);
    }
    .next-action-tab-button {
      min-height: 24px;
      height: 24px;
      border: 0;
      border-radius: 5px;
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      font-weight: 700;
    }
    .next-action-tab-button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .next-action-tab-button:not(.active):hover {
      color: var(--vscode-foreground);
      background: var(--vscode-toolbar-hoverBackground);
    }
    .next-action-tab-meta {
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .next-action-panel {
      display: grid;
      gap: 7px;
      min-width: 0;
    }
    .next-action-ai-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
      align-items: center;
    }
    .next-action-ai-form input {
      width: 100%;
      height: 28px;
      min-height: 28px;
      border-radius: 6px;
      font-size: 12px;
    }
    .next-action-coach-note {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 6px 8px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
      font-size: 11px;
      line-height: 1.45;
    }
    .next-action-ai-button {
      min-height: 24px;
      height: 24px;
      border-color: var(--vscode-panel-border);
      border-radius: 6px;
      padding: 0 9px;
      color: var(--vscode-textLink-foreground, var(--vscode-foreground));
      background: transparent;
      font-size: 11px;
      font-weight: 700;
    }
    .next-action-ai-button:hover {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .next-action-card {
      display: grid;
      gap: 7px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-left: 3px solid var(--next-accent, var(--vscode-focusBorder));
      border-radius: 7px;
      padding: 9px 10px;
      background:
        linear-gradient(90deg, color-mix(in srgb, var(--next-accent, var(--vscode-focusBorder)) 12%, transparent), transparent 44%),
        var(--vscode-editor-background);
    }
    .next-action-card.primary {
      min-height: 94px;
    }
    .next-action-card.do-now { --next-accent: var(--vscode-charts-red, #d94b4b); }
    .next-action-card.plan { --next-accent: var(--vscode-charts-blue, #3794ff); }
    .next-action-card.review { --next-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .next-action-card.break { --next-accent: var(--vscode-charts-green, #89d185); }
    .next-action-card.insight { --next-accent: var(--vscode-charts-purple, #b180d7); }
    .next-action-card.idea { --next-accent: var(--vscode-charts-blue, #3794ff); }
    .next-action-card.microtask { --next-accent: var(--vscode-charts-green, #89d185); }
    .next-action-card.encouragement { --next-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .next-action-card.ai {
      border-color: color-mix(in srgb, var(--next-accent, var(--vscode-focusBorder)) 54%, var(--vscode-panel-border));
    }
    .next-action-panel.system .next-action-card {
      border-left-color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
    }
    .next-action-head {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: start;
    }
    .next-action-title {
      overflow: hidden;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .next-action-card.primary .next-action-title {
      font-size: 15px;
    }
    .next-action-badge {
      border: 1px solid color-mix(in srgb, var(--next-accent, var(--vscode-focusBorder)) 62%, var(--vscode-panel-border));
      border-radius: 999px;
      padding: 1px 7px;
      color: var(--next-accent, var(--vscode-descriptionForeground));
      font-size: 10px;
      font-weight: 700;
      white-space: nowrap;
    }
    .next-action-reason {
      display: -webkit-box;
      overflow: hidden;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      line-height: 1.45;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    .next-action-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .next-action-actions button {
      min-height: 24px;
      height: 24px;
      border-radius: 6px;
      padding: 0 8px;
      font-size: 11px;
    }
    .next-action-secondary {
      display: grid;
      gap: 6px;
    }
    .next-action-empty {
      border: 1px dashed var(--vscode-panel-border);
      border-radius: 7px;
      padding: 9px;
      color: var(--vscode-descriptionForeground);
      background: var(--vscode-editor-background);
    }
    .knowledge-graph {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      gap: 8px;
      height: 100%;
      min-height: 0;
      min-width: 0;
    }
    .knowledge-graph-toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
      justify-content: space-between;
    }
    .knowledge-graph-tabs {
      display: inline-flex;
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 2px;
      background: var(--vscode-editor-background);
    }
    .knowledge-graph-tabs button,
    .knowledge-graph-actions button {
      min-height: 24px;
      height: 24px;
      border: 0;
      border-radius: 5px;
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      font-weight: 700;
    }
    .knowledge-graph-tabs button.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .knowledge-graph-actions {
      display: inline-flex;
      gap: 4px;
      align-items: center;
    }
    .knowledge-graph-canvas {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(160px, 0.45fr);
      gap: 8px;
      align-items: stretch;
      min-height: 0;
    }
    .knowledge-graph-svg {
      display: block;
      width: 100%;
      height: 100%;
      min-height: 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      background:
        radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--vscode-focusBorder) 9%, transparent), transparent 48%),
        var(--vscode-editor-background);
    }
    .knowledge-graph-node circle {
      fill: var(--vscode-editor-background);
      stroke: var(--vscode-focusBorder);
      stroke-width: 2;
    }
    .knowledge-graph-node.prompt circle { stroke: var(--vscode-charts-purple, #b180d7); }
    .knowledge-graph-node.code circle { stroke: var(--vscode-charts-blue, #3794ff); }
    .knowledge-graph-node.selected circle {
      fill: color-mix(in srgb, var(--vscode-focusBorder) 22%, var(--vscode-editor-background));
      stroke-width: 3;
    }
    .knowledge-graph-node text {
      fill: var(--vscode-foreground);
      font-size: 10px;
      font-weight: 700;
      text-anchor: middle;
      pointer-events: none;
    }
    .knowledge-graph-edge {
      stroke: var(--vscode-panel-border);
      stroke-width: 1.3;
    }
    .knowledge-graph-edge.link { stroke: var(--vscode-charts-blue, #3794ff); }
    .knowledge-graph-edge.metadata { stroke: var(--vscode-charts-orange, #d18616); }
    .knowledge-graph-edge.tag { stroke: var(--vscode-charts-green, #89d185); }
    .knowledge-graph-edge.reference { stroke: var(--vscode-charts-yellow, #d7ba7d); }
    .knowledge-graph-edge.path { stroke: var(--vscode-descriptionForeground); }
    .knowledge-graph-side {
      display: grid;
      gap: 7px;
      grid-template-rows: auto minmax(0, 1fr) auto;
      align-content: stretch;
      min-height: 0;
      min-width: 0;
      overflow: hidden;
    }
    .knowledge-graph-summary,
    .knowledge-graph-relation {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .knowledge-graph-title {
      overflow: hidden;
      font-size: 12px;
      font-weight: 800;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .knowledge-graph-meta,
    .knowledge-graph-reason {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.4;
    }
    .knowledge-graph-relation {
      display: grid;
      gap: 3px;
    }
    .knowledge-graph-relations {
      display: grid;
      gap: 7px;
      max-height: 118px;
      min-height: 0;
      overflow: hidden;
    }
    .knowledge-graph-insights {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      align-content: start;
      gap: 6px;
      min-height: 0;
      overflow: hidden;
    }
    .knowledge-graph-insight-list {
      display: grid;
      align-content: start;
      gap: 6px;
      min-height: 0;
      overflow: auto;
      overscroll-behavior: auto;
      scrollbar-gutter: stable;
    }
    .knowledge-graph-ai-status {
      display: grid;
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 7px;
      padding: 7px 8px;
      color: var(--vscode-descriptionForeground);
      background: color-mix(in srgb, var(--vscode-editor-background) 88%, var(--vscode-focusBorder) 12%);
      font-size: 11px;
      line-height: 1.35;
    }
    .knowledge-graph-ai-status strong {
      color: var(--vscode-foreground);
      font-size: 11px;
    }
    .knowledge-graph-ai-status.thinking,
    .knowledge-graph-ai-status.writing,
    .knowledge-graph-ai-status.reading {
      border-color: color-mix(in srgb, var(--vscode-focusBorder) 55%, var(--vscode-panel-border));
    }
    .knowledge-graph-ai-status.done {
      border-color: var(--vscode-charts-green, #89d185);
      background: color-mix(in srgb, var(--vscode-editor-background) 84%, var(--vscode-charts-green, #89d185) 16%);
    }
    .knowledge-graph-ai-status.error {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
      background: var(--vscode-inputValidation-errorBackground, var(--vscode-editor-background));
    }
    .knowledge-graph-insight {
      display: grid;
      gap: 5px;
      border: 1px solid var(--vscode-panel-border);
      border-left: 3px solid var(--graph-insight-accent, var(--vscode-focusBorder));
      border-radius: 7px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .knowledge-graph-insight.missing-link { --graph-insight-accent: var(--vscode-charts-yellow, #d7ba7d); }
    .knowledge-graph-insight.hub { --graph-insight-accent: var(--vscode-charts-blue, #3794ff); }
    .knowledge-graph-insight.stale-hub { --graph-insight-accent: var(--vscode-charts-red, #d94b4b); }
    .knowledge-graph-insight.isolated { --graph-insight-accent: var(--vscode-charts-purple, #b180d7); }
    .knowledge-graph-insight.metadata { --graph-insight-accent: var(--vscode-charts-orange, #d18616); }
    .knowledge-graph-insight-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .knowledge-graph-insight-actions button {
      min-height: 23px;
      height: 23px;
      border-radius: 5px;
      padding: 0 7px;
      font-size: 11px;
    }
    .knowledge-graph-insight-actions button:disabled {
      cursor: wait;
      opacity: 0.72;
    }
    .quadrant-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .quadrant-ai {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 190px auto;
      gap: 8px;
      margin-bottom: 8px;
    }
    .quadrant-ai button {
      height: 32px;
    }
    .quadrant {
      --quadrant-accent: var(--vscode-focusBorder);
      --quadrant-tint: transparent;
      min-height: 88px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-left: 3px solid var(--quadrant-accent);
      border-radius: 6px;
      padding: 10px;
      background:
        linear-gradient(90deg, var(--quadrant-tint), transparent 44%),
        var(--vscode-editor-background);
      transition: border-color 120ms ease, background 120ms ease;
    }
    .quadrant.importantUrgent,
    .month-item.importantUrgent {
      --quadrant-accent: var(--vscode-charts-red, #d94b4b);
      --quadrant-tint: rgba(217, 75, 75, 0.1);
    }
    .quadrant.importantNotUrgent,
    .month-item.importantNotUrgent {
      --quadrant-accent: var(--vscode-charts-blue, #3794ff);
      --quadrant-tint: rgba(55, 148, 255, 0.1);
    }
    .quadrant.notImportantUrgent,
    .month-item.notImportantUrgent {
      --quadrant-accent: var(--vscode-charts-yellow, #d7ba7d);
      --quadrant-tint: rgba(215, 186, 125, 0.13);
    }
    .quadrant.notImportantNotUrgent,
    .month-item.notImportantNotUrgent {
      --quadrant-accent: var(--vscode-charts-green, #89d185);
      --quadrant-tint: rgba(137, 209, 133, 0.11);
    }
    .quadrant:hover,
    .quadrant:focus-within {
      border-color: var(--vscode-focusBorder);
    }
    .quadrant-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .quadrant-title-wrap {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }
    .quadrant-title-wrap::before {
      content: '';
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--quadrant-accent);
      flex: 0 0 auto;
    }
    .quadrant-title {
      font-size: 12px;
      font-weight: 700;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .completed-toggle {
      min-height: 22px;
      height: 22px;
      padding: 0 7px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .quadrant-head:hover .completed-toggle,
    .quadrant-head:focus-within .completed-toggle,
    .completed-toggle.active {
      opacity: 1;
      pointer-events: auto;
    }
    .completed-toggle.active {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .task {
      display: grid;
      grid-template-columns: 16px minmax(0, 1fr) 108px 20px;
      align-items: center;
      gap: 5px;
      min-height: 30px;
      border-radius: 5px;
      padding: 1px 2px;
      color: var(--vscode-foreground);
      font-size: 12px;
      transition: background 120ms ease;
    }
    .task:hover,
    .task:focus-within {
      background: var(--vscode-sideBar-background);
    }
    .task-check,
    .task-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      width: 16px;
      height: 16px;
      min-height: 16px;
      padding: 0;
      font-size: 10px;
      line-height: 1;
    }
    .task-check {
      border-radius: 50%;
      color: var(--vscode-button-foreground);
      background: transparent;
      border-color: var(--vscode-descriptionForeground);
    }
    .task.done .task-check {
      border-color: var(--vscode-button-background);
      background: var(--vscode-button-background);
    }
    .task-delete {
      border-radius: 4px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      opacity: 0;
      pointer-events: none;
      transition: opacity 120ms ease;
    }
    .task:hover .task-delete,
    .task:focus-within .task-delete {
      opacity: 1;
      pointer-events: auto;
    }
    .task-input {
      height: 28px;
      min-width: 0;
      border-color: transparent;
      padding: 0 6px;
      background: transparent;
    }
    .task-input:hover,
    .task-input:focus {
      border-color: var(--vscode-input-border, var(--vscode-focusBorder));
      background: var(--vscode-input-background);
    }
    .date-picker {
      position: relative;
      min-width: 0;
    }
    .date-pill {
      justify-content: flex-start;
      width: 100%;
      height: 28px;
      min-height: 28px;
      min-width: 0;
      border-color: transparent;
      padding: 0 8px;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 11px;
      text-align: left;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      opacity: 0.78;
    }
    .date-picker.empty-date .date-pill {
      opacity: 0;
      pointer-events: none;
    }
    .task:hover .date-picker.empty-date .date-pill,
    .task:focus-within .date-picker.empty-date .date-pill,
    .date-picker.open .date-pill,
    .date-picker:focus-within .date-pill {
      border-color: var(--vscode-input-border, var(--vscode-focusBorder));
      color: var(--vscode-input-foreground);
      background: var(--vscode-input-background);
      opacity: 1;
      pointer-events: auto;
    }
    .date-popover {
      display: none;
      position: absolute;
      top: 32px;
      right: 0;
      z-index: 20;
      width: 174px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 6px;
      background: var(--vscode-sideBar-background);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22);
    }
    .date-picker.open .date-popover {
      display: block;
    }
    .date-quick {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 6px;
    }
    .date-chip,
    .date-clear {
      min-height: 22px;
      height: 22px;
      min-width: 34px;
      padding: 0 5px;
      font-size: 10px;
    }
    .date-custom {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 6px;
    }
    .date-custom input {
      height: 24px;
      font-size: 11px;
    }
    .task.done .task-input {
      color: var(--vscode-descriptionForeground);
      text-decoration: line-through;
    }
    .task-readonly {
      display: grid;
      grid-template-columns: 12px minmax(0, 1fr);
      gap: 6px;
      font-size: 12px;
    }
    .task-readonly.done {
      color: var(--vscode-descriptionForeground);
      text-decoration: line-through;
    }
    .task-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      margin-top: 5px;
      background: var(--quadrant-accent, var(--vscode-charts-blue, var(--vscode-focusBorder)));
    }
    .quadrant-add {
      margin-top: 8px;
    }
    .quadrant-add-trigger-row {
      display: flex;
      justify-content: flex-end;
      min-height: 24px;
    }
    .quadrant-add-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 24px;
      width: 24px;
      min-height: 24px;
      height: 24px;
      padding: 0;
      border-radius: 50%;
      color: var(--vscode-descriptionForeground);
      background: transparent;
      font-size: 16px;
      line-height: 1;
    }
    .quadrant-add-trigger:hover,
    .quadrant-add-trigger:focus {
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
    }
    .quadrant-add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(132px, 168px) auto auto;
      align-items: start;
      gap: 6px;
    }
    .quadrant-add-form input {
      height: 28px;
    }
    .quadrant-add-form button {
      min-height: 28px;
      height: 28px;
      padding: 0 8px;
    }
    .inline-date {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 3px;
      min-width: 0;
    }
    .inline-date input {
      height: 28px;
      min-width: 0;
      font-size: 11px;
    }
    .inline-date-actions {
      display: flex;
      gap: 4px;
      min-width: 0;
      overflow: hidden;
    }
    .inline-date-actions button {
      min-width: 28px;
      min-height: 20px;
      height: 20px;
      padding: 0 5px;
      font-size: 10px;
    }
    .calendar-week {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 6px;
    }
    .week-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .week-title {
      font-size: 13px;
      font-weight: 700;
    }
    .week-nav {
      display: flex;
      gap: 4px;
    }
    .week-nav button {
      min-width: 28px;
      width: 28px;
      height: 26px;
      min-height: 26px;
      padding: 0;
    }
    .week-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .week-summary span {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 1px 7px;
      background: var(--vscode-editor-background);
    }
    .calendar-day {
      min-height: 96px;
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 6px;
      padding: 7px;
      background: var(--vscode-editor-background);
      overflow: hidden;
    }
    .calendar-day.today {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
    }
    .calendar-day.selected {
      border-color: var(--vscode-button-background);
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-editor-background));
    }
    .calendar-day.overdue {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
    }
    .day-head {
      display: flex;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      white-space: nowrap;
    }
    .event-list {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .event-pill {
      overflow: hidden;
      border-radius: 4px;
      padding: 3px 5px;
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
      font-size: 11px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .week-items {
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-width: 0;
    }
    .month-calendar {
      display: grid;
      grid-template-columns: repeat(7, minmax(0, 1fr));
      gap: 4px;
    }
    .month-toolbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
    }
    .month-title {
      font-size: 13px;
      font-weight: 700;
    }
    .month-nav {
      display: flex;
      gap: 4px;
    }
    .month-nav button {
      min-width: 28px;
      width: 28px;
      height: 26px;
      min-height: 26px;
      padding: 0;
    }
    .month-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .month-summary span {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 999px;
      padding: 1px 7px;
      background: var(--vscode-editor-background);
    }
    .month-weekday,
    .month-cell {
      min-width: 0;
      text-align: center;
      font-size: 11px;
    }
    .month-weekday {
      color: var(--vscode-descriptionForeground);
      font-weight: 700;
    }
    .month-cell {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 3px;
      min-height: 58px;
      border: 1px solid transparent;
      border-radius: 5px;
      padding: 5px 4px;
      background: var(--vscode-editor-background);
      cursor: pointer;
    }
    .month-cell.outside {
      color: var(--vscode-disabledForeground, var(--vscode-descriptionForeground));
      opacity: 0.5;
    }
    .month-cell.today {
      border-color: var(--vscode-focusBorder);
    }
    .month-cell.selected {
      border-color: var(--vscode-button-background);
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-sideBar-background));
    }
    .month-cell.has-events {
      border-color: var(--vscode-panel-border);
    }
    .month-cell.overdue {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
    }
    .month-date {
      text-align: center;
      line-height: 1.1;
    }
    .month-items {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
    }
    .month-item {
      overflow: hidden;
      border-left: 2px solid var(--quadrant-accent, var(--vscode-badge-background));
      border-radius: 3px;
      padding: 1px 3px;
      color: var(--vscode-foreground);
      background: var(--quadrant-tint, var(--vscode-sideBar-background));
      text-align: left;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .month-item.calendar-event {
      border-left-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      background: var(--vscode-badge-background);
    }
    .month-item.done {
      color: var(--vscode-descriptionForeground);
      text-decoration: line-through;
      opacity: 0.78;
    }
    .month-item.overdue {
      border-left-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
      background: rgba(217, 75, 75, 0.12);
    }
    .month-add-panel {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 8px;
      background: var(--vscode-editor-background);
    }
    .month-detail-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
    }
    .month-add-title {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
      font-weight: 700;
    }
    .month-detail-list {
      display: flex;
      flex-direction: column;
      gap: 5px;
      margin-bottom: 8px;
    }
    .month-detail-item {
      display: grid;
      grid-template-columns: 18px minmax(0, 1fr);
      gap: 6px;
      align-items: start;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 5px;
      padding: 6px;
      background: var(--vscode-sideBar-background);
    }
    .month-detail-item.overdue {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-charts-red, #d94b4b));
    }
    .month-detail-item.done {
      color: var(--vscode-descriptionForeground);
    }
    .month-detail-check {
      width: 16px;
      min-width: 16px;
      height: 16px;
      min-height: 16px;
      border-radius: 50%;
      padding: 0;
      font-size: 10px;
      line-height: 1;
    }
    .month-detail-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .month-detail-item.done .month-detail-title {
      text-decoration: line-through;
    }
    .month-detail-meta {
      margin-top: 2px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .month-add-form {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 150px auto auto auto;
      gap: 6px;
      align-items: start;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(6, minmax(0, 1fr));
      gap: 4px;
    }
    .stats-section {
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .stats-section-title {
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
    }
    .stat {
      border: 1px solid var(--vscode-sideBarSectionHeader-border, var(--vscode-panel-border));
      border-radius: 5px;
      padding: 5px;
      background: var(--vscode-editor-background);
      text-align: left;
      min-width: 0;
    }
    button.stat {
      width: 100%;
      min-height: 0;
      color: var(--vscode-foreground);
      cursor: pointer;
    }
    button.stat:hover {
      border-color: var(--vscode-focusBorder);
      background: var(--vscode-list-hoverBackground, var(--vscode-editor-background));
    }
    .stat.warn {
      border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
    }
    .stat.danger {
      border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-panel-border));
    }
    .stat-value {
      overflow: hidden;
      font-size: 14px;
      font-weight: 700;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .stat-label {
      margin-top: 1px;
      color: var(--vscode-descriptionForeground);
      font-size: 10px;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .design-panel {
      display: none;
      position: sticky;
      top: 12px;
      align-self: start;
      max-height: calc(100vh - 32px);
      overflow: auto;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 12px;
      background: var(--vscode-sideBar-background);
    }
    body.design-mode .design-panel { display: block; }
    .designer-shell {
      display: block;
    }
    body.design-mode .designer-shell {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 320px;
      gap: 14px;
      align-items: start;
    }
    .designer-section {
      border-bottom: 1px solid var(--vscode-panel-border);
      margin-bottom: 12px;
      padding-bottom: 12px;
    }
    .designer-section:last-child {
      border-bottom: 0;
      margin-bottom: 0;
      padding-bottom: 0;
    }
    .designer-title {
      margin: 0 0 8px;
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .designer-fields {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .property-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .property-stack .designer-section {
      margin-bottom: 0;
    }
    .designer-field {
      display: flex;
      flex-direction: column;
      gap: 5px;
      min-width: 0;
    }
    .designer-field label {
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .designer-help {
      margin: 0 0 10px;
      color: var(--vscode-descriptionForeground);
      font-size: 12px;
    }
    .layout-preview {
      display: grid;
      grid-template-columns: repeat(12, minmax(0, 1fr));
      grid-template-rows: repeat(6, 8px);
      gap: 2px;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      margin-bottom: 8px;
      padding: 6px;
      background: var(--vscode-editor-background);
    }
    .layout-preview-cell {
      min-width: 0;
      min-height: 0;
      border-radius: 2px;
      background: var(--vscode-panel-border);
      opacity: 0.38;
    }
    .layout-preview-block {
      z-index: 1;
      border: 1px solid var(--vscode-focusBorder);
      border-radius: 3px;
      background: var(--vscode-list-activeSelectionBackground, var(--vscode-button-background));
      box-shadow: 0 0 0 1px var(--vscode-focusBorder) inset;
      opacity: 0.92;
    }
    .layout-hint {
      margin: -2px 0 8px;
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
    }
    .layout-control-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
    }
    .layout-mini-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .layout-mini-field label {
      color: var(--vscode-descriptionForeground);
      font-size: 11px;
      line-height: 1.1;
      text-align: center;
    }
    .layout-mini-field input {
      height: 28px;
      padding: 0 4px;
      text-align: center;
    }
    .design-notice {
      border: 1px solid var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
      border-radius: 6px;
      margin-top: 10px;
      padding: 8px;
      color: var(--vscode-inputValidation-warningForeground, var(--vscode-foreground));
      background: var(--vscode-inputValidation-warningBackground, var(--vscode-editor-background));
      font-size: 12px;
    }
    .design-panel > .design-notice:first-child {
      margin-top: 0;
      margin-bottom: 12px;
    }
  </style>
</head>
<body>
  <main class="app">
    <header class="top">
      <div class="title-area">
        <h1 class="title">Leap Home</h1>
        <button type="button" class="title-edit-button" id="editHomeButton" title="编辑当前主页">编辑</button>
      </div>
      <div class="design-toolbar" id="designToolbar"></div>
    </header>
    <section class="designer-shell">
      <section class="grid" id="grid">
        <div class="empty">正在加载 Leap Home...</div>
      </section>
      <aside class="design-panel" id="designerPanel"></aside>
    </section>
  </main>

  <script nonce="${nonce}">
    const vscodeApi = acquireVsCodeApi();
    const state = {
      model: {
        data: { items: [], prompts: [], projectItems: [], favorites: [], recent: [], sources: [], focusTimer: {}, countdown: { items: [] }, nextAction: { recommendations: [], systemRecommendations: [], aiRecommendations: [] }, knowledgeGraph: { nodes: [], edges: [] }, quickCaptures: [], searchHistory: [] },
        layout: [],
        components: [],
        activeTemplateTitle: ''
      },
      query: '',
      search: {
        requestId: 0,
        requestedQuery: '',
        responseQuery: '',
        effectiveQuery: '',
        aiAttempted: false,
        aiReason: '',
        loading: false,
        groups: [],
        total: 0,
        indexedItems: 0,
        indexedEntities: 0,
        sourceErrors: 0,
        truncatedSources: 0,
        error: ''
      },
      searchTimer: undefined,
      searchSuggestionIndex: -1,
      suppressSearchSuggestionOnce: false,
      designMode: false,
      draftLayout: [],
      selectedBlockId: '',
      selectedComponentType: '',
      layoutNotice: '',
      layoutNoticeTimer: undefined,
      completedQuadrants: {},
      activeQuadrantAdd: '',
      focusTimerHistoryVisible: false,
      countdownFormId: '',
      countdownShowDone: false,
      nextActionAiLoading: false,
      nextActionQuestion: '',
      nextActionTab: 'system',
      nextActionSeen: {},
      nextActionPending: {},
      nextActionNotice: '',
      knowledgeGraphView: 'cluster',
      knowledgeGraphRelation: 'all',
      knowledgeGraphNodeId: '',
      knowledgeGraphAi: {
        insightId: '',
        phase: 'idle',
        message: '',
        detail: '',
        targetFile: ''
      },
      knowledgeGraphAiCompleted: {},
      selectedCalendarDate: '',
      calendarMonthOffset: 0,
      calendarWeekOffset: 0,
      drag: null
    };
    const els = {
      editHomeButton: document.getElementById('editHomeButton'),
      designToolbar: document.getElementById('designToolbar'),
      designerPanel: document.getElementById('designerPanel'),
      grid: document.getElementById('grid')
    };
    let hasModel = false;
    let readyAttempts = 0;

    window.addEventListener('error', (event) => {
      logToExtension('runtime error', {
        message: event.message,
        source: event.filename,
        line: event.lineno,
        column: event.colno
      });
    });
    window.addEventListener('unhandledrejection', (event) => {
      logToExtension('unhandled promise rejection', formatWebviewError(event.reason));
    });

    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'model') {
        hasModel = true;
        state.model = event.data.model;
        state.nextActionAiLoading = false;
        state.nextActionPending = {};
        state.nextActionNotice = '';
        if (!state.nextActionQuestion && state.model && state.model.data && state.model.data.nextAction && state.model.data.nextAction.ai) {
          state.nextActionQuestion = state.model.data.nextAction.ai.question || '';
        }
        logToExtension('model received', summarizeModel(state.model));
        render();
      }
      if (event.data && event.data.type === 'error') {
        hasModel = true;
        logToExtension('extension error received', event.data.message || '');
        showRenderError(new Error(event.data.message || '扩展端模型生成失败'));
      }
      if (event.data && event.data.type === 'setDesignMode') {
        logToExtension('setDesignMode received', { enabled: Boolean(event.data.enabled) });
        setDesignMode(Boolean(event.data.enabled));
      }
      if (event.data && event.data.type === 'searchResults') {
        handleSearchResults(event.data);
      }
      if (event.data && event.data.type === 'knowledgeGraphAiStatus') {
        handleKnowledgeGraphAiStatus(event.data);
      }
    });

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', finishDrag);
    document.addEventListener('click', closeDatePickers);
    document.addEventListener('wheel', releasePageScrollAtNestedBoundary, { passive: false });
    if (els.editHomeButton) {
      els.editHomeButton.addEventListener('click', () => setDesignMode(true));
    }

    document.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-action]');
      if (!button) return;
      if (state.designMode) return;
      const action = button.dataset.action;
      const filePath = button.dataset.filePath;
      const line = Number.parseInt(button.dataset.line, 10);
      if (action === 'open') post('openItem', Object.assign({ filePath }, Number.isNaN(line) ? {} : { line }));
      if (action === 'favorite') post('toggleFavorite', { filePath });
      if (action === 'copyPrompt') post('copyPrompt', { filePath });
      if (action === 'captureNote') post('captureNote');
      if (action === 'openInbox') post('openInbox');
      if (action === 'refresh') post('refresh');
      if (action === 'runSearch') {
        const query = button.dataset.query || '';
        if (query) {
          runSearchFromCommand(query);
        }
      }
      if (action === 'addTask') {
        post('addQuadrantTask', {
          quadrantId: 'importantNotUrgent',
          text: button.dataset.taskText || '处理搜索结果',
          source: 'search',
          reason: filePath || ''
        });
      }
      if (action === 'completeTask') {
        post('toggleQuadrantTask', {
          quadrantId: button.dataset.quadrantId,
          taskId: button.dataset.taskId,
          done: true
        });
      }
    });

    function post(type, payload) {
      vscodeApi.postMessage(Object.assign({ type }, payload || {}));
    }

    function logToExtension(message, details) {
      try {
        console.log('[Leap Home]', message, details || '');
        post('log', { message, details });
      } catch (error) {
        console.log('[Leap Home] log failed', error);
      }
    }

    function requestModel(reason) {
      readyAttempts += 1;
      logToExtension('requesting model', { reason, attempt: readyAttempts });
      post('ready', { details: { reason, attempt: readyAttempts } });
    }

    function handleSearchResults(message) {
      if (message.requestId !== state.search.requestId) {
        return;
      }
      const results = message.results || {};
      state.search.loading = false;
      state.search.responseQuery = results.query || '';
      state.search.effectiveQuery = results.effectiveQuery || '';
      state.search.aiAttempted = Boolean(results.aiAttempted);
      state.search.aiReason = results.aiReason || '';
      state.search.groups = Array.isArray(results.groups) ? results.groups : [];
      state.search.total = results.total || 0;
      state.search.indexedItems = results.indexedItems || 0;
      state.search.indexedEntities = results.indexedEntities || 0;
      state.search.sourceErrors = results.sourceErrors || 0;
      state.search.truncatedSources = results.truncatedSources || 0;
      state.search.error = results.error || '';
      if (Array.isArray(results.history)) {
        state.model.data.searchHistory = results.history;
      }
      renderSearchResultContainers();
    }

    function handleKnowledgeGraphAiStatus(message) {
      const insightId = String(message.insightId || '');
      const phase = String(message.phase || 'idle');
      if (phase === 'done' && insightId) {
        state.knowledgeGraphAiCompleted[insightId] = true;
      }
      state.knowledgeGraphAi = {
        insightId,
        phase,
        message: String(message.message || ''),
        detail: String(message.detail || ''),
        targetFile: String(message.targetFile || '')
      };
      render();
    }

    function releasePageScrollAtNestedBoundary(event) {
      if (!event || event.defaultPrevented || state.designMode || !event.deltaY) {
        return;
      }
      if (event.target && event.target.closest && event.target.closest('textarea, select')) {
        return;
      }
      const scroller = getNestedScrollElement(event.target);
      if (!scroller || !canScrollVertically(scroller)) {
        return;
      }
      const deltaY = normalizeWheelDelta(event);
      const atTop = scroller.scrollTop <= 0;
      const atBottom = Math.ceil(scroller.scrollTop + scroller.clientHeight) >= scroller.scrollHeight;
      if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
        const page = document.scrollingElement || document.documentElement;
        const pageAtTop = page.scrollTop <= 0;
        const pageAtBottom = Math.ceil(page.scrollTop + window.innerHeight) >= page.scrollHeight;
        if ((deltaY < 0 && !pageAtTop) || (deltaY > 0 && !pageAtBottom)) {
          event.preventDefault();
          window.scrollBy({ top: deltaY, left: 0, behavior: 'auto' });
        }
      }
    }

    function getNestedScrollElement(target) {
      let element = target && target.nodeType === Node.ELEMENT_NODE ? target : target && target.parentElement;
      while (element && element !== document.body) {
        if (element.matches && element.matches('.block-body, .search-results[data-floating="true"], .search-suggest, .knowledge-graph-insight-list')) {
          return element;
        }
        element = element.parentElement;
      }
      return undefined;
    }

    function canScrollVertically(element) {
      const style = window.getComputedStyle(element);
      return /(auto|scroll|overlay)/.test(style.overflowY) && element.scrollHeight > element.clientHeight + 1;
    }

    function normalizeWheelDelta(event) {
      if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
        return event.deltaY * 16;
      }
      if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
        return event.deltaY * window.innerHeight;
      }
      return event.deltaY;
    }

    function render() {
      try {
        renderContent();
        logToExtension('render completed', { blocks: getActiveLayout().length, designMode: state.designMode });
      } catch (error) {
        logToExtension('render failed', formatWebviewError(error));
        showRenderError(error);
      }
    }

    function renderContent() {
      document.body.classList.toggle('design-mode', state.designMode);
      els.grid.textContent = '';
      renderDesignToolbar();
      renderDesignerPanel();
      for (const block of getActiveLayout()) {
        els.grid.appendChild(renderBlock(block));
      }
    }

    function showRenderError(error) {
      document.body.classList.remove('design-mode');
      els.grid.textContent = '';
      const message = error && error.message ? error.message : String(error || '未知错误');
      els.grid.appendChild(empty('Leap Home 渲染失败：' + message));
    }

    function renderBlock(block) {
      const wrapper = document.createElement('section');
      const wrapperClasses = ['block'];
      if (block.component === 'search') wrapperClasses.push('block-search');
      if (block.id === state.selectedBlockId && state.designMode) wrapperClasses.push('selected');
      wrapper.className = wrapperClasses.join(' ');
      wrapper.dataset.layoutId = block.id;
      applyGridPosition(wrapper, block);
      if (state.designMode) {
        wrapper.addEventListener('pointerdown', (event) => {
          if (event.target.closest('button, input, select, textarea, .resize-handle')) return;
          state.selectedBlockId = block.id;
          startDrag(event, block);
        });
      }

      const header = document.createElement('div');
      header.className = 'block-header';
      const title = document.createElement('h2');
      title.className = 'block-title';
      title.textContent = block.title;
      const count = document.createElement('span');
      count.className = 'count';
      count.textContent = state.designMode ? formatBlockPosition(block) : getComponentCount(block);
      const headerActions = div('block-header-actions');
      headerActions.appendChild(count);
      if (!state.designMode && block.component === 'focusTimer') {
        const historyButton = button(state.focusTimerHistoryVisible ? '时钟' : '记录', () => {
          state.focusTimerHistoryVisible = !state.focusTimerHistoryVisible;
          render();
        }, true);
        historyButton.className = 'block-header-button' + (state.focusTimerHistoryVisible ? ' active' : '');
        historyButton.title = state.focusTimerHistoryVisible ? '切换到番茄时钟' : '切换到历史记录';
        headerActions.appendChild(historyButton);
      }
      header.append(title, headerActions);

      const body = document.createElement('div');
      body.className = 'block-body';
      if (block.component === 'knowledgeGraph') {
        body.classList.add('block-body-knowledge-graph');
      }
      if (block.component === 'search') {
        body.classList.add('block-body-search');
      }
      renderComponentBody(body, block);
      wrapper.append(header, body);
      if (state.designMode) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'resize-handle';
        resizeHandle.title = '拖拽调整大小';
        resizeHandle.addEventListener('pointerdown', (event) => startResize(event, block));
        wrapper.appendChild(resizeHandle);
      }
      return wrapper;
    }

    function renderComponentBody(container, block) {
      if (block.component === 'search') return renderSearch(container, block);
      if (block.component === 'quickCapture') return renderQuickCapture(container);
      if (block.component === 'focusTimer') return renderFocusTimer(container);
      if (block.component === 'countdown') return renderCountdown(container, block);
      if (block.component === 'nextAction') return renderNextAction(container, block);
      if (block.component === 'knowledgeGraph') return renderKnowledgeGraph(container, block);
      if (block.component === 'favorites') return renderItemList(container, state.model.data.favorites, '还没有收藏。', block, true);
      if (block.component === 'prompts') return renderPromptList(container, block);
      if (block.component === 'fourQuadrants') return renderFourQuadrants(container, block);
      if (block.component === 'weekCalendar') return renderWeekCalendar(container);
      if (block.component === 'monthCalendar') return renderMonthCalendar(container);
      if (block.component === 'stats') return renderStats(container);
      container.appendChild(empty('未知组件：' + block.component));
    }

    function renderSearch(container, block) {
      const stack = div('stack');
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = '搜索代码、正文、标题、路径、Prompt';
      input.value = state.query;
      const results = div('list search-results');
      results.dataset.searchResults = 'true';
      results.dataset.limit = String(getLimit(block, 30));
      const suggestions = div('search-suggest');
      suggestions.hidden = true;
      const inputRow = div('search-input-row');
      const ai = button('AI', () => {
        state.query = input.value.trim();
        renderActiveSearchCommands(input.closest('.stack'));
        queueSearch(block, 0, true, true);
        renderSearchResults(results, block);
      }, true);
      ai.className = 'search-ai-button';
      ai.title = '用 DeepSeek 理解这次查询';
      ai.setAttribute('aria-label', '用 AI 搜索');
      input.addEventListener('input', (event) => {
        state.query = event.target.value.trim();
        state.searchSuggestionIndex = -1;
        renderSearchSuggestions(suggestions, input, results, block);
        renderActiveSearchCommands(input.closest('.stack'));
        queueSearch(block);
        renderSearchResults(results, block);
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          if (!suggestions.hidden) {
            event.preventDefault();
            moveSearchSuggestion(suggestions, input, results, block, event.key === 'ArrowDown' ? 1 : -1);
          }
          return;
        }
        if (event.key === 'Escape') {
          suggestions.hidden = true;
          state.searchSuggestionIndex = -1;
          return;
        }
        if (event.key === 'Enter') {
          event.preventDefault();
          if (!event.shiftKey && useSelectedSearchSuggestion(suggestions)) {
            return;
          }
          state.query = input.value.trim();
          queueSearch(block, 0, event.shiftKey, true);
          renderSearchResults(results, block);
        }
      });
      input.addEventListener('keyup', () => {
        if (state.suppressSearchSuggestionOnce) {
          state.suppressSearchSuggestionOnce = false;
          return;
        }
        renderSearchSuggestions(suggestions, input, results, block);
      });
      input.addEventListener('click', () => renderSearchSuggestions(suggestions, input, results, block));
      input.addEventListener('blur', () => {
        window.setTimeout(() => { suggestions.hidden = true; }, 120);
      });
      inputRow.append(input, ai);
      stack.append(inputRow, suggestions, renderSearchCommandBar(input, results, block), results);
      container.appendChild(stack);
      renderSearchSuggestions(suggestions, input, results, block);
      renderSearchResults(results, block);
      if (state.query && state.search.responseQuery !== state.query && !state.search.loading) {
        queueSearch(block, 0);
      }
    }

    function renderSearchResults(container, block) {
      container.textContent = '';
      container.dataset.limit = String(getLimit(block, 30));
      container.dataset.floating = state.query ? 'true' : 'false';
      if (!state.query) return container.appendChild(empty('输入关键词开始搜索代码、正文、标题、路径和 Prompt。'));
      if (state.search.error) {
        container.append(empty('搜索失败：' + state.search.error), actionsWrap([actionButton('刷新索引', 'refresh', true)]));
        return;
      }
      if (state.search.loading || state.search.responseQuery !== state.query) {
        container.appendChild(empty(state.search.aiAttempted ? '正在使用 AI 理解查询并搜索...' : '正在搜索 Leap Home 索引...'));
        return;
      }
      const groups = state.search.groups || [];
      const searchNote = renderSearchNote();
      if (groups.length === 0) {
        const text = '没有匹配结果。当前索引 ' + String(state.search.indexedItems || 0) + ' 个文件、'
          + String(state.search.indexedEntities || 0) + ' 条 Leap 数据'
          + (state.search.sourceErrors ? '，' + String(state.search.sourceErrors) + ' 个知识源报错' : '')
          + (state.search.truncatedSources ? '，' + String(state.search.truncatedSources) + ' 个知识源已截断' : '')
          + '。';
        if (searchNote) {
          container.appendChild(searchNote);
        }
        container.append(empty(text), actionsWrap([actionButton('刷新索引', 'refresh', true)]));
        return;
      }
      if (searchNote) {
        container.appendChild(searchNote);
      }
      for (const group of groups) {
        container.appendChild(searchGroup(group));
      }
      if (state.search.total > getLimit(block, 30)) {
        container.appendChild(div('muted', '还有 ' + String(state.search.total - getLimit(block, 30)) + ' 条结果未展示，可在属性里调高显示数量。'));
      }
    }

    function renderSearchNote() {
      const effectiveQuery = String(state.search.effectiveQuery || '').trim();
      if (!effectiveQuery || effectiveQuery === state.query.trim()) {
        if (state.search.aiAttempted && state.search.aiReason) {
          const note = div('search-ai-note');
          note.title = 'AI 没有生成新的搜索指令\\n原始查询：' + state.query.trim() + '\\n说明：' + state.search.aiReason;
          note.append(strongText('AI'), div('search-ai-command', state.search.aiReason));
          return note;
        }
        return undefined;
      }
      const note = div('search-ai-note');
      note.title = [
        'AI 使用的搜索指令：' + effectiveQuery,
        '原始查询：' + state.query.trim(),
        state.search.aiReason ? '分析理由：' + state.search.aiReason : ''
      ].filter(Boolean).join('\\n');
      note.append(strongText('AI 指令'), div('search-ai-command', effectiveQuery));
      return note;
    }

    function renderSearchCommandBar(input, results, block) {
      const bar = div('search-command-bar');
      for (const command of getSearchCommands().filter((item) => item.visible !== false)) {
        const chip = button(command.label, () => {
          applySearchCommand(command.value, input, results, block);
        }, true);
        chip.className = isSearchCommandActive(command.value) ? 'search-command active' : 'search-command';
        chip.title = command.title;
        bar.appendChild(chip);
      }
      return bar;
    }

    function renderSearchSuggestions(container, input, results, block) {
      container.textContent = '';
      const token = getActiveSearchToken(input.value, input.selectionStart || input.value.length);
      if (token && token.text.startsWith('@')) {
        renderSearchCommandSuggestions(container, token, input, results, block);
        return;
      }

      renderSearchHistorySuggestions(container, input, results, block);
    }

    function renderSearchCommandSuggestions(container, token, input, results, block) {
      const partial = token.text.toLowerCase();
      const matches = getSearchCommands()
        .filter((command) => command.value.startsWith(partial) || command.label.toLowerCase().includes(partial) || command.title.toLowerCase().includes(partial.slice(1)))
        .slice(0, 6);
      if (matches.length === 0) {
        container.hidden = true;
        state.searchSuggestionIndex = -1;
        return;
      }
      if (state.searchSuggestionIndex >= matches.length) {
        state.searchSuggestionIndex = -1;
      }

      for (const command of matches) {
        const index = matches.indexOf(command);
        const item = button('', () => {
          applySearchSuggestion(command.value, token, input, results, block, container);
        }, true);
        item.className = index === state.searchSuggestionIndex ? 'search-suggest-item selected' : 'search-suggest-item';
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.append(div('search-suggest-label', command.label), div('search-suggest-desc', command.title));
        container.appendChild(item);
      }
      container.hidden = false;
    }

    function renderSearchHistorySuggestions(container, input, results, block) {
      const query = String(input.value || '').trim().toLowerCase();
      if (!query) {
        container.hidden = true;
        state.searchSuggestionIndex = -1;
        return;
      }
      const history = Array.isArray(state.model.data.searchHistory) ? state.model.data.searchHistory : [];
      const matches = history
        .filter((item) => {
          return String(item.query || '').toLowerCase().includes(query) ||
            String(item.effectiveQuery || '').toLowerCase().includes(query);
        })
        .slice(0, 6);

      if (matches.length === 0) {
        container.hidden = true;
        state.searchSuggestionIndex = -1;
        return;
      }
      if (state.searchSuggestionIndex >= matches.length) {
        state.searchSuggestionIndex = -1;
      }

      for (let index = 0; index < matches.length; index += 1) {
        const entry = matches[index];
        const item = button('', () => {
          applySearchHistory(entry, input, results, block, container);
        }, true);
        item.className = index === state.searchSuggestionIndex ? 'search-suggest-item selected' : 'search-suggest-item';
        item.title = formatSearchHistoryTitle(entry);
        item.addEventListener('mousedown', (event) => event.preventDefault());
        item.append(
          div('search-suggest-label', entry.query),
          div('search-suggest-desc', formatSearchHistoryDescription(entry))
        );
        container.appendChild(item);
      }
      container.hidden = false;
    }

    function getActiveSearchToken(value, cursor) {
      const text = String(value || '');
      const position = Math.max(0, Math.min(cursor, text.length));
      const start = text.lastIndexOf(' ', Math.max(0, position - 1)) + 1;
      const nextSpace = text.indexOf(' ', position);
      const end = nextSpace === -1 ? text.length : nextSpace;
      const token = text.slice(start, end).trim();
      return token ? { start, end, text: token } : undefined;
    }

    function moveSearchSuggestion(container, input, results, block, direction) {
      const count = container.querySelectorAll('.search-suggest-item').length;
      if (count === 0) return;
      const current = state.searchSuggestionIndex;
      state.searchSuggestionIndex = current < 0
        ? (direction > 0 ? 0 : count - 1)
        : (current + direction + count) % count;
      renderSearchSuggestions(container, input, results, block);
      const selected = container.querySelector('.search-suggest-item.selected');
      if (selected) {
        selected.scrollIntoView({ block: 'nearest' });
      }
    }

    function useSelectedSearchSuggestion(container) {
      if (container.hidden || state.searchSuggestionIndex < 0) {
        return false;
      }
      const items = Array.from(container.querySelectorAll('.search-suggest-item'));
      const selected = items[state.searchSuggestionIndex];
      if (!selected) {
        return false;
      }
      state.suppressSearchSuggestionOnce = true;
      selected.click();
      return true;
    }

    function applySearchSuggestion(command, token, input, results, block, suggestions) {
      const current = input.value;
      const nextText = current.slice(0, token.start) + command + ' ' + current.slice(token.end).trimStart();
      const tokens = nextText.split(/\s+/).map((item) => item.trim()).filter(Boolean);
      state.query = normalizeSuggestedSearchTokens(tokens, command).join(' ');
      if (state.query) state.query += ' ';
      input.value = state.query;
      state.searchSuggestionIndex = -1;
      state.suppressSearchSuggestionOnce = true;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      renderSearchSuggestions(suggestions, input, results, block);
      renderActiveSearchCommands(input.closest('.stack'));
      queueSearch(block, 0);
      renderSearchResults(results, block);
    }

    function applySearchHistory(entry, input, results, block, suggestions) {
      state.query = String(entry.query || '').trim();
      input.value = state.query;
      state.searchSuggestionIndex = -1;
      state.suppressSearchSuggestionOnce = true;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      suggestions.hidden = true;
      const isAi = entry.mode === 'ai';
      const effectiveQuery = isAi && entry.effectiveQuery && entry.effectiveQuery !== entry.query
        ? entry.effectiveQuery
        : '';
      queueSearch(block, 0, isAi, true, effectiveQuery);
      renderSearchResults(results, block);
    }

    function formatSearchHistoryDescription(entry) {
      const mode = entry.mode === 'ai' ? 'AI' : '本地';
      const count = entry.count > 1 ? ' · ' + String(entry.count) + ' 次' : '';
      const resultCount = Number.isFinite(Number(entry.resultCount)) ? ' · ' + String(entry.resultCount) + ' 条' : '';
      return mode + resultCount + count;
    }

    function formatSearchHistoryTitle(entry) {
      const lines = [
        '搜索历史',
        '原始查询：' + String(entry.query || ''),
        entry.mode === 'ai' && entry.effectiveQuery ? 'AI 指令：' + entry.effectiveQuery : '',
        entry.reason ? '说明：' + entry.reason : ''
      ].filter(Boolean);
      return lines.join('\\n');
    }

    function normalizeSuggestedSearchTokens(tokens, command) {
      const lowerCommand = command.toLowerCase();
      const typeAliases = getSearchTypeCommandAliases();
      const isTypeCommand = typeAliases.has(lowerCommand);
      return tokens.filter((token, index) => {
        const lower = token.toLowerCase();
        if (lower.startsWith('@') && !getAllSearchCommandAliases().has(lower)) return false;
        if (isTypeCommand && typeAliases.has(lower) && lower !== lowerCommand) return false;
        if (lower === lowerCommand) return index === tokens.findIndex((item) => item.toLowerCase() === lowerCommand);
        return true;
      });
    }

    function getAllSearchCommandAliases() {
      return new Set(Array.from(getSearchTypeCommandAliases()).concat([
        '@project',
        '@current',
        '@favorite',
        '@favorites',
        '@fav',
        '@star',
        '@starred',
        '@recent',
        '@opened',
        '@latest',
        '@newest',
        '@oldest',
        '@todo',
        '@open',
        '@active',
        '@done',
        '@completed',
        '@today',
        '@week',
        '@month'
      ]));
    }

    function getSearchCommands() {
      return [
        { value: '@docs', label: '@docs', title: '只搜索文档', group: 'type' },
        { value: '@code', label: '@code', title: '只搜索代码和配置', group: 'type' },
        { value: '@prompt', label: '@prompt', title: '只搜索 Prompt', group: 'type' },
        { value: '@task', label: '@task', title: '只搜索四象限事项', group: 'type' },
        { value: '@calendar', label: '@calendar', title: '只搜索日历事件', group: 'type' },
        { value: '@inbox', label: '@inbox', title: '只搜索收集箱', group: 'type' },
        { value: '@project', label: '@project', title: '限定当前项目', group: 'scope' },
        { value: '@favorite', label: '@favorite', title: '只看收藏', group: 'scope', visible: false },
        { value: '@recent', label: '@recent', title: '只看最近打开', group: 'scope', visible: false },
        { value: '@latest', label: '@latest', title: '按最近更新优先', group: 'sort', visible: false },
        { value: '@oldest', label: '@oldest', title: '按最早更新优先', group: 'sort', visible: false },
        { value: '@todo', label: '@todo', title: '未完成四象限事项', group: 'status', visible: false },
        { value: '@done', label: '@done', title: '已完成四象限事项', group: 'status', visible: false },
        { value: '@today', label: '@today', title: '今天相关内容', group: 'date', visible: false },
        { value: '@week', label: '@week', title: '本周相关内容', group: 'date', visible: false },
        { value: '@month', label: '@month', title: '本月相关内容', group: 'date', visible: false }
      ];
    }

    function applySearchCommand(command, input, results, block) {
      const tokens = state.query.split(/\s+/).map((item) => item.trim()).filter(Boolean);
      const nextTokens = normalizeSearchCommandTokens(tokens, command);
      state.query = nextTokens.join(' ');
      if (state.query) state.query += ' ';
      input.value = state.query;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      renderActiveSearchCommands(input.closest('.stack'));
      queueSearch(block, 0);
      renderSearchResults(results, block);
    }

    function normalizeSearchCommandTokens(tokens, command) {
      const lowerCommand = command.toLowerCase();
      const commandGroup = getSearchCommandGroup(lowerCommand);
      const result = tokens.filter((token) => {
        const lower = token.toLowerCase();
        const group = getSearchCommandGroup(lower);
        if (group && group !== 'scope' && group === commandGroup) return false;
        if (group === 'scope' && lower === lowerCommand) return false;
        if (lowerCommand === '@project' && lower === '@current') return false;
        return true;
      });
      if (commandGroup === 'scope' && tokens.some((token) => token.toLowerCase() === lowerCommand || (lowerCommand === '@project' && token.toLowerCase() === '@current'))) {
        return result;
      }
      const insertIndex = commandGroup === 'type' ? 0 : Math.min(1, result.length);
      result.splice(insertIndex, 0, command);
      return result;
    }

    function getSearchTypeCommandAliases() {
      return new Set(['@doc', '@docs', '@document', '@documents', '@prompt', '@prompts', '@code', '@source', '@task', '@tasks', '@calendar', '@event', '@events', '@inbox']);
    }

    function getSearchCommandGroup(command) {
      const lower = String(command || '').toLowerCase();
      if (getSearchTypeCommandAliases().has(lower)) return 'type';
      if (['@todo', '@open', '@active', '@done', '@completed'].includes(lower)) return 'status';
      if (['@today', '@week', '@month'].includes(lower)) return 'date';
      if (['@latest', '@newest', '@oldest'].includes(lower)) return 'sort';
      if (['@project', '@current', '@favorite', '@favorites', '@fav', '@star', '@starred', '@recent', '@opened'].includes(lower)) return 'scope';
      return '';
    }

    function isSearchCommandActive(command) {
      const tokens = state.query.split(/\s+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
      if (command === '@docs') return tokens.some((token) => ['@doc', '@docs', '@document', '@documents'].includes(token));
      if (command === '@prompt') return tokens.some((token) => ['@prompt', '@prompts'].includes(token));
      if (command === '@code') return tokens.some((token) => ['@code', '@source'].includes(token));
      if (command === '@task') return tokens.some((token) => ['@task', '@tasks'].includes(token));
      if (command === '@calendar') return tokens.some((token) => ['@calendar', '@event', '@events'].includes(token));
      if (command === '@inbox') return tokens.includes('@inbox');
      if (command === '@project') return tokens.some((token) => ['@project', '@current'].includes(token));
      if (command === '@favorite') return tokens.some((token) => ['@favorite', '@favorites', '@fav', '@star', '@starred'].includes(token));
      if (command === '@recent') return tokens.some((token) => ['@recent', '@opened'].includes(token));
      if (command === '@latest') return tokens.some((token) => ['@latest', '@newest'].includes(token));
      if (command === '@oldest') return tokens.includes('@oldest');
      if (command === '@todo') return tokens.some((token) => ['@todo', '@open', '@active'].includes(token));
      if (command === '@done') return tokens.some((token) => ['@done', '@completed'].includes(token));
      if (command === '@today') return tokens.includes('@today');
      if (command === '@week') return tokens.includes('@week');
      if (command === '@month') return tokens.includes('@month');
      return false;
    }

    function renderActiveSearchCommands(stack) {
      if (!stack) return;
      for (const chip of stack.querySelectorAll('.search-command')) {
        chip.classList.toggle('active', isSearchCommandActive(chip.textContent));
      }
    }

    function queueSearch(block, delay, useAi, recordHistory, effectiveQuery) {
      const query = state.query.trim();
      window.clearTimeout(state.searchTimer);
      state.search.requestedQuery = query;
      state.search.error = '';
      state.search.aiAttempted = Boolean(useAi);
      state.search.aiReason = useAi ? '正在使用 DeepSeek 理解查询...' : '';
      if (!query) {
        state.search.loading = false;
        state.search.responseQuery = '';
        state.search.effectiveQuery = '';
        state.search.aiAttempted = false;
        state.search.aiReason = '';
        state.search.groups = [];
        state.search.total = 0;
        return;
      }
      state.search.loading = true;
      state.searchTimer = window.setTimeout(() => {
        const requestId = state.search.requestId + 1;
        state.search.requestId = requestId;
        post('searchQuery', {
          requestId,
          query,
          limit: getLimit(block, 30),
          useAi: Boolean(useAi),
          recordHistory: Boolean(recordHistory || useAi),
          effectiveQuery: String(effectiveQuery || '')
        });
      }, delay === undefined ? 180 : delay);
    }

    function runSearchFromCommand(query) {
      state.query = String(query || '').trim();
      state.search.error = '';
      state.search.aiAttempted = false;
      state.search.aiReason = '';
      state.search.effectiveQuery = '';
      for (const input of document.querySelectorAll('input[type="search"]')) {
        input.value = state.query;
      }
      window.clearTimeout(state.searchTimer);
      const requestId = state.search.requestId + 1;
      state.search.requestId = requestId;
      state.search.loading = Boolean(state.query);
      renderSearchResultContainers();
      if (!state.query) {
        return;
      }
      post('searchQuery', {
        requestId,
        query: state.query,
        limit: 30,
        recordHistory: true
      });
    }

    function renderSearchResultContainers() {
      for (const container of document.querySelectorAll('[data-search-results="true"]')) {
        renderSearchResults(container, { options: { limit: container.dataset.limit || 30 } });
      }
    }

    function searchGroup(group) {
      const section = div('search-group');
      const head = div('search-group-title');
      head.append(div('search-group-name', group.title), div('count', String((group.items || []).length)));
      section.appendChild(head);
      for (const item of group.items || []) {
        section.appendChild(searchResultRow(item));
      }
      return section;
    }

    function searchResultRow(item) {
      const resultKey = getSearchResultKey(item);
      const highlightTerms = getSearchHighlightTerms();
      const row = div('item search-result');
      row.dataset.resultKey = resultKey;
      if (item.filePath) {
        row.classList.add('openable');
        row.title = '打开 ' + (item.relativePath || item.fileName || item.title);
        row.addEventListener('click', (event) => {
          if (event.target.closest('button, input, select, textarea')) return;
          post('openItem', Object.assign({ filePath: item.filePath }, item.line ? { line: item.line } : {}));
        });
      }
      const main = div('item-main');
      const title = div('item-title');
      appendHighlightedText(title, item.title || item.fileName, highlightTerms);
      title.title = item.filePath;
      const metaParts = [item.sourceName, item.relativePath || item.fileName];
      if (item.heading) metaParts.push(item.heading);
      if (item.filePath && item.line) metaParts.push('第 ' + String(item.line) + ' 行');
      const meta = div('item-meta');
      appendHighlightedText(meta, metaParts.filter(Boolean).join(' · '), highlightTerms);
      main.append(title, meta);
      if (item.snippet) {
        const snippet = div('search-snippet');
        appendHighlightedText(snippet, item.snippet, highlightTerms);
        main.appendChild(snippet);
      }
      if (item.preview) {
        const preview = div('search-preview');
        appendHighlightedText(preview, item.preview, highlightTerms);
        main.appendChild(preview);
      }
      if (Array.isArray(item.reasons) && item.reasons.length > 0) {
        const reasons = div('reason-list');
        for (const reason of item.reasons.slice(0, 4)) {
          reasons.appendChild(div('reason-chip', reason));
        }
        main.appendChild(reasons);
      }
      const actions = div('item-actions');
      if (item.filePath) {
        const open = searchActionButton('↵', '打开', 'open', { primary: true });
        open.dataset.filePath = item.filePath;
        if (item.line) open.dataset.line = String(item.line);
        actions.appendChild(open);
      }
      if (item.isPrompt && item.filePath) {
        const copy = searchActionButton('⧉', '复制 Prompt', 'copyPrompt');
        copy.dataset.filePath = item.filePath;
        actions.appendChild(copy);
      }
      if (item.category === 'task' && !item.done) {
        const complete = searchActionButton('✓', '完成事项', 'completeTask');
        complete.dataset.quadrantId = item.quadrantId;
        complete.dataset.taskId = item.taskId;
        actions.appendChild(complete);
      }
      if (item.category !== 'task') {
        const task = searchActionButton('+', '加入待办', 'addTask');
        task.title = '加入四象限的重要不紧急';
        task.dataset.filePath = item.filePath || '';
        task.dataset.taskText = buildSearchTaskText(item);
        actions.appendChild(task);
      }
      if (item.filePath) {
        const isFavorite = getFavoritePaths().has(item.filePath);
        const favorite = searchActionButton(isFavorite ? '★' : '☆', isFavorite ? '取消收藏' : '收藏', 'favorite', {
          active: isFavorite
        });
        favorite.dataset.filePath = item.filePath;
        actions.appendChild(favorite);
      }
      row.append(main, actions);
      return row;
    }

    function buildSearchTaskText(item) {
      const target = item.heading ? item.title + ' / ' + item.heading : item.title;
      return '处理：' + target;
    }

    function getSearchResultKey(item) {
      return item.filePath || item.id || [item.category, item.title, item.relativePath].filter(Boolean).join(':');
    }

    function getSearchHighlightTerms() {
      const terms = new Set();
      for (const query of [state.search.effectiveQuery, state.query]) {
        for (const token of String(query || '').split(/\s+/).map((item) => item.trim()).filter(Boolean)) {
          const lower = token.toLowerCase();
          if (lower.startsWith('@') || lower.startsWith('recent:')) {
            continue;
          }
          if (lower.startsWith('path:')) {
            addHighlightTerm(terms, token.slice(5));
            continue;
          }
          if (lower.startsWith('title:') || lower.startsWith('source:') || lower.startsWith('ext:')) {
            addHighlightTerm(terms, token.slice(token.indexOf(':') + 1));
            continue;
          }
          if (/^(limit|top|sort|date|after|before|updated):/i.test(lower)) {
            continue;
          }
          if (lower.startsWith('#')) {
            addHighlightTerm(terms, token.slice(1));
            continue;
          }
          addHighlightTerm(terms, token);
        }
      }
      return Array.from(terms).sort((a, b) => b.length - a.length).slice(0, 10);
    }

    function addHighlightTerm(terms, value) {
      const term = String(value || '').trim();
      if (term) terms.add(term);
    }

    function appendHighlightedText(target, text, terms) {
      const value = String(text || '');
      const uniqueTerms = (terms || []).filter(Boolean);
      if (!value || uniqueTerms.length === 0) {
        target.textContent = value;
        return;
      }

      const expression = new RegExp(uniqueTerms.map(escapeRegExp).join('|'), 'gi');
      let lastIndex = 0;
      let match;
      while ((match = expression.exec(value)) !== null) {
        if (match.index > lastIndex) {
          target.appendChild(document.createTextNode(value.slice(lastIndex, match.index)));
        }
        const hit = document.createElement('mark');
        hit.className = 'search-hit';
        hit.textContent = match[0];
        target.appendChild(hit);
        lastIndex = match.index + match[0].length;
      }
      if (lastIndex < value.length) {
        target.appendChild(document.createTextNode(value.slice(lastIndex)));
      }
    }

    function escapeRegExp(value) {
      const slash = String.fromCharCode(92);
      const specials = new Set([slash, '|', '{', '}', '(', ')', '[', ']', '^', '$', '+', '*', '?', '.']);
      return String(value)
        .split('')
        .map((char) => specials.has(char) ? slash + char : char)
        .join('');
    }

    function renderQuickCapture(container) {
      const stack = div('stack');
      const form = div('quick-capture-form');
      const input = document.createElement('textarea');
      input.className = 'quick-capture-input';
      input.placeholder = '记录想法、待办、链接或代码片段';
      const controls = div('quick-capture-controls');
      const kind = document.createElement('select');
      for (const option of [
        ['note', '想法'],
        ['task', '待办'],
        ['link', '链接'],
        ['code', '代码']
      ]) {
        const item = document.createElement('option');
        item.value = option[0];
        item.textContent = option[1];
        kind.appendChild(item);
      }
      const dueDate = inlineDateField();
      const save = button('保存', commit, false);
      save.title = '保存快速记录';
      const ai = button('AI', commitAi, true);
      ai.title = '用 AI 作为待办归类到四象限';
      const open = actionButton('收集箱', 'openInbox', true);
      open.title = '打开收集箱';
      kind.addEventListener('change', syncDateVisibility);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      });
      controls.append(kind, dueDate, save, ai, open);
      form.append(input, controls);
      stack.appendChild(form);
      const recent = quickCaptureRecentList();
      if (recent) stack.appendChild(recent);
      container.appendChild(stack);

      syncDateVisibility();

      function commit() {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        post('quickCaptureSave', {
          text,
          kind: kind.value,
          dueDate: dueDate.hidden ? '' : dueDate.getValue()
        });
        input.value = '';
        dueDate.clearValue();
      }

      function commitAi() {
        const text = input.value.trim();
        if (!text) {
          input.focus();
          return;
        }
        post('quickCaptureAi', {
          text,
          dueDate: dueDate.hidden ? '' : dueDate.getValue()
        });
        input.value = '';
        dueDate.clearValue();
      }

      function syncDateVisibility() {
        dueDate.hidden = kind.value !== 'task';
      }
    }

    function quickCaptureRecentList() {
      const recent = Array.isArray(state.model.data.quickCaptures) ? state.model.data.quickCaptures.slice(0, 4) : [];
      if (recent.length === 0) return undefined;
      const list = div('quick-capture-recent');
      list.appendChild(div('quick-capture-recent-title', '最近记录'));
      for (const item of recent) {
        const row = div('quick-capture-item');
        if (item.reason) row.title = item.reason;
        const kind = div('quick-capture-kind', formatQuickCaptureKind(item.kind));
        const text = div('quick-capture-text', String(item.text || '').replace(/\s+/g, ' '));
        const meta = div('quick-capture-meta', [
          item.label,
          item.dueDate,
          formatCaptureTime(item.createdAt)
        ].filter(Boolean).join(' · '));
        row.append(kind, text, meta);
        list.appendChild(row);
      }
      return list;
    }

    function renderFocusTimer(container) {
      const focusTimer = state.model.data.focusTimer || {};
      if (!state.designMode && state.focusTimerHistoryVisible) {
        container.appendChild(focusTimerHistoryList(focusTimer.history || [], 8));
        return;
      }

      const timer = getFocusTimerSession();
      const wrap = div('focus-timer');
      const head = div('focus-timer-head');
      const duration = focusDurationControl((focusTimer.settings || {}).defaultFocusDurationMs || timer.durationMs || 1500000);
      const taskBinding = focusTaskBindingControl();
      const main = focusTimerMain(timer, duration, taskBinding);
      const ring = div('focus-ring');
      ring.style.setProperty('--focus-progress', String(timer.progress || 0) + '%');
      ring.appendChild(div('focus-ring-inner', String(timer.progress || 0) + '%'));
      head.append(main, focusTimerActions(timer, duration, taskBinding), ring);
      wrap.appendChild(head);

      const metrics = div('focus-metrics');
      metrics.append(
        focusMetric('专注', formatCompactDuration(timer.focusedMs || 0)),
        focusMetric('离开', formatCompactDuration(timer.blurredMs || 0)),
        focusMetric('打断', String(timer.interruptions || 0))
      );
      wrap.appendChild(metrics);

      container.appendChild(wrap);
    }

    function focusTimerMain(timer, duration, taskBinding) {
      const setupMode = timer.status === 'idle' || timer.status === 'completed';
      const main = div('focus-main ' + (setupMode ? 'setup' : 'active'));
      const timePanel = div('focus-time-panel');
      timePanel.appendChild(div('focus-status', formatFocusStatus(timer)));
      if (setupMode) {
        timePanel.appendChild(duration.element);
        main.appendChild(timePanel);
        main.appendChild(taskBinding.element);
      } else {
        timePanel.appendChild(div('focus-time', formatClock(timer.remainingMs)));
        const taskLabel = focusTaskTitle(timer.task);
        if (taskLabel) {
          timePanel.appendChild(div('focus-linked-task', '事项 · ' + taskLabel));
        }
        main.appendChild(timePanel);
      }
      return main;
    }

    function focusTimerActions(timer, duration, taskBinding) {
      const actions = div('focus-head-actions');
      if (timer.status === 'running') {
        actions.append(
          button('暂停', () => post('focusTimerPause'), true),
          button('终止', () => post('focusTimerReset'), true)
        );
        return actions;
      }
      if (timer.status === 'paused') {
        actions.append(button('继续', () => post('focusTimerResume'), false), button('终止', () => post('focusTimerReset'), true));
        return actions;
      }

      if (timer.status !== 'completed' || timer.type !== 'focus') {
        actions.append(button('开始', () => {
          if (!taskBinding.validate()) return;
          post('focusTimerStart', {
            durationMs: duration.getValue(),
            sessionType: 'focus',
            task: taskBinding.getValue(),
            saveDefaultDuration: true
          });
        }, false));
      }
      if (timer.status === 'completed' && timer.type === 'focus') {
        actions.append(
          button('短休息', () => post('focusTimerStart', { sessionType: 'shortBreak' }), false),
          button('长休息', () => post('focusTimerStart', { sessionType: 'longBreak' }), true),
          button('再专注', () => {
            if (!taskBinding.validate()) return;
            post('focusTimerStart', {
              durationMs: duration.getValue(),
              sessionType: 'focus',
              task: taskBinding.getValue(),
              saveDefaultDuration: true
            });
          }, true)
        );
      }
      if (timer.status === 'completed') {
        actions.appendChild(button('清空', () => post('focusTimerReset'), true));
      }
      return actions;
    }

    function focusDurationControl(durationMs) {
      const wrap = div('focus-duration-hero');
      const display = div('focus-duration-display');
      const input = document.createElement('input');
      input.className = 'focus-duration-input';
      input.type = 'number';
      input.min = '5';
      input.max = '240';
      input.step = '5';
      const minutes = Math.max(5, Math.round((Number(durationMs) || 1500000) / 60000));
      input.value = String(minutes);
      const unit = spanText('分钟');
      unit.className = 'focus-duration-unit';
      display.append(input, unit);
      const presets = div('focus-duration-presets');
      for (const value of [15, 25, 45, 60]) {
        const item = button(String(value), () => {
          input.value = String(value);
          syncPresetState();
        }, true);
        item.className = 'focus-duration-preset' + (value === minutes ? ' active' : '');
        item.title = String(value) + ' 分钟';
        presets.appendChild(item);
      }
      input.addEventListener('input', syncPresetState);
      wrap.append(display, presets);
      return {
        element: wrap,
        getValue() {
          const selected = Number(input.value);
          return Math.min(Math.max(Number.isFinite(selected) ? selected : 25, 5), 240) * 60000;
        }
      };

      function syncPresetState() {
        const selected = Number(input.value);
        for (const item of presets.querySelectorAll('.focus-duration-preset')) {
          item.classList.toggle('active', Number(item.textContent) === selected);
        }
      }
    }

    function focusTaskBindingControl() {
      const wrap = div('focus-task-binding');
      const tasks = getOpenFocusTasks();
      const select = document.createElement('select');
      select.className = 'focus-task-select';
      const none = document.createElement('option');
      none.value = '';
      none.textContent = '不关联事项';
      select.appendChild(none);
      for (const task of tasks.slice(0, 40)) {
        const option = document.createElement('option');
        option.value = task.quadrantId + '::' + task.id;
        option.textContent = truncateText(task.text, 22) + ' · ' + task.quadrantTitle;
        option.title = task.text;
        select.appendChild(option);
      }
      const create = document.createElement('option');
      create.value = '__new__';
      create.textContent = '+ 新建事项';
      select.appendChild(create);

      const newRow = div('focus-task-new');
      const input = document.createElement('input');
      input.className = 'focus-task-new-input';
      input.placeholder = '新事项内容';
      const quadrantSelect = document.createElement('select');
      quadrantSelect.className = 'focus-task-quadrant';
      for (const quadrant of state.model.data.quadrants || []) {
        const option = document.createElement('option');
        option.value = quadrant.id;
        option.textContent = quadrantShortTitle(quadrant.id);
        option.selected = quadrant.id === 'importantNotUrgent';
        quadrantSelect.appendChild(option);
      }
      newRow.append(input, quadrantSelect);
      wrap.append(select, newRow);
      select.addEventListener('change', syncNewTaskVisibility);
      syncNewTaskVisibility();
      return {
        element: wrap,
        getValue() {
          if (select.value === '__new__') {
            return {
              quadrantId: quadrantSelect.value || 'importantNotUrgent',
              newTaskText: input.value.trim()
            };
          }
          if (!select.value) {
            return {};
          }
          const parts = select.value.split('::');
          return {
            quadrantId: parts[0] || '',
            taskId: parts[1] || ''
          };
        },
        validate() {
          if (select.value !== '__new__' || input.value.trim()) {
            input.classList.remove('invalid');
            return true;
          }
          input.classList.add('invalid');
          input.focus();
          return false;
        }
      };

      function syncNewTaskVisibility() {
        newRow.hidden = select.value !== '__new__';
        if (!newRow.hidden) {
          window.setTimeout(() => input.focus(), 0);
        }
      }
    }

    function focusTimerHistoryList(history, limit) {
      const items = Array.isArray(history) ? history.slice(0, limit || 3) : [];
      const list = div('focus-history');
      list.appendChild(div('focus-history-title', '最近记录'));
      if (items.length === 0) {
        list.appendChild(div('focus-history-empty', '暂无记录'));
        return list;
      }
      for (const item of items) {
        const row = div('focus-history-item');
        row.append(
          div('focus-history-type', formatFocusHistoryBadge(item)),
          div('focus-history-main', focusHistoryMain(item)),
          div('focus-history-meta', formatTimeOfDay(item.completedAt))
        );
        list.appendChild(row);
      }
      return list;
    }

    function getOpenFocusTasks() {
      const result = [];
      for (const quadrant of state.model.data.quadrants || []) {
        for (const task of quadrant.items || []) {
          if (task.done) continue;
          result.push(Object.assign({}, task, {
            quadrantId: quadrant.id,
            quadrantTitle: quadrant.title
          }));
        }
      }
      return result.sort((left, right) => {
        const leftDue = left.dueDate || '9999-99-99';
        const rightDue = right.dueDate || '9999-99-99';
        if (leftDue !== rightDue) return leftDue.localeCompare(rightDue);
        return getQuadrantSortWeight(left.quadrantId) - getQuadrantSortWeight(right.quadrantId);
      });
    }

    function focusTaskTitle(task) {
      return task && task.title ? task.title : '';
    }

    function quadrantShortTitle(quadrantId) {
      return {
        importantUrgent: '重要紧急',
        importantNotUrgent: '重要不急',
        notImportantUrgent: '不重要紧急',
        notImportantNotUrgent: '不重要不急'
      }[quadrantId] || '四象限';
    }

    function focusMetric(label, value) {
      const item = div('focus-metric');
      item.append(div('focus-metric-value', value), div('focus-metric-label', label));
      return item;
    }

    function renderCountdown(container, block) {
      const wrap = div('countdown');
      const items = getCountdownItems();
      const doneCount = items.filter((item) => item.done).length;
      wrap.appendChild(countdownToolbar(items.length, doneCount));

      const editingItem = items.find((item) => item.id === state.countdownFormId);
      if (state.countdownFormId === 'new') {
        wrap.appendChild(countdownForm());
      } else if (editingItem) {
        wrap.appendChild(countdownForm(editingItem));
      }

      const limit = getLimit(block, 5);
      const displayPool = items
        .filter((item) => state.countdownShowDone || !item.done)
        .filter((item) => item.id !== state.countdownFormId);
      const visible = displayPool.slice(0, limit);
      if (visible.length === 0) {
        wrap.appendChild(empty(state.countdownShowDone ? '还没有倒计项。' : '没有进行中的倒计项。'));
        container.appendChild(wrap);
        return;
      }

      wrap.appendChild(countdownCard(visible[0], true));
      const rest = visible.slice(1);
      if (rest.length > 0) {
        const list = div('countdown-list');
        for (const item of rest) {
          list.appendChild(countdownCard(item, false));
        }
        wrap.appendChild(list);
      }
      if (displayPool.length > visible.length) {
        wrap.appendChild(div('muted', '还有 ' + String(displayPool.length - visible.length) + ' 个倒计项未展示'));
      }
      container.appendChild(wrap);
    }

    function countdownToolbar(total, doneCount) {
      const toolbar = div('countdown-toolbar');
      toolbar.appendChild(div('muted', total ? '最近节点 ' + String(total - doneCount) : '重要节点'));
      const actions = div('countdown-toolbar-actions');
      if (doneCount > 0) {
        const done = button(state.countdownShowDone ? '隐藏完成' : '完成', () => {
          state.countdownShowDone = !state.countdownShowDone;
          render();
        }, true);
        done.className = 'countdown-toggle-button' + (state.countdownShowDone ? ' active' : '');
        done.title = '切换已完成倒计项';
        actions.appendChild(done);
      }
      const add = button('+', () => {
        state.countdownFormId = state.countdownFormId === 'new' ? '' : 'new';
        render();
      }, true);
      add.className = 'countdown-add-button';
      add.title = '新增倒计日/时';
      actions.appendChild(add);
      toolbar.appendChild(actions);
      return toolbar;
    }

    function countdownCard(item, primary) {
      const card = div([
        primary ? 'countdown-hero' : 'countdown-item',
        item.color || 'blue',
        item.done ? 'done' : '',
        item.overdue ? 'overdue' : '',
        item.dueSoon ? 'due-soon' : ''
      ].filter(Boolean).join(' '));
      const main = div('countdown-main');
      main.append(div('countdown-title', item.title), div('countdown-meta', countdownMeta(item)));
      const side = div('countdown-side');
      side.append(div('countdown-value', item.label), countdownActions(item));
      card.append(main, side);
      return card;
    }

    function countdownActions(item) {
      const actions = div('countdown-actions');
      const done = button(item.done ? '恢复' : '完成', () => {
        post('toggleCountdownItem', { itemId: item.id, done: !item.done });
      }, true);
      const edit = button('编辑', () => {
        state.countdownFormId = item.id;
        render();
      }, true);
      const remove = button('删除', () => post('deleteCountdownItem', { itemId: item.id }), true);
      actions.append(done, edit, remove);
      return actions;
    }

    function countdownForm(item) {
      const form = div('countdown-form');
      const title = document.createElement('input');
      title.placeholder = '节点名称';
      title.value = item ? item.title : '';
      const date = document.createElement('input');
      date.type = 'date';
      date.value = item ? item.targetDate : '';
      const time = document.createElement('input');
      time.type = 'time';
      time.value = item ? item.targetTime : '';
      const color = document.createElement('select');
      for (const option of countdownColorOptions()) {
        const node = document.createElement('option');
        node.value = option.value;
        node.textContent = option.label;
        node.selected = option.value === (item ? item.color : 'blue');
        color.appendChild(node);
      }
      const save = button('保存', () => {
        const payload = {
          title: title.value,
          targetDate: date.value,
          targetTime: time.value,
          color: color.value,
          note: note.value
        };
        if (!payload.title.trim()) {
          title.focus();
          return;
        }
        if (!payload.targetDate) {
          date.focus();
          return;
        }
        post(item ? 'updateCountdownItem' : 'addCountdownItem', item ? { itemId: item.id, item: payload } : { item: payload });
        state.countdownFormId = '';
      }, false);
      const cancel = button('取消', () => {
        state.countdownFormId = '';
        render();
      }, true);
      const note = document.createElement('input');
      note.className = 'countdown-form-note';
      note.placeholder = '备注（可选）';
      note.value = item ? item.note : '';
      form.append(title, date, time, color, save, cancel, note);
      window.setTimeout(() => title.focus(), 0);
      return form;
    }

    function getCountdownItems() {
      const data = state.model.data.countdown || {};
      const items = Array.isArray(data.items) ? data.items : [];
      return items.map(addCountdownFields).filter(Boolean).sort(compareCountdownItems);
    }

    function addCountdownFields(item) {
      const target = getCountdownTarget(item);
      if (!target) return undefined;
      const now = new Date();
      const dateMode = !item.targetTime;
      const today = startOfLocalDay(now);
      const targetDay = startOfLocalDay(target);
      const dayDiff = Math.round((targetDay.getTime() - today.getTime()) / 86400000);
      const msDiff = dateMode ? targetDay.getTime() - today.getTime() : target.getTime() - now.getTime();
      const overdue = dateMode ? dayDiff < 0 : msDiff < 0;
      const dueSoon = !overdue && (dateMode ? dayDiff <= 1 : msDiff <= 24 * 60 * 60 * 1000);
      return Object.assign({}, item, {
        target,
        dayDiff,
        msDiff,
        overdue,
        dueSoon,
        label: formatCountdownLabel(item, dayDiff, msDiff)
      });
    }

    function compareCountdownItems(left, right) {
      if (left.done !== right.done) return left.done ? 1 : -1;
      if (left.overdue !== right.overdue) return left.overdue ? 1 : -1;
      const leftDistance = Math.abs(left.msDiff || 0);
      const rightDistance = Math.abs(right.msDiff || 0);
      return leftDistance - rightDistance || left.title.localeCompare(right.title);
    }

    function getCountdownTarget(item) {
      const date = parseDateKey(item.targetDate);
      if (!date) return undefined;
      if (item.targetTime) {
        const parts = String(item.targetTime).split(':').map((part) => Number.parseInt(part, 10));
        date.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
      }
      return date;
    }

    function formatCountdownLabel(item, dayDiff, msDiff) {
      if (!item.targetTime) {
        if (dayDiff > 0) return String(dayDiff) + ' 天';
        if (dayDiff === 0) return '今天';
        return '已过 ' + String(Math.abs(dayDiff)) + ' 天';
      }
      if (msDiff < 0) return '已过期';
      const minutes = Math.max(0, Math.ceil(msDiff / 60000));
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      if (days > 0) return String(days) + ' 天 ' + String(hours) + ' 时';
      if (hours > 0) return String(hours) + ' 时 ' + String(minutes % 60) + ' 分';
      return String(Math.max(1, minutes)) + ' 分钟';
    }

    function countdownMeta(item) {
      return [item.targetDate + (item.targetTime ? ' ' + item.targetTime : ''), item.note].filter(Boolean).join(' · ');
    }

    function countdownColorOptions() {
      return [
        { value: 'blue', label: '蓝色' },
        { value: 'green', label: '绿色' },
        { value: 'yellow', label: '黄色' },
        { value: 'red', label: '红色' },
        { value: 'purple', label: '紫色' }
      ];
    }

    function startOfLocalDay(date) {
      return new Date(date.getFullYear(), date.getMonth(), date.getDate());
    }

    function renderKnowledgeGraph(container, block) {
      const graph = state.model.data.knowledgeGraph || { nodes: [], edges: [] };
      const wrap = div('knowledge-graph');
      const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const edges = Array.isArray(graph.edges) ? graph.edges : [];
      if (nodes.length === 0) {
        wrap.appendChild(empty('还没有可展示的知识关系。'));
        container.appendChild(wrap);
        return;
      }
      const view = buildKnowledgeGraphView(graph, getLimit(block, 14));
      wrap.appendChild(knowledgeGraphToolbar(graph, view));
      const canvas = div('knowledge-graph-canvas');
      canvas.append(knowledgeGraphSvg(view), knowledgeGraphSidePanel(graph, view));
      wrap.appendChild(canvas);
      container.appendChild(wrap);
    }

    function knowledgeGraphToolbar(graph, view) {
      const toolbar = div('knowledge-graph-toolbar');
      const views = div('knowledge-graph-tabs');
      for (const option of [
        ['overview', '全图'],
        ['cluster', '主题'],
        ['isolated', '孤岛'],
        ['recent', '最近']
      ]) {
        views.appendChild(knowledgeGraphToggle(option[1], state.knowledgeGraphView === option[0], () => {
          state.knowledgeGraphView = option[0];
          state.knowledgeGraphNodeId = '';
          render();
        }));
      }
      const relations = div('knowledge-graph-tabs');
      for (const option of [
        ['all', '全部'],
        ['metadata', '元数据'],
        ['link', '链接'],
        ['tag', '标签'],
        ['reference', '引用'],
        ['path', '路径']
      ]) {
        relations.appendChild(knowledgeGraphToggle(option[1], state.knowledgeGraphRelation === option[0], () => {
          state.knowledgeGraphRelation = option[0];
          render();
        }));
      }
      const actions = div('knowledge-graph-actions');
      actions.appendChild(button('刷新', () => post('refresh'), true));
      const totalNodes = (graph.stats && graph.stats.nodes) || graph.nodes.length || 0;
      const totalEdges = (graph.stats && graph.stats.edges) || graph.edges.length || 0;
      const visibleNodes = view && Array.isArray(view.nodes) ? view.nodes.length : totalNodes;
      const visibleEdges = view && Array.isArray(view.edges) ? view.edges.length : totalEdges;
      const meta = div('knowledge-graph-meta', '当前 ' + String(visibleNodes) + '/' + String(totalNodes) + ' 节点 · ' + String(visibleEdges) + '/' + String(totalEdges) + ' 关系');
      toolbar.append(views, relations, actions, meta);
      return toolbar;
    }

    function knowledgeGraphToggle(label, active, onClick) {
      const control = button(label, onClick, true);
      control.className = active ? 'active' : '';
      return control;
    }

    function buildKnowledgeGraphView(graph, limit) {
      const allNodes = Array.isArray(graph.nodes) ? graph.nodes : [];
      const allEdges = filterKnowledgeGraphEdges(Array.isArray(graph.edges) ? graph.edges : []);
      const nodeMap = new Map(allNodes.map((node) => [node.id, node]));
      const selectedId = nodeMap.has(state.knowledgeGraphNodeId) ? state.knowledgeGraphNodeId : '';
      if (state.knowledgeGraphView === 'overview') {
        const nodes = allNodes.slice();
        const ids = new Set(nodes.map((node) => node.id));
        return {
          mode: 'overview',
          selectedId,
          nodes,
          edges: allEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
        };
      }
      if (state.knowledgeGraphView === 'isolated') {
        const connected = new Set(allEdges.flatMap((edge) => [edge.source, edge.target]));
        return {
          mode: 'isolated',
          selectedId: '',
          nodes: allNodes.filter((node) => !connected.has(node.id)).slice(0, limit),
          edges: []
        };
      }
      if (state.knowledgeGraphView === 'recent') {
        const nodes = allNodes.slice().sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0)).slice(0, limit);
        const ids = new Set(nodes.map((node) => node.id));
        return {
          mode: 'recent',
          selectedId,
          nodes,
          edges: allEdges.filter((edge) => ids.has(edge.source) && ids.has(edge.target)).slice(0, limit * 2)
        };
      }
      const centerId = selectedId || getGraphCenterNodeId(allNodes, allEdges);
      if (!centerId) {
        return { mode: 'cluster', selectedId: '', nodes: allNodes.slice(0, limit), edges: allEdges.slice(0, limit * 2) };
      }
      const neighborEdges = allEdges.filter((edge) => edge.source === centerId || edge.target === centerId).slice(0, Math.max(4, limit - 1));
      const ids = new Set([centerId]);
      for (const edge of neighborEdges) {
        ids.add(edge.source);
        ids.add(edge.target);
      }
      const nodes = [nodeMap.get(centerId)].concat(Array.from(ids).filter((id) => id !== centerId).map((id) => nodeMap.get(id)).filter(Boolean)).slice(0, limit);
      const visibleIds = new Set(nodes.map((node) => node.id));
      return {
        mode: 'cluster',
        selectedId: centerId,
        nodes,
        edges: allEdges.filter((edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target)).slice(0, limit * 2)
      };
    }

    function filterKnowledgeGraphEdges(edges) {
      if (state.knowledgeGraphRelation === 'all') return edges;
      return edges.filter((edge) => edge.relationGroup === state.knowledgeGraphRelation);
    }

    function getGraphCenterNodeId(nodes, edges) {
      const scores = new Map(nodes.map((node) => [node.id, node.weight || 0]));
      for (const edge of edges) {
        scores.set(edge.source, (scores.get(edge.source) || 0) + edge.weight);
        scores.set(edge.target, (scores.get(edge.target) || 0) + edge.weight);
      }
      return Array.from(scores.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] || (nodes[0] && nodes[0].id) || '';
    }

    function knowledgeGraphSvg(view) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'knowledge-graph-svg');
      svg.setAttribute('viewBox', '0 0 640 260');
      svg.setAttribute('role', 'img');
      const positions = getKnowledgeGraphPositions(view.nodes, view.selectedId, view.mode);
      for (const edge of view.edges) {
        const start = positions.get(edge.source);
        const end = positions.get(edge.target);
        if (!start || !end) continue;
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'knowledge-graph-edge ' + (edge.relationGroup || 'path'));
        line.setAttribute('x1', String(start.x));
        line.setAttribute('y1', String(start.y));
        line.setAttribute('x2', String(end.x));
        line.setAttribute('y2', String(end.y));
        line.setAttribute('stroke-width', String(Math.max(1, Math.min(4, edge.weight / 30))));
        line.appendChild(svgTitle(edge.reasons.join(' · ') + ' · ' + String(edge.weight)));
        svg.appendChild(line);
      }
      for (const node of view.nodes) {
        const position = positions.get(node.id);
        if (!position) continue;
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', ['knowledge-graph-node', node.type || 'document', node.id === view.selectedId ? 'selected' : ''].filter(Boolean).join(' '));
        group.setAttribute('tabindex', '0');
        group.addEventListener('click', () => {
          state.knowledgeGraphNodeId = node.id;
          state.knowledgeGraphView = 'cluster';
          render();
        });
        group.addEventListener('dblclick', () => post('openItem', { filePath: node.filePath }));
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(position.x));
        circle.setAttribute('cy', String(position.y));
        circle.setAttribute('r', String(Math.max(14, Math.min(28, 12 + (node.weight || 0)))));
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', String(position.x));
        text.setAttribute('y', String(position.y + 4));
        text.textContent = truncateGraphLabel(node.title, 9);
        group.append(circle, text, svgTitle(node.title + '\\n' + node.relativePath));
        svg.appendChild(group);
      }
      return svg;
    }

    function getKnowledgeGraphPositions(nodes, centerId, mode) {
      const positions = new Map();
      if (nodes.length === 0) return positions;
      const centerNode = nodes.find((node) => node.id === centerId) || nodes[0];
      positions.set(centerNode.id, { x: 320, y: 130 });
      const rest = nodes.filter((node) => node.id !== centerNode.id);
      if (mode === 'overview') {
        rest.forEach((node, index) => {
          const ring = index < 12 ? 1 : 2;
          const ringIndex = ring === 1 ? index : index - 12;
          const ringCount = ring === 1 ? Math.min(12, rest.length) : Math.max(1, rest.length - 12);
          const radiusX = ring === 1 ? 118 : 235;
          const radiusY = ring === 1 ? 54 : 103;
          const angle = -Math.PI / 2 + ringIndex * Math.PI * 2 / ringCount;
          positions.set(node.id, {
            x: Math.round(320 + Math.cos(angle) * radiusX),
            y: Math.round(130 + Math.sin(angle) * radiusY)
          });
        });
        return positions;
      }
      const radius = rest.length > 7 ? 102 : 92;
      rest.forEach((node, index) => {
        const angle = -Math.PI / 2 + index * Math.PI * 2 / Math.max(1, rest.length);
        positions.set(node.id, {
          x: Math.round(320 + Math.cos(angle) * radius),
          y: Math.round(130 + Math.sin(angle) * radius)
        });
      });
      return positions;
    }

    function knowledgeGraphSidePanel(graph, view) {
      const side = div('knowledge-graph-side');
      const selected = view.nodes.find((node) => node.id === view.selectedId) || view.nodes[0];
      const summary = div('knowledge-graph-summary');
      if (selected) {
        summary.append(
          div('knowledge-graph-title', selected.title),
          div('knowledge-graph-meta', selected.relativePath),
          div('knowledge-graph-meta', formatKnowledgeGraphNodeMeta(selected, view.edges))
        );
        const open = button('打开', () => post('openItem', { filePath: selected.filePath }), true);
        summary.appendChild(open);
      } else {
        summary.append(div('knowledge-graph-title', '暂无节点'), div('knowledge-graph-meta', '换个关系类型试试。'));
      }
      side.appendChild(summary);
      const selectedForInsights = selected && state.knowledgeGraphNodeId === selected.id ? selected : undefined;
      const insights = knowledgeGraphInsightsPanel(graph, selectedForInsights);
      if (insights) {
        side.appendChild(insights);
      }
      const relations = view.edges.slice(0, 6);
      if (relations.length === 0) {
        side.appendChild(div('knowledge-graph-relation', '当前视图没有关系边。'));
        return side;
      }
      const nodeMap = new Map((graph.nodes || []).map((node) => [node.id, node]));
      const relationList = div('knowledge-graph-relations');
      for (const edge of relations) {
        const relation = div('knowledge-graph-relation');
        const left = nodeMap.get(edge.source);
        const right = nodeMap.get(edge.target);
        relation.append(
          div('knowledge-graph-title', truncateGraphLabel((left && left.title || '') + ' ↔ ' + (right && right.title || ''), 28)),
          div('knowledge-graph-reason', edge.reasons.join(' · ') + ' · ' + edge.weight)
        );
        relationList.appendChild(relation);
      }
      side.appendChild(relationList);
      return side;
    }

    function knowledgeGraphInsightsPanel(graph, selectedNode) {
      const insights = getKnowledgeGraphInsights(graph, selectedNode)
        .filter((insight) => !isKnowledgeGraphAiCompleted(insight))
        .slice(0, 4);
      const status = state.knowledgeGraphAi || {};
      const hasStatus = status.phase && status.phase !== 'idle';
      if (insights.length === 0 && !hasStatus && !selectedNode) return undefined;
      const panel = div('knowledge-graph-insights');
      panel.appendChild(div('knowledge-graph-title', selectedNode ? '节点洞察' : '全局洞察'));
      const list = div('knowledge-graph-insight-list');
      list.appendChild(knowledgeGraphAiStatus());
      if (insights.length === 0 && selectedNode) {
        list.appendChild(div('knowledge-graph-reason', '当前节点暂时没有需要处理的洞察。'));
      }
      for (const insight of insights) {
        list.appendChild(knowledgeGraphInsightCard(insight));
      }
      panel.appendChild(list);
      return panel;
    }

    function getKnowledgeGraphInsights(graph, selectedNode) {
      const allInsights = Array.isArray(graph.insights) ? graph.insights : [];
      if (!selectedNode) {
        return allInsights;
      }
      const related = allInsights.filter((insight) => knowledgeGraphInsightMatchesNode(insight, selectedNode));
      const generated = buildKnowledgeGraphNodeInsights(graph, selectedNode);
      return uniqueKnowledgeGraphInsights(related.concat(generated))
        .sort((left, right) => (right.priority || 0) - (left.priority || 0) || String(left.title || '').localeCompare(String(right.title || '')));
    }

    function knowledgeGraphInsightMatchesNode(insight, node) {
      if (!insight || !node) return false;
      if (insight.nodeId === node.id || insight.filePath === node.filePath) return true;
      const relatedFiles = Array.isArray(insight.relatedFiles) ? insight.relatedFiles : [];
      return relatedFiles.some((file) =>
        file && (file.filePath === node.filePath || file.relativePath === node.relativePath || file.title === node.title)
      );
    }

    function buildKnowledgeGraphNodeInsights(graph, node) {
      const edges = (Array.isArray(graph.edges) ? graph.edges : [])
        .filter((edge) => edge.source === node.id || edge.target === node.id)
        .sort((left, right) => (right.weight || 0) - (left.weight || 0));
      const nodeMap = new Map((graph.nodes || []).map((item) => [item.id, item]));
      const relatedFiles = [knowledgeGraphNodeToRelatedFile(node)]
        .concat(edges.slice(0, 5).map((edge) => knowledgeGraphNodeToRelatedFile(getKnowledgeGraphOtherNode(edge, node, nodeMap))).filter(Boolean));
      const insights = [];
      if (edges.length === 0) {
        insights.push({
          id: 'node-isolated:' + node.id,
          type: 'isolated',
          title: '处理孤岛：' + node.title,
          reason: '这个节点还没有任何关系，可以补标签、补关联文档，或者归档到主题入口。',
          priority: 65,
          nodeId: node.id,
          filePath: node.filePath,
          relatedFiles,
          query: node.title
        });
      }
      const missingLink = edges.find((edge) => {
        const types = Array.isArray(edge.types) ? edge.types : [edge.type];
        return edge.weight >= 54 && !types.some((type) => type === 'markdown-link' || type === 'wikilink');
      });
      if (missingLink) {
        const other = getKnowledgeGraphOtherNode(missingLink, node, nodeMap);
        insights.push({
          id: 'node-missing-link:' + missingLink.id + ':' + node.id,
          type: 'missing-link',
          title: '补链接：' + node.title + (other ? ' ↔ ' + other.title : ''),
          reason: '当前节点存在强关系但没有显式链接：' + (missingLink.reasons || []).join('、') + '。',
          priority: 82,
          nodeId: node.id,
          edgeId: missingLink.id,
          filePath: node.filePath,
          relatedFiles,
          query: other ? node.title + ' ' + other.title : node.title
        });
      }
      if (edges.length >= 3) {
        insights.push({
          id: 'node-hub:' + node.id,
          type: 'hub',
          title: '整理入口：' + node.title,
          reason: '当前节点连接了 ' + String(edges.length) + ' 条关系，适合补摘要、主题标签和相关文档入口。',
          priority: 72 + edges.length,
          nodeId: node.id,
          filePath: node.filePath,
          relatedFiles,
          query: node.title
        });
      }
      if (!node.summary || !Array.isArray(node.tags) || node.tags.length === 0) {
        insights.push({
          id: 'node-metadata:' + node.id,
          type: 'metadata',
          title: '补元数据：' + node.title,
          reason: '这个节点缺少摘要或标签，补齐后图谱关系和搜索排序会更稳定。',
          priority: 62,
          nodeId: node.id,
          filePath: node.filePath,
          relatedFiles,
          query: node.title
        });
      }
      return insights;
    }

    function getKnowledgeGraphOtherNode(edge, node, nodeMap) {
      if (!edge || !node) return undefined;
      const otherId = edge.source === node.id ? edge.target : edge.source;
      return nodeMap.get(otherId);
    }

    function knowledgeGraphNodeToRelatedFile(node) {
      if (!node) return undefined;
      return {
        title: node.title,
        filePath: node.filePath,
        relativePath: node.relativePath
      };
    }

    function uniqueKnowledgeGraphInsights(insights) {
      const result = [];
      const seen = new Set();
      for (const insight of insights) {
        const id = String(insight && (insight.id || insight.title) || '');
        if (!id || seen.has(id)) continue;
        seen.add(id);
        result.push(insight);
      }
      return result;
    }

    function knowledgeGraphAiStatus() {
      const status = state.knowledgeGraphAi || {};
      const phase = status.phase && status.phase !== 'idle' ? status.phase : 'hint';
      const box = div('knowledge-graph-ai-status ' + phase);
      const title = document.createElement('strong');
      title.textContent = status.message || 'AI 整理会做什么';
      const detail = div('', status.detail || '读取目标文档和相关文档片段，让 DeepSeek 补充 tags、topics、summary、related 等 frontmatter 元数据，完成后刷新知识图谱。');
      box.append(title, detail);
      return box;
    }

    function knowledgeGraphInsightCard(insight) {
      const insightId = String(insight.id || insight.title || '');
      const card = div('knowledge-graph-insight ' + (insight.type || ''));
      card.append(
        div('knowledge-graph-title', insight.title || '图谱洞察'),
        div('knowledge-graph-reason', insight.reason || '这条关系值得整理。')
      );
      const actions = div('knowledge-graph-insight-actions');
      if (insight.filePath) {
        actions.appendChild(button('打开', () => post('openItem', { filePath: insight.filePath }), true));
      }
      if (insight.query) {
        actions.appendChild(button('搜索', () => runSearchFromCommand(insight.query), true));
      }
      if (insight.filePath) {
        const ai = button(isKnowledgeGraphAiLoading(insight) ? '整理中...' : 'AI 整理', () => {
          state.knowledgeGraphAi = {
            insightId,
            phase: 'reading',
            message: '准备整理这条洞察',
            detail: '正在发送请求给扩展端，随后会读取目标文档、生成元数据并刷新图谱。',
            targetFile: String(insight.filePath || '')
          };
          render();
          post('knowledgeGraphAiOrganize', { insight });
        }, true);
        ai.title = '读取目标文档和相关文档，让 DeepSeek 生成 frontmatter 元数据并刷新知识图谱';
        ai.disabled = isKnowledgeGraphAiBusy();
        actions.appendChild(ai);
      }
      card.appendChild(actions);
      return card;
    }

    function isKnowledgeGraphAiCompleted(insight) {
      const id = String(insight && (insight.id || insight.title) || '');
      return Boolean(id && state.knowledgeGraphAiCompleted[id]);
    }

    function isKnowledgeGraphAiBusy() {
      const phase = state.knowledgeGraphAi && state.knowledgeGraphAi.phase;
      return phase === 'reading' || phase === 'thinking' || phase === 'writing' || phase === 'busy';
    }

    function isKnowledgeGraphAiLoading(insight) {
      const status = state.knowledgeGraphAi || {};
      const id = String(insight && (insight.id || insight.title) || '');
      return isKnowledgeGraphAiBusy() && String(status.insightId || '') === id;
    }

    function formatKnowledgeGraphNodeMeta(node, edges) {
      const degree = edges.filter((edge) => edge.source === node.id || edge.target === node.id).length;
      const tags = node.tags && node.tags.length ? ' · #' + node.tags.slice(0, 3).join(' #') : '';
      return formatGraphNodeType(node.type) + ' · ' + String(degree) + ' 条关系' + tags;
    }

    function formatGraphNodeType(type) {
      return { prompt: 'Prompt', code: '代码', document: '文档' }[type] || '文档';
    }

    function svgTitle(text) {
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      title.textContent = text;
      return title;
    }

    function truncateGraphLabel(value, max) {
      const text = String(value || '').trim();
      return text.length > max ? text.slice(0, Math.max(1, max - 1)) + '…' : text;
    }

    function renderNextAction(container, block) {
      const wrap = div('next-action');
      const data = state.model.data.nextAction || {};
      const legacyRecommendations = Array.isArray(data.recommendations) ? data.recommendations : [];
      const systemRecommendations = Array.isArray(data.systemRecommendations)
        ? data.systemRecommendations
        : legacyRecommendations.filter((item) => !item.ai);
      const aiRecommendations = Array.isArray(data.aiRecommendations)
        ? data.aiRecommendations
        : legacyRecommendations.filter((item) => item.ai);
      const limit = getLimit(block, 4);
      const activeTab = state.nextActionTab === 'ai' ? 'ai' : 'system';
      wrap.appendChild(nextActionTabs({
        activeTab,
        systemCount: systemRecommendations.length,
        aiCount: aiRecommendations.length,
        ai: data.ai
      }));
      if (activeTab === 'ai') {
        const visible = aiRecommendations.slice(0, limit);
        wrap.appendChild(nextActionAiPanel(data, visible));
        recordNextActionImpressions(visible);
      } else {
        const visible = systemRecommendations.slice(0, limit);
        wrap.appendChild(nextActionPanel({
          items: visible,
          emptyTitle: '当前没有高优先级推荐',
          emptyReason: '可以先补充四象限事项、倒计节点，或把快速记录整理成明确任务。',
          className: 'system'
        }));
        recordNextActionImpressions(visible);
      }
      if (state.nextActionNotice) {
        wrap.appendChild(div('next-action-coach-note', state.nextActionNotice));
      }
      container.appendChild(wrap);
    }

    function nextActionTabs(options) {
      const tabs = div('next-action-tabs');
      const list = div('next-action-tab-list');
      list.append(
        nextActionTabButton('system', '系统推荐', options.systemCount, options.activeTab === 'system'),
        nextActionTabButton('ai', 'AI 建议', options.aiCount, options.activeTab === 'ai')
      );
      const ai = options.ai || {};
      const meta = options.activeTab === 'ai'
        ? (ai.generatedAt ? 'DeepSeek · ' + formatTimeOfDay(ai.generatedAt) : '可输入问题')
        : '本地规则 · ' + String(options.systemCount);
      tabs.append(list, div('next-action-tab-meta', meta));
      return tabs;
    }

    function nextActionTabButton(tab, label, count, active) {
      const control = button(label + ' ' + String(count || 0), () => {
        state.nextActionTab = tab;
        render();
      }, true);
      control.className = 'next-action-tab-button' + (active ? ' active' : '');
      control.setAttribute('aria-pressed', active ? 'true' : 'false');
      return control;
    }

    function recordNextActionImpressions(items) {
      const payload = (items || []).map(nextActionEventItem).filter(Boolean);
      const fresh = [];
      for (const item of payload) {
        const signature = [item.sourceKind, item.key, item.aiGeneratedAt || ''].join('|');
        if (state.nextActionSeen[signature]) continue;
        state.nextActionSeen[signature] = true;
        fresh.push(item);
      }
      if (fresh.length > 0) {
        post('nextActionImpressions', { items: fresh });
      }
    }

    function nextActionPanel(options) {
      const section = div('next-action-panel ' + (options.className || ''));
      if (!options.items || options.items.length === 0) {
        section.appendChild(nextActionEmpty(options.emptyTitle, options.emptyReason));
        return section;
      }
      section.appendChild(nextActionCard(options.items[0], true));
      if (options.items.length > 1) {
        const list = div('next-action-secondary');
        for (const item of options.items.slice(1)) {
          list.appendChild(nextActionCard(item, false));
        }
        section.appendChild(list);
      }
      return section;
    }

    function nextActionAiPanel(data, recommendations) {
      const section = div('next-action-panel ai');
      section.appendChild(nextActionAiQuestionForm(data && data.ai ? data.ai : {}));
      const coachNote = nextActionCoachNote(data);
      if (coachNote) section.appendChild(coachNote);
      if (!recommendations || recommendations.length === 0) {
        section.appendChild(nextActionEmpty('还没有 AI 建议', '输入你的问题，例如“帮我拆一下不想开始的任务”或“我现在应该先做什么”。'));
        return section;
      }
      section.appendChild(nextActionCard(recommendations[0], true));
      if (recommendations.length > 1) {
        const list = div('next-action-secondary');
        for (const item of recommendations.slice(1)) {
          list.appendChild(nextActionCard(item, false));
        }
        section.appendChild(list);
      }
      return section;
    }

    function nextActionAiQuestionForm(ai) {
      const form = document.createElement('form');
      form.className = 'next-action-ai-form';
      const input = document.createElement('input');
      input.type = 'text';
      input.value = state.nextActionQuestion || ai.question || '';
      input.placeholder = '问 AI：现在先做什么 / 帮我拆小任务';
      input.addEventListener('input', () => {
        state.nextActionQuestion = input.value;
      });
      const label = state.nextActionAiLoading ? '思考中...' : '提问';
      const trigger = button(label, () => requestNextActionAi(input.value), true);
      trigger.className = 'next-action-ai-button';
      trigger.disabled = state.nextActionAiLoading;
      trigger.title = ai.reason ? '上次 AI 理由：' + ai.reason : '让 DeepSeek 根据当前知识库和任务回答';
      form.addEventListener('submit', (event) => {
        event.preventDefault();
        requestNextActionAi(input.value);
      });
      form.append(input, trigger);
      return form;
    }

    function requestNextActionAi(question) {
      if (state.nextActionAiLoading) return;
      state.nextActionQuestion = String(question || '').trim();
      state.nextActionTab = 'ai';
      state.nextActionAiLoading = true;
      render();
      post('nextActionAiRecommend', { question: state.nextActionQuestion });
    }

    function nextActionEmpty(title, reason) {
      const emptyState = div('next-action-empty');
      emptyState.append(
        div('next-action-title', title),
        div('next-action-reason', reason)
      );
      const actions = div('next-action-actions');
      actions.append(
        button('查看待办', () => runSearchFromCommand('@todo'), true),
        button('快速记录', () => post('openInbox'), true)
      );
      emptyState.appendChild(actions);
      return emptyState;
    }

    function nextActionCoachNote(data) {
      const ai = data && data.ai ? data.ai : {};
      const question = ai.question ? '问：' + ai.question : '';
      const text = [question, ai.summary, ai.encouragement].filter(Boolean).join(' · ');
      return text ? div('next-action-coach-note', text) : undefined;
    }

    function nextActionCard(item, primary) {
      const card = div(['next-action-card', primary ? 'primary' : '', item.type || 'plan', item.sourceType || '', item.ai ? 'ai' : ''].filter(Boolean).join(' '));
      const head = div('next-action-head');
      const title = div('next-action-title', item.title || '下一步行动');
      title.title = item.title || '';
      const badgeText = (item.ai ? 'AI · ' : '') + formatNextActionType(item.type, item.sourceType) + ' · ' + String(Math.max(0, Math.round(item.score || 0)));
      head.append(title, div('next-action-badge', badgeText));
      const reason = div('next-action-reason', item.reason || '根据当前上下文推荐。');
      if (item.aiReason) reason.title = 'AI 整体理由：' + item.aiReason;
      card.append(head, reason, nextActionButtons(item));
      return card;
    }

    function nextActionButtons(item) {
      const actions = div('next-action-actions');
      for (const action of item.actions || []) {
        actions.appendChild(nextActionButton(item, action));
      }
      const pin = button(item.pinned ? '取消置顶' : '置顶', () => {
        post('pinNextAction', { key: item.key, pinned: !item.pinned, item: nextActionEventItem(item) });
      }, true);
      pin.title = item.pinned ? '取消置顶这条推荐' : '置顶这条推荐';
      actions.appendChild(pin);
      if (!(item.actions || []).some((action) => action.type === 'dismiss')) {
        actions.appendChild(nextActionButton(item, { type: 'dismiss', label: '忽略' }));
      }
      return actions;
    }

    function nextActionButton(item, action) {
      const pending = Boolean(state.nextActionPending[nextActionActionKey(item, action)]);
      const control = button(pending ? '处理中...' : (action.label || formatNextActionButton(action.type)), () => handleNextAction(item, action), action.type !== 'startFocus');
      control.disabled = pending;
      control.title = action.query ? '搜索：' + action.query : '';
      return control;
    }

    function handleNextAction(item, action) {
      const actionKey = nextActionActionKey(item, action);
      if (state.nextActionPending[actionKey]) return;
      state.nextActionPending[actionKey] = true;
      state.nextActionNotice = '正在执行：' + (action.label || formatNextActionButton(action.type));
      render();
      const nextAction = {
        item: nextActionEventItem(item),
        action: nextActionEventAction(action)
      };
      if (action.type === 'startFocus') {
        post('focusTimerStart', {
          sessionType: 'focus',
          nextAction,
          task: {
            quadrantId: action.quadrantId || item.source && item.source.quadrantId,
            taskId: action.taskId || item.source && item.source.taskId
          }
        });
        return;
      }
      if (action.type === 'startBreak') {
        post('focusTimerStart', { sessionType: action.sessionType || 'shortBreak', nextAction });
        return;
      }
      if (action.type === 'completeTask') {
        post('toggleQuadrantTask', {
          quadrantId: action.quadrantId || item.source && item.source.quadrantId,
          taskId: action.taskId || item.source && item.source.taskId,
          done: true,
          nextAction
        });
        return;
      }
      if (action.type === 'search') {
        post('nextActionAdoption', nextAction);
        runSearchFromCommand(action.query || item.title || '');
        state.nextActionNotice = '已搜索：' + (action.query || item.title || '');
        delete state.nextActionPending[actionKey];
        render();
        return;
      }
      if (action.type === 'createTask') {
        post('addQuadrantTask', {
          quadrantId: action.quadrantId || 'importantNotUrgent',
          text: action.title || item.title || 'AI 建议事项',
          source: 'next-action-ai',
          reason: item.reason || 'AI 做什么推荐生成',
          nextAction
        });
        return;
      }
      if (action.type === 'dismiss') {
        post('dismissNextAction', { key: item.key, reason: 'not-now', item: nextActionEventItem(item) });
        return;
      }
      post('nextActionAdoption', nextAction);
      state.nextActionNotice = '暂不支持这个动作：' + (action.type || '未知');
      delete state.nextActionPending[actionKey];
      render();
    }

    function nextActionActionKey(item, action) {
      return [item && item.key || '', action && action.type || '', action && action.label || ''].join('|');
    }

    function nextActionEventItem(item) {
      if (!item || !item.key) return undefined;
      return {
        key: item.key,
        sourceKind: item.ai ? 'ai' : 'system',
        ai: Boolean(item.ai),
        type: item.type || '',
        title: item.title || '',
        score: item.score || 0,
        aiGeneratedAt: item.aiGeneratedAt || ''
      };
    }

    function nextActionEventAction(action) {
      return {
        type: action && action.type || '',
        label: action && action.label || ''
      };
    }

    function formatNextActionType(type, sourceType) {
      if (sourceType === 'microtask') return '小任务';
      if (sourceType === 'insight') return '洞察';
      if (sourceType === 'encouragement') return '鼓励';
      if (sourceType === 'idea') return '想法';
      return {
        'do-now': '现在做',
        plan: '安排',
        review: '整理',
        break: '休息'
      }[type] || '推荐';
    }

    function formatNextActionButton(type) {
      return {
        startFocus: '开始番茄',
        startBreak: '短休息',
        completeTask: '完成',
        createTask: '加入待办',
        search: '查上下文',
        dismiss: '忽略'
      }[type] || '执行';
    }

    function renderItemList(container, items, emptyText, block, allowFavorite) {
      const list = div('list');
      const data = (items || []).slice(0, getLimit(block, 8));
      if (data.length === 0) list.appendChild(empty(emptyText));
      const favoritePaths = getFavoritePaths();
      for (const item of data) list.appendChild(itemRow(item, allowFavorite && favoritePaths.has(item.filePath)));
      container.appendChild(list);
    }

    function renderPromptList(container, block) {
      const list = div('list');
      const prompts = (state.model.data.prompts || []).slice(0, getLimit(block, 12));
      if (prompts.length === 0) list.appendChild(empty('还没有配置 Prompt 模板。'));
      for (const prompt of prompts) {
        const row = itemRow(prompt, false);
        const copy = actionButton('复制', 'copyPrompt', true);
        copy.dataset.filePath = prompt.filePath;
        row.querySelector('.item-actions').prepend(copy);
        list.appendChild(row);
      }
      container.appendChild(list);
    }

    function renderFourQuadrants(container, block) {
      if (!state.designMode) {
        container.appendChild(quadrantAiForm());
      }
      const grid = div('quadrant-grid');
      const quadrants = state.model.data.quadrants || [];
      const limit = getLimit(block, 4);
      for (const quadrant of quadrants) {
        const card = div('quadrant ' + quadrant.id);
        const head = div('quadrant-head');
        const allItems = quadrant.items || [];
        const completedItems = allItems.filter((task) => task.done);
        const activeItems = allItems.filter((task) => !task.done);
        const showCompleted = Boolean(state.completedQuadrants[quadrant.id]);
        const titleWrap = div('quadrant-title-wrap');
        titleWrap.appendChild(div('quadrant-title', quadrant.title));
        if (!state.designMode && (completedItems.length > 0 || showCompleted)) {
          const toggle = button('已完成 ' + String(completedItems.length), () => {
            state.completedQuadrants[quadrant.id] = !showCompleted;
            render();
          }, true);
          toggle.className = showCompleted ? 'completed-toggle active' : 'completed-toggle';
          toggle.title = showCompleted ? '隐藏已完成事项' : '展示已完成事项';
          titleWrap.appendChild(toggle);
        }
        head.append(titleWrap, div('count', String(activeItems.length) + (completedItems.length ? '/' + String(allItems.length) : '')));
        card.appendChild(head);
        const list = div('task-list');
        const visibleItems = showCompleted ? completedItems : activeItems;
        const tasks = visibleItems.slice(0, limit);
        if (tasks.length === 0) {
          list.appendChild(div('muted', showCompleted ? '暂无已完成事项' : '暂无未完成事项'));
        }
        for (const task of tasks) {
          list.appendChild(state.designMode ? readonlyQuadrantTask(task) : editableQuadrantTask(quadrant.id, task));
        }
        if (visibleItems.length > tasks.length) {
          list.appendChild(div('muted', '+' + String(visibleItems.length - tasks.length) + ' 项'));
        }
        card.appendChild(list);
        if (!state.designMode) {
          card.appendChild(quadrantAddForm(quadrant.id));
        }
        grid.appendChild(card);
      }
      container.appendChild(grid);
    }

    function readonlyQuadrantTask(task) {
      const row = div(task.done ? 'task-readonly done' : 'task-readonly');
      if (task.reason) row.title = 'AI 归类理由：' + task.reason;
      row.append(div('task-dot'), div('task-text', task.dueDate ? task.text + ' · ' + task.dueDate : task.text));
      return row;
    }

    function editableQuadrantTask(quadrantId, task) {
      const row = div(task.done ? 'task done' : 'task');
      const check = button(task.done ? '✓' : '', () => {
        post('toggleQuadrantTask', { quadrantId, taskId: task.id, done: !task.done });
      }, true);
      check.className = 'task-check';
      check.title = task.done ? '标记为未完成' : '标记为完成';

      const input = document.createElement('input');
      input.className = 'task-input';
      input.value = task.text;
      input.title = task.reason ? 'AI 归类理由：' + task.reason : '修改事项内容';
      input.addEventListener('change', () => {
        const text = input.value.trim();
        if (text && text !== task.text) {
          post('updateQuadrantTask', { quadrantId, taskId: task.id, text });
        } else {
          input.value = task.text;
        }
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') input.blur();
      });

      const date = datePicker(task.dueDate || '', (dueDate) => {
        post('updateQuadrantTask', { quadrantId, taskId: task.id, dueDate });
      }, '截止日');

      const remove = button('×', () => {
        post('deleteQuadrantTask', { quadrantId, taskId: task.id });
      }, true);
      remove.className = 'task-delete';
      remove.title = '删除事项';
      row.append(check, input, date, remove);
      return row;
    }

    function quadrantAiForm() {
      const wrap = div('quadrant-ai');
      const input = document.createElement('input');
      input.placeholder = '输入事项，AI 自动判断重要/紧急';
      const dueDate = inlineDateField();
      const add = button('AI 归类', commit, false);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
      });
      wrap.append(input, dueDate, add);
      return wrap;

      function commit() {
        const text = input.value.trim();
        if (!text) return;
        post('aiAddQuadrantTask', { text, dueDate: dueDate.getValue() });
        input.value = '';
        dueDate.clearValue();
      }
    }

    function quadrantAddForm(quadrantId) {
      const wrap = div('quadrant-add');
      if (state.activeQuadrantAdd !== quadrantId) {
        const triggerRow = div('quadrant-add-trigger-row');
        const trigger = button('+', () => {
          state.activeQuadrantAdd = quadrantId;
          render();
          requestAnimationFrame(() => {
            const input = document.querySelector('[data-quadrant-add-input="' + quadrantId + '"]');
            if (input) input.focus();
          });
        }, true);
        trigger.className = 'quadrant-add-trigger';
        trigger.title = '添加事项';
        trigger.setAttribute('aria-label', '添加事项');
        triggerRow.appendChild(trigger);
        wrap.appendChild(triggerRow);
        return wrap;
      }

      const form = div('quadrant-add-form');
      const input = document.createElement('input');
      input.placeholder = '添加事项';
      input.dataset.quadrantAddInput = quadrantId;
      const dueDate = inlineDateField();
      const add = button('添加', commit, false);
      const cancel = button('取消', () => {
        state.activeQuadrantAdd = '';
        render();
      }, true);
      cancel.title = '收起添加事项';
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          state.activeQuadrantAdd = '';
          render();
        }
      });
      form.append(input, dueDate, add, cancel);
      wrap.appendChild(form);
      return wrap;

      function commit() {
        const text = input.value.trim();
        if (!text) return;
        state.activeQuadrantAdd = '';
        post('addQuadrantTask', { quadrantId, text, dueDate: dueDate.getValue() });
        input.value = '';
        dueDate.clearValue();
        render();
      }
    }

    function inlineDateField(initialValue) {
      const wrap = div('inline-date');
      const input = document.createElement('input');
      input.type = 'date';
      input.value = normalizeDateValue(initialValue);
      input.title = '截止日期';
      const actions = div('inline-date-actions');
      const options = [
        ['今', 0],
        ['明', 1],
        ['+3', 3],
        ['+7', 7]
      ];
      for (const option of options) {
        const item = button(option[0], () => {
          input.value = toDateKey(addDays(startOfDay(new Date()), option[1]));
        }, true);
        item.title = option[0] === '今' ? '今天' : option[0] === '明' ? '明天' : option[1] + ' 天后';
        actions.appendChild(item);
      }
      const clear = button('清', () => {
        input.value = '';
      }, true);
      clear.title = '清空截止日期';
      actions.appendChild(clear);
      wrap.append(input, actions);
      wrap.getValue = () => normalizeDateValue(input.value);
      wrap.clearValue = () => { input.value = ''; };
      return wrap;
    }

    function datePicker(initialValue, onChange, placeholder) {
      const wrap = div(initialValue ? 'date-picker' : 'date-picker empty-date');
      let value = normalizeDateValue(initialValue);
      const trigger = button(formatDueDate(value, placeholder), () => {
        wrap.classList.toggle('open');
      }, true);
      trigger.className = 'date-pill';
      trigger.title = '选择截止日期';

      const popover = div('date-popover');
      const quick = div('date-quick');
      for (const option of [
        ['今天', 0],
        ['明天', 1],
        ['3 天内', 3],
        ['下周', 7]
      ]) {
        const chip = button(option[0], () => setValue(toDateKey(addDays(startOfDay(new Date()), option[1])), true), true);
        chip.className = 'date-chip';
        quick.appendChild(chip);
      }

      const customWrap = div('date-custom');
      const custom = document.createElement('input');
      custom.type = 'date';
      custom.value = value;
      custom.addEventListener('change', () => setValue(custom.value, true));
      const clear = button('清空', () => setValue('', true), true);
      clear.className = 'date-clear';
      customWrap.append(custom, clear);
      popover.append(quick, customWrap);
      wrap.append(trigger, popover);

      wrap.getValue = () => value;
      wrap.clearValue = () => setValue('', false);
      return wrap;

      function setValue(nextValue, shouldNotify) {
        value = normalizeDateValue(nextValue);
        custom.value = value;
        trigger.textContent = formatDueDate(value, placeholder);
        trigger.title = value ? '截止日期：' + value : '选择截止日期';
        wrap.classList.toggle('empty-date', !value);
        wrap.classList.remove('open');
        if (shouldNotify && onChange) onChange(value);
      }
    }

    function renderWeekCalendar(container) {
      const today = startOfDay(new Date());
      const weekStart = addDays(startOfWeek(today), state.calendarWeekOffset * 7);
      const itemsByDate = groupCalendarItemsByDate(getMonthCalendarItems());
      const weekDates = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
      const weekItems = weekDates.reduce((result, date) => result.concat(itemsByDate[toDateKey(date)] || []), []);
      const wrap = div('stack');
      wrap.append(weekToolbar(weekStart), weekSummary(weekItems));
      const grid = div('calendar-week');
      for (const date of weekDates) {
        const key = toDateKey(date);
        const items = itemsByDate[key] || [];
        const day = div([
          'calendar-day',
          isSameDate(date, today) ? 'today' : '',
          state.selectedCalendarDate === key ? 'selected' : '',
          items.some((item) => item.overdue) ? 'overdue' : ''
        ].filter(Boolean).join(' '));
        const head = div('day-head');
        head.append(div('day-name', weekdayName(date)), div('day-date', String(date.getDate()) + (items.length ? ' · ' + String(items.length) : '')));
        day.appendChild(head);
        appendWeekItems(day, items, 4);
        if (!state.designMode) {
          day.addEventListener('click', () => {
            state.selectedCalendarDate = state.selectedCalendarDate === key ? '' : key;
            render();
          });
        }
        grid.appendChild(day);
      }
      wrap.appendChild(grid);
      if (!state.designMode && state.selectedCalendarDate) {
        wrap.appendChild(monthDetailPanel(state.selectedCalendarDate, itemsByDate[state.selectedCalendarDate] || []));
      }
      container.appendChild(wrap);
    }

    function weekToolbar(weekStart) {
      const weekEnd = addDays(weekStart, 6);
      const toolbar = div('week-toolbar');
      toolbar.appendChild(div('week-title', formatShortDate(weekStart) + ' - ' + formatShortDate(weekEnd)));
      if (!state.designMode) {
        const nav = div('week-nav');
        const prev = button('‹', () => {
          state.calendarWeekOffset -= 1;
          render();
        }, true);
        prev.title = '上周';
        const current = button('今', () => {
          state.calendarWeekOffset = 0;
          state.selectedCalendarDate = toDateKey(startOfDay(new Date()));
          render();
        }, true);
        current.title = '回到本周';
        const next = button('›', () => {
          state.calendarWeekOffset += 1;
          render();
        }, true);
        next.title = '下周';
        nav.append(prev, current, next);
        toolbar.appendChild(nav);
      }
      return toolbar;
    }

    function weekSummary(items) {
      const activeTasks = items.filter((item) => item.type === 'task' && !item.done);
      const overdue = getMonthCalendarItems().filter((item) => item.type === 'task' && item.overdue);
      const events = items.filter((item) => item.type === 'event');
      const summary = div('week-summary');
      summary.append(
        spanText('本周事项 ' + String(activeTasks.length)),
        spanText('过期 ' + String(overdue.length)),
        spanText('事件 ' + String(events.length))
      );
      return summary;
    }

    function appendWeekItems(container, items, limit) {
      const list = div('week-items');
      const visible = items.slice(0, limit);
      if (visible.length === 0) {
        list.appendChild(div('muted', '暂无安排'));
      }
      for (const item of visible) {
        const pill = div(item.className, item.title);
        pill.title = item.title;
        list.appendChild(pill);
      }
      if (items.length > visible.length) {
        list.appendChild(div('muted', '+' + String(items.length - visible.length) + ' 项'));
      }
      container.appendChild(list);
    }

    function renderMonthCalendar(container) {
      const today = startOfDay(new Date());
      const visibleMonth = new Date(today.getFullYear(), today.getMonth() + state.calendarMonthOffset, 1);
      const itemsByDate = groupCalendarItemsByDate(getMonthCalendarItems());
      const monthStart = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
      const gridStart = startOfWeek(monthStart);
      const monthItems = getVisibleMonthItems(itemsByDate, visibleMonth);
      const wrap = div('stack');
      wrap.append(monthToolbar(visibleMonth), monthSummary(monthItems));
      const grid = div('month-calendar');
      for (const name of ['一', '二', '三', '四', '五', '六', '日']) {
        grid.appendChild(div('month-weekday', name));
      }
      for (let index = 0; index < 42; index += 1) {
        const date = addDays(gridStart, index);
        const key = toDateKey(date);
        const items = itemsByDate[key] || [];
        const className = [
          'month-cell',
          date.getMonth() === visibleMonth.getMonth() ? '' : 'outside',
          isSameDate(date, today) ? 'today' : '',
          items.length > 0 ? 'has-events' : '',
          items.some((item) => item.overdue) ? 'overdue' : '',
          state.selectedCalendarDate === key ? 'selected' : ''
        ].filter(Boolean).join(' ');
        const cell = div(className);
        cell.appendChild(div('month-date', String(date.getDate())));
        if (items.length > 0) {
          cell.title = items.map((item) => item.title).join('\\n');
          appendMonthItems(cell, items, 2);
        }
        if (!state.designMode) {
          cell.addEventListener('click', () => {
            state.selectedCalendarDate = state.selectedCalendarDate === key ? '' : key;
            render();
          });
        }
        grid.appendChild(cell);
      }
      wrap.appendChild(grid);
      if (!state.designMode && state.selectedCalendarDate) {
        wrap.appendChild(monthDetailPanel(state.selectedCalendarDate, itemsByDate[state.selectedCalendarDate] || []));
      }
      container.appendChild(wrap);
    }

    function monthToolbar(visibleMonth) {
      const toolbar = div('month-toolbar');
      toolbar.appendChild(div('month-title', String(visibleMonth.getFullYear()) + ' 年 ' + String(visibleMonth.getMonth() + 1) + ' 月'));
      if (!state.designMode) {
        const nav = div('month-nav');
        const prev = button('‹', () => {
          state.calendarMonthOffset -= 1;
          render();
        }, true);
        prev.title = '上月';
        const today = button('今', () => {
          state.calendarMonthOffset = 0;
          state.selectedCalendarDate = toDateKey(startOfDay(new Date()));
          render();
        }, true);
        today.title = '回到今天';
        const next = button('›', () => {
          state.calendarMonthOffset += 1;
          render();
        }, true);
        next.title = '下月';
        nav.append(prev, today, next);
        toolbar.appendChild(nav);
      }
      return toolbar;
    }

    function monthSummary(items) {
      const activeTasks = items.filter((item) => item.type === 'task' && !item.done);
      const overdue = activeTasks.filter((item) => item.overdue);
      const events = items.filter((item) => item.type === 'event');
      const summary = div('month-summary');
      summary.append(
        spanText('事项 ' + String(activeTasks.length)),
        spanText('过期 ' + String(overdue.length)),
        spanText('事件 ' + String(events.length))
      );
      return summary;
    }

    function appendMonthItems(container, items, limit) {
      const list = div('month-items');
      const visible = items.slice(0, limit);
      for (const item of visible) {
        const pill = div(item.className, item.title);
        pill.title = item.title;
        list.appendChild(pill);
      }
      if (items.length > visible.length) {
        list.appendChild(div('muted', '+' + String(items.length - visible.length)));
      }
      container.appendChild(list);
    }

    function monthDetailPanel(dateKey, items) {
      const panel = div('month-add-panel');
      const head = div('month-detail-head');
      head.appendChild(div('month-add-title', formatFullDate(dateKey)));
      const close = button('×', () => {
        state.selectedCalendarDate = '';
        render();
      }, true);
      close.title = '收起日期详情';
      head.appendChild(close);
      panel.appendChild(head);
      panel.appendChild(monthDetailList(items));
      const form = div('month-add-form');
      const input = document.createElement('input');
      input.placeholder = '事项内容';
      const quadrantSelect = document.createElement('select');
      const defaultQuadrant = getDefaultQuadrantForDate(dateKey);
      for (const quadrant of state.model.data.quadrants || []) {
        const option = document.createElement('option');
        option.value = quadrant.id;
        option.textContent = quadrant.title;
        option.selected = quadrant.id === defaultQuadrant;
        quadrantSelect.appendChild(option);
      }
      const add = button('添加', commit, false);
      const aiAdd = button('AI', commitWithAi, true);
      aiAdd.title = 'AI 自动归类并添加到当天';
      const clear = button('清空', () => {
        input.value = '';
        input.focus();
      }, true);
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') commit();
        if (event.key === 'Escape') {
          input.value = '';
        }
      });
      form.append(input, quadrantSelect, add, aiAdd, clear);
      panel.appendChild(form);
      requestAnimationFrame(() => input.focus());
      return panel;

      function commit() {
        const text = input.value.trim();
        const quadrantId = quadrantSelect.value || defaultQuadrant;
        if (!text || !quadrantId) return;
        state.selectedCalendarDate = '';
        post('addQuadrantTask', { quadrantId, text, dueDate: dateKey });
        render();
      }

      function commitWithAi() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        post('aiAddQuadrantTask', { text, dueDate: dateKey });
        render();
      }
    }

    function monthDetailList(items) {
      const list = div('month-detail-list');
      if (!items || items.length === 0) {
        list.appendChild(div('muted', '当天暂无事项或事件'));
        return list;
      }
      for (const item of items) {
        list.appendChild(monthDetailItem(item));
      }
      return list;
    }

    function monthDetailItem(item) {
      const row = div(['month-detail-item', item.done ? 'done' : '', item.overdue ? 'overdue' : ''].filter(Boolean).join(' '));
      if (item.type === 'task') {
        const check = button(item.done ? '✓' : '', () => {
          post('toggleQuadrantTask', { quadrantId: item.quadrantId, taskId: item.taskId, done: !item.done });
        }, true);
        check.className = 'month-detail-check';
        check.title = item.done ? '标记为未完成' : '标记为完成';
        row.append(check, monthDetailMain(item));
        return row;
      }
      row.append(div('task-dot'), monthDetailMain(item));
      return row;
    }

    function monthDetailMain(item) {
      const main = div('month-detail-main');
      main.append(div('month-detail-title', item.title), div('month-detail-meta', item.meta || ''));
      return main;
    }

    function renderStats(container) {
      const stats = state.model.data.stats || {};
      const stack = div('stack');
      stack.append(
        statsSection('任务', [
          statItem('待办', stats.openTasks || 0, '@todo', stats.overdueTasks ? 'danger' : '', '未完成事项'),
          statItem('已完成', stats.doneTasks || 0, '@done', '', '已完成事项'),
          statItem('完成率', String(stats.completionRate || 0) + '%', '', '', '四象限事项完成率'),
          statItem('过期', stats.overdueTasks || 0, '@todo before:today', stats.overdueTasks ? 'danger' : '', '过期未完成事项'),
          statItem('无日期', stats.undatedTasks || 0, '@todo', stats.undatedTasks ? 'warn' : '', '没有截止日期的待办')
        ]),
        statsSection('日历', [
          statItem('今日', stats.todayTasks || 0, '@today', '', '今日事项'),
          statItem('本周', stats.weekTasks || 0, '@week', '', '本周事项'),
          statItem('本周事件', stats.weekEvents || 0, '@calendar @week', '', '本周日历事件'),
          statItem('本月天数', stats.monthScheduledDays || 0, '@month', '', '本月有安排的天数')
        ]),
        statsSection('专注', [
          statItem('今日番茄', stats.todayFocusSessions || 0, '', '', '今日完成的专注轮数；今日记录 ' + String(stats.todayFocusRecords || 0) + ' 条'),
          statItem('今日专注', formatCompactDuration(stats.todayFocusMs || 0), '', '', '今日所有番茄记录累计专注时间，包含手动终止记录'),
          statItem('本周专注', formatCompactDuration(stats.weekFocusMs || 0), '', '', '本周番茄记录累计专注时间，共 ' + String(stats.weekFocusRecords || 0) + ' 条记录'),
          statItem('记录', stats.focusRecords || 0, '', '', '番茄专注记录总数，累计 ' + formatCompactDuration(stats.totalFocusMs || 0)),
          statItem('完成/终止', String(stats.completedFocusRecords || 0) + '/' + String(stats.abortedFocusRecords || 0), '', stats.abortedFocusRecords ? 'warn' : '', '完成记录 / 手动终止记录，完成率 ' + String(stats.focusCompletionRate || 0) + '%'),
          statItem('事项关联', String(stats.focusLinkedRate || 0) + '%', '', stats.focusRecords && stats.focusLinkedRate < 60 ? 'warn' : '', '已关联事项的番茄记录：' + String(stats.linkedFocusRecords || 0) + '/' + String(stats.focusRecords || 0))
        ]),
        statsSection('推荐', [
          statItem('曝光', stats.nextActionImpressions || 0, '', '', '做什么组件展示过的推荐数'),
          statItem('采纳', stats.nextActionAdopted || 0, '', '', '点击开始番茄、完成、查上下文、加入待办等推荐动作的次数'),
          statItem('采纳率', String(stats.nextActionAdoptionRate || 0) + '%', '', '', '采纳次数 / 推荐曝光次数'),
          statItem('准确率', String(stats.nextActionAccuracyRate || 0) + '%', '', stats.nextActionAccuracyRate && stats.nextActionAccuracyRate < 50 ? 'warn' : '', '采纳次数 / 有明确反馈次数（采纳 + 忽略）'),
          statItem('AI/系统', String(stats.nextActionAiAdopted || 0) + '/' + String(stats.nextActionSystemAdopted || 0), '', '', 'AI 建议采纳数 / 系统推荐采纳数')
        ]),
        statsSection('知识库', [
          statItem('知识文件', stats.totalItems || 0, '@docs', '', '索引到的知识文件'),
          statItem('Prompt', stats.prompts || 0, '@prompt', '', 'Prompt 模板'),
          statItem('收藏', stats.favorites || 0, '@favorite', '', '收藏文件'),
          statItem('知识源', String(stats.activeSources || 0) + '/' + String(stats.sources || 0), '', stats.sourceErrors ? 'danger' : '', '知识源状态'),
          statItem('最近更新', stats.latestUpdatedAt ? formatShortDate(new Date(stats.latestUpdatedAt)) : '-', '', '', '最近索引文件更新时间')
        ]),
        statsSection('搜索/健康', [
          statItem('搜索历史', stats.searchHistory || 0, '', '', '已保存搜索历史'),
          statItem('AI 搜索', stats.aiSearches || 0, '', '', 'AI 搜索历史数'),
          statItem('健康', getStatsRiskCount(stats), getStatsRiskQuery(stats), getStatsRiskCount(stats) ? 'warn' : '', getStatsHealthText(stats))
        ])
      );
      container.appendChild(stack);
    }

    function statsSection(title, items) {
      const section = div('stats-section');
      section.appendChild(div('stats-section-title', title));
      const grid = div('stats-grid');
      for (const item of items) {
        grid.appendChild(item);
      }
      section.appendChild(grid);
      return section;
    }

    function statItem(label, value, query, tone, title) {
      const card = query ? actionButton('', 'runSearch', true) : div('stat');
      card.className = ['stat', tone || ''].filter(Boolean).join(' ');
      if (query) {
        card.dataset.query = query;
      }
      card.title = [title || '', query ? '搜索：' + query : ''].filter(Boolean).join('\\n');
      card.append(div('stat-value', String(value)), div('stat-label', label));
      return card;
    }

    function getStatsRiskCount(stats) {
      return (stats.sourceErrors || 0) + (stats.truncatedSources || 0) + (stats.overdueTasks || 0) + (stats.undatedTasks || 0);
    }

    function getStatsRiskQuery(stats) {
      if (stats.overdueTasks) return '@todo before:today';
      if (stats.undatedTasks) return '@todo';
      return '';
    }

    function getStatsHealthText(stats) {
      const notes = [];
      if (stats.sourceErrors) notes.push(String(stats.sourceErrors) + ' 个知识源报错');
      if (stats.truncatedSources) notes.push(String(stats.truncatedSources) + ' 个知识源被截断');
      if (stats.overdueTasks) notes.push(String(stats.overdueTasks) + ' 个事项已过期');
      if (stats.undatedTasks) notes.push(String(stats.undatedTasks) + ' 个待办没有日期');
      return notes.length ? notes.join(' · ') : '状态正常';
    }

    function appendEvents(container, events, limit) {
      const list = div('event-list');
      const visible = events.slice(0, limit);
      if (visible.length === 0) {
        list.appendChild(div('muted', '暂无安排'));
      }
      for (const event of visible) {
        const time = event.start ? event.start + ' ' : '';
        const pill = div('event-pill', time + event.title);
        pill.title = event.title;
        list.appendChild(pill);
      }
      if (events.length > visible.length) {
        list.appendChild(div('muted', '+' + String(events.length - visible.length) + ' 项'));
      }
      container.appendChild(list);
    }

    function itemRow(item, isFavorite) {
      const row = div('item');
      const main = div('item-main');
      const title = div('item-title', item.title || item.fileName);
      title.title = item.filePath;
      const meta = div('item-meta', item.sourceName + ' · ' + (item.relativePath || item.fileName));
      main.append(title, meta);
      const actions = div('item-actions');
      const open = actionButton('打开', 'open');
      open.dataset.filePath = item.filePath;
      const favorite = actionButton(isFavorite ? '取消' : '收藏', 'favorite', true);
      favorite.title = isFavorite ? '取消收藏' : '加入收藏';
      favorite.dataset.filePath = item.filePath;
      actions.append(open, favorite);
      row.append(main, actions);
      return row;
    }

    function renderDesignToolbar() {
      els.designToolbar.textContent = '';
      if (!state.designMode) return;
      const definitions = state.model.components || [];
      if (definitions.length === 0) {
        els.designToolbar.appendChild(div('muted', '暂无可添加组件'));
        return;
      }
      const selectedType = definitions.some((definition) => definition.type === state.selectedComponentType)
        ? state.selectedComponentType
        : definitions[0].type;
      state.selectedComponentType = selectedType;

      const componentGroup = div('toolbar-group');
      const selector = document.createElement('select');
      selector.className = 'toolbar-select';
      selector.title = '选择要添加的组件';
      for (const definition of state.model.components || []) {
        const option = document.createElement('option');
        option.value = definition.type;
        option.textContent = definition.title + ' · ' + definition.type;
        selector.appendChild(option);
      }
      selector.value = selectedType;
      selector.addEventListener('change', () => {
        state.selectedComponentType = selector.value;
      });
      const add = button('添加组件', () => {
        state.selectedComponentType = selector.value;
        addComponent(selector.value);
      }, false);
      add.title = '添加到画布空白位置';
      componentGroup.append(selector, add);

      const save = button('保存主页', () => {
        ensureLayoutCanSave();
        post('saveLayout', { layout: state.draftLayout });
      }, false);
      save.className = 'save-button';
      save.title = '保存当前主页布局';

      const exit = button('退出编辑', () => {
        setDesignMode(false);
      }, true);
      exit.title = '退出主页编辑状态';

      els.designToolbar.append(componentGroup, div('toolbar-divider'), save, exit);
    }

    function renderDesignerPanel() {
      els.designerPanel.textContent = '';
      if (!state.designMode) return;
      if (state.layoutNotice) {
        els.designerPanel.appendChild(div('design-notice', state.layoutNotice));
      }
      const selected = getSelectedBlock();
      if (selected) {
        els.designerPanel.appendChild(renderSelectedEditor(selected));
      } else {
        els.designerPanel.appendChild(empty('请选择画布上的组件，或用顶部工具栏添加组件。'));
      }
    }

    function renderSelectedEditor(block) {
      const stack = div('property-stack');
      stack.append(
        renderComponentPropertySection(block),
        renderLayoutPropertySection(block),
        renderActionPropertySection()
      );
      return stack;
    }

    function renderComponentPropertySection(block) {
      const section = div('designer-section');
      const heading = document.createElement('h2');
      heading.className = 'designer-title';
      heading.textContent = '组件属性';
      const definition = getComponentDefinition(block.component);
      const fields = div('designer-fields');
      fields.append(
        componentTypeField(block),
        inputField('标题', block.title, 'text', (value) => updateSelectedBlock({ title: value || getComponentDefinition(block.component).title }))
      );
      if (componentUsesLimit(block.component)) {
        fields.appendChild(inputField('显示数量', getLimit(block, 8), 'number', (value) => updateSelectedOptions({ limit: clamp(value, 1, 50) }), 1, 50));
      }
      section.append(heading, div('designer-help', definition.description || '配置组件内容和展示方式。'), fields);
      return section;
    }

    function renderLayoutPropertySection(block) {
      const section = div('designer-section');
      const heading = document.createElement('h2');
      heading.className = 'designer-title';
      heading.textContent = '布局信息';
      const controls = div('layout-control-grid');
      const col = block.col || 1;
      const colSpan = block.colSpan || 12;
      controls.append(
        layoutNumberField('列', col, 1, 13 - colSpan, (value) => updateSelectedBlock({ col: clamp(value, 1, 13 - colSpan) })),
        layoutNumberField('行', block.row || 1, 1, 99, (value) => updateSelectedBlock({ row: clamp(value, 1, 99) })),
        layoutNumberField('宽', colSpan, 1, 13 - col, (value) => updateSelectedBlock({ colSpan: clamp(value, 1, 13 - col) })),
        layoutNumberField('高', block.rowSpan || 1, 1, 12, (value) => updateSelectedBlock({ rowSpan: clamp(value, 1, 12) }))
      );
      section.append(heading, renderLayoutPreview(block), div('layout-hint', formatLayoutHint(block)), controls);
      return section;
    }

    function renderActionPropertySection() {
      const section = div('designer-section');
      const heading = document.createElement('h2');
      heading.className = 'designer-title';
      heading.textContent = '操作';
      section.append(heading, actionsWrap([button('复制组件', duplicateSelectedBlock, true), button('删除组件', removeSelectedBlock, true)]));
      return section;
    }

    function componentTypeField(block) {
      const selector = document.createElement('select');
      for (const definition of state.model.components || []) {
        const option = document.createElement('option');
        option.value = definition.type;
        option.textContent = definition.title;
        selector.appendChild(option);
      }
      selector.value = block.component;
      selector.addEventListener('change', () => switchSelectedComponent(selector.value));
      return fieldWrap('组件类型', selector);
    }

    function componentUsesLimit(componentType) {
      return ['search', 'favorites', 'prompts', 'fourQuadrants', 'countdown', 'nextAction', 'knowledgeGraph'].includes(componentType);
    }

    function layoutNumberField(labelText, value, min, max, onChange) {
      const wrap = div('layout-mini-field');
      const label = document.createElement('label');
      label.textContent = labelText;
      const input = document.createElement('input');
      input.type = 'number';
      input.value = String(value ?? '');
      input.min = String(min);
      input.max = String(max);
      input.addEventListener('change', () => onChange(input.value));
      wrap.append(label, input);
      return wrap;
    }

    function renderLayoutPreview(block) {
      const preview = div('layout-preview');
      const row = block.row || 1;
      const rowSpan = block.rowSpan || 1;
      const previewStartRow = Math.max(1, Math.min(row, row + rowSpan - 6));
      const markerRow = clamp(row - previewStartRow + 1, 1, 6);
      const markerRowSpan = clamp(rowSpan, 1, 7 - markerRow);
      for (let index = 0; index < 72; index += 1) {
        preview.appendChild(div('layout-preview-cell'));
      }
      const marker = div('layout-preview-block');
      marker.style.gridColumn = String(block.col || 1) + ' / span ' + String(block.colSpan || 12);
      marker.style.gridRow = String(markerRow) + ' / span ' + String(markerRowSpan);
      preview.appendChild(marker);
      return preview;
    }

    function formatLayoutHint(block) {
      return '12 列网格 · 起点：第 ' + String(block.col || 1) + ' 列 / 第 ' + String(block.row || 1) + ' 行 · 占用：' + String(block.colSpan || 12) + ' 列 x ' + String(block.rowSpan || 1) + ' 行';
    }

    function setDesignMode(enabled) {
      state.designMode = enabled;
      if (enabled) {
        state.draftLayout = cloneLayout(state.model.layout || []);
        state.selectedBlockId = state.draftLayout[0] ? state.draftLayout[0].id : '';
        const definitions = state.model.components || [];
        if (!state.selectedComponentType && definitions[0]) state.selectedComponentType = definitions[0].type;
      } else {
        state.draftLayout = [];
        state.selectedBlockId = '';
        clearLayoutNotice();
      }
      render();
    }

    function getActiveLayout() { return state.designMode ? state.draftLayout : (state.model.layout || []); }
    function cloneLayout(layout) { return JSON.parse(JSON.stringify(layout || [])); }
    function getSelectedBlock() { return state.draftLayout.find((block) => block.id === state.selectedBlockId); }
    function getComponentDefinition(type) { return (state.model.components || []).find((item) => item.type === type) || { title: type, defaultColSpan: 4, defaultRowSpan: 2 }; }

    function updateSelectedBlock(patch) {
      const block = getSelectedBlock();
      if (!block) return;
      const result = applyBlockPatch(block, patch);
      render();
      markShiftedBlocks(result.movedIds);
    }

    function updateSelectedBlockLive(patch) {
      const block = getSelectedBlock();
      if (!block) return;
      const result = applyBlockPatch(block, patch);
      updateRenderedBlock(block);
      for (const blockId of result.movedIds) {
        const movedBlock = state.draftLayout.find((item) => item.id === blockId);
        if (movedBlock) updateRenderedBlock(movedBlock);
      }
      markShiftedBlocks(result.movedIds);
      renderDesignerPanel();
    }

    function updateSelectedOptions(patch) {
      const block = getSelectedBlock();
      if (!block) return;
      block.options = Object.assign({}, block.options || {}, patch);
      render();
    }

    function switchSelectedComponent(componentType) {
      const block = getSelectedBlock();
      if (!block || block.component === componentType) return;
      const currentDefinition = getComponentDefinition(block.component);
      const nextDefinition = getComponentDefinition(componentType);
      const hasCustomTitle = block.title && block.title !== currentDefinition.title;
      const patch = {
        component: componentType,
        title: hasCustomTitle ? block.title : nextDefinition.title
      };
      if ((block.colSpan || 12) === currentDefinition.defaultColSpan && (block.rowSpan || 1) === currentDefinition.defaultRowSpan) {
        patch.colSpan = clamp(nextDefinition.defaultColSpan || block.colSpan || 4, 1, 12);
        patch.rowSpan = clamp(nextDefinition.defaultRowSpan || block.rowSpan || 2, 1, 12);
      }
      const result = applyBlockPatch(block, patch);
      state.selectedComponentType = componentType;
      render();
      markShiftedBlocks(result.movedIds);
    }

    function addComponent(componentType) {
      const definition = getComponentDefinition(componentType);
      const block = {
        id: componentType + '-' + Date.now(),
        component: componentType,
        title: definition.title,
        col: 1,
        row: getNextRow(),
        colSpan: clamp(definition.defaultColSpan || 4, 1, 12),
        rowSpan: clamp(definition.defaultRowSpan || 2, 1, 12),
        options: {}
      };
      placeBlockInOpenSlot(block, 1, getNextRow());
      state.draftLayout.push(block);
      state.selectedBlockId = block.id;
      render();
    }

    function duplicateSelectedBlock() {
      const block = getSelectedBlock();
      if (!block) return;
      const copy = cloneLayout([block])[0];
      copy.id = block.component + '-' + Date.now();
      placeBlockInOpenSlot(copy, block.col || 1, (block.row || 1) + 1);
      state.draftLayout.push(copy);
      state.selectedBlockId = copy.id;
      render();
    }

    function removeSelectedBlock() {
      state.draftLayout = state.draftLayout.filter((block) => block.id !== state.selectedBlockId);
      state.selectedBlockId = state.draftLayout[0] ? state.draftLayout[0].id : '';
      render();
    }

    function getNextRow() {
      return (state.draftLayout || []).reduce((max, block) => Math.max(max, (block.row || 1) + (block.rowSpan || 1)), 1);
    }

    function startDrag(event, block) {
      event.preventDefault();
      state.selectedBlockId = block.id;
      const metrics = getGridMetrics();
      for (const element of document.querySelectorAll('.block.selected')) {
        element.classList.remove('selected');
      }
      event.currentTarget.classList.add('selected');
      state.drag = {
        mode: 'move',
        blockId: block.id,
        startX: event.clientX,
        startY: event.clientY,
        startCol: block.col || 1,
        startRow: block.row || 1,
        metrics
      };
      event.currentTarget.classList.add('dragging');
      event.currentTarget.setPointerCapture(event.pointerId);
      renderDesignerPanel();
    }

    function startResize(event, block) {
      event.preventDefault();
      event.stopPropagation();
      state.selectedBlockId = block.id;
      const blockElement = event.currentTarget.closest('.block');
      const metrics = getGridMetrics();
      for (const element of document.querySelectorAll('.block.selected')) {
        element.classList.remove('selected');
      }
      if (blockElement) {
        blockElement.classList.add('selected', 'resizing');
      }
      state.drag = {
        mode: 'resize',
        blockId: block.id,
        startX: event.clientX,
        startY: event.clientY,
        startColSpan: block.colSpan || 1,
        startRowSpan: block.rowSpan || 1,
        metrics
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      renderDesignerPanel();
    }

    function handlePointerMove(event) {
      if (!state.drag) return;
      const block = state.draftLayout.find((item) => item.id === state.drag.blockId);
      if (!block) return;
      const deltaCol = Math.round((event.clientX - state.drag.startX) / state.drag.metrics.columnWidth);
      const deltaRow = Math.round((event.clientY - state.drag.startY) / state.drag.metrics.rowHeight);
      if (state.drag.mode === 'resize') {
        const maxColSpan = 13 - (block.col || 1);
        const nextColSpan = clamp(state.drag.startColSpan + deltaCol, 1, maxColSpan);
        const nextRowSpan = clamp(state.drag.startRowSpan + deltaRow, 1, 12);
        if (nextColSpan !== block.colSpan || nextRowSpan !== block.rowSpan) {
          updateSelectedBlockLive({ colSpan: nextColSpan, rowSpan: nextRowSpan });
        }
      } else {
        const nextCol = clamp(state.drag.startCol + deltaCol, 1, 13 - (block.colSpan || 1));
        const nextRow = clamp(state.drag.startRow + deltaRow, 1, 99);
        if (nextCol !== block.col || nextRow !== block.row) {
          updateSelectedBlockLive({ col: nextCol, row: nextRow });
        }
      }
    }

    function applyBlockPatch(block, patch) {
      if (!changesGeometry(patch)) {
        Object.assign(block, patch);
        return { movedIds: [] };
      }
      const candidate = normalizeBlockGeometry(Object.assign({}, block, patch));
      Object.assign(block, patch, {
        col: candidate.col,
        row: candidate.row,
        colSpan: candidate.colSpan,
        rowSpan: candidate.rowSpan
      });
      const movedIds = moveCollidingBlocks(block.id);
      if (movedIds.length > 0) {
        setLayoutNotice('已自动移动被碰撞组件：' + formatMovedBlocks(movedIds));
      } else {
        clearLayoutNotice();
      }
      return { movedIds };
    }

    function ensureLayoutCanSave() {
      const movedIds = repairLayoutCollisions();
      if (movedIds.length > 0) {
        setLayoutNotice('保存前已自动整理重叠组件：' + formatMovedBlocks(movedIds));
        markShiftedBlocks(movedIds);
      }
      return true;
    }

    function changesGeometry(patch) {
      return ['col', 'row', 'colSpan', 'rowSpan', 'span'].some((key) => Object.prototype.hasOwnProperty.call(patch, key));
    }

    function normalizeBlockGeometry(block) {
      const colSpan = clamp(block.colSpan || block.span || 12, 1, 12);
      const rowSpan = clamp(block.rowSpan || 1, 1, 12);
      return Object.assign({}, block, {
        col: clamp(block.col || 1, 1, 13 - colSpan),
        row: clamp(block.row || 1, 1, 99),
        colSpan,
        rowSpan
      });
    }

    function getBlockRect(block) {
      const normalized = normalizeBlockGeometry(block);
      return {
        colStart: normalized.col,
        colEnd: normalized.col + normalized.colSpan,
        rowStart: normalized.row,
        rowEnd: normalized.row + normalized.rowSpan
      };
    }

    function getCollision(candidate, ignoredId) {
      const candidateRect = getBlockRect(candidate);
      return (state.draftLayout || []).find((block) => block.id !== ignoredId && rectsOverlap(candidateRect, getBlockRect(block)));
    }

    function getLayoutCollision() {
      const layout = state.draftLayout || [];
      for (let index = 0; index < layout.length; index += 1) {
        const first = layout[index];
        const firstRect = getBlockRect(first);
        for (let next = index + 1; next < layout.length; next += 1) {
          const second = layout[next];
          if (rectsOverlap(firstRect, getBlockRect(second))) {
            return { a: first, b: second };
          }
        }
      }
      return undefined;
    }

    function moveCollidingBlocks(anchorId) {
      const movedIds = [];
      for (let guard = 0; guard < 120; guard += 1) {
        const anchor = state.draftLayout.find((block) => block.id === anchorId);
        if (!anchor) return movedIds;
        const collision = getCollision(anchor, anchorId);
        if (!collision) return movedIds;
        placeBlockInOpenSlot(collision, collision.col || 1, collision.row || 1);
        if (!movedIds.includes(collision.id)) movedIds.push(collision.id);
      }
      return movedIds;
    }

    function repairLayoutCollisions() {
      const movedIds = [];
      for (let guard = 0; guard < 120; guard += 1) {
        const collision = getLayoutCollision();
        if (!collision) return movedIds;
        placeBlockInOpenSlot(collision.b, collision.b.col || 1, collision.b.row || 1);
        if (!movedIds.includes(collision.b.id)) movedIds.push(collision.b.id);
      }
      return movedIds;
    }

    function rectsOverlap(a, b) {
      return a.colStart < b.colEnd && a.colEnd > b.colStart && a.rowStart < b.rowEnd && a.rowEnd > b.rowStart;
    }

    function placeBlockInOpenSlot(block, preferredCol, preferredRow) {
      const normalized = normalizeBlockGeometry(Object.assign({}, block, { col: preferredCol, row: preferredRow }));
      const maxCol = 13 - normalized.colSpan;
      let bestCandidate = undefined;
      let bestScore = Number.POSITIVE_INFINITY;
      for (let row = normalized.row; row < normalized.row + 200; row += 1) {
        for (let col = 1; col <= maxCol; col += 1) {
          const candidate = normalizeBlockGeometry(Object.assign({}, block, { col, row }));
          if (!getCollision(candidate, block.id)) {
            const score = Math.abs(row - normalized.row) * 12 + Math.abs(col - normalized.col);
            if (score < bestScore) {
              bestCandidate = candidate;
              bestScore = score;
            }
          }
        }
        if (bestCandidate && bestCandidate.row === row) break;
      }
      if (bestCandidate) {
        block.col = bestCandidate.col;
        block.row = bestCandidate.row;
        block.colSpan = bestCandidate.colSpan;
        block.rowSpan = bestCandidate.rowSpan;
        clearLayoutNotice();
        return;
      }
      block.col = 1;
      block.row = getNextRow();
      setLayoutNotice('没有找到足够的空位，已把组件放到画布底部。');
    }

    function setLayoutNotice(message) {
      if (state.layoutNoticeTimer) window.clearTimeout(state.layoutNoticeTimer);
      state.layoutNotice = message;
      renderDesignerPanel();
      state.layoutNoticeTimer = window.setTimeout(() => {
        state.layoutNotice = '';
        state.layoutNoticeTimer = undefined;
        renderDesignerPanel();
      }, 2200);
    }

    function clearLayoutNotice() {
      if (state.layoutNoticeTimer) window.clearTimeout(state.layoutNoticeTimer);
      state.layoutNoticeTimer = undefined;
      state.layoutNotice = '';
    }

    function markShiftedBlocks(blockIds) {
      for (const blockId of blockIds) markBlockShifted(blockId);
    }

    function markBlockShifted(blockId) {
      const element = document.querySelector('[data-layout-id="' + blockId + '"]');
      if (!element) return;
      element.classList.add('shifted');
      window.setTimeout(() => element.classList.remove('shifted'), 420);
    }

    function finishDrag() {
      if (!state.drag) return;
      const dragged = document.querySelector('[data-layout-id="' + state.drag.blockId + '"]');
      if (dragged) dragged.classList.remove('dragging', 'resizing');
      state.drag = null;
    }

    function getGridMetrics() {
      const rect = els.grid.getBoundingClientRect();
      const styles = getComputedStyle(els.grid);
      const gap = Number.parseFloat(styles.columnGap) || 0;
      const rowGap = Number.parseFloat(styles.rowGap) || 0;
      const baseRowHeight = Number.parseFloat(styles.gridAutoRows) || 92;
      const columnWidth = Math.max(1, (rect.width - gap * 11) / 12 + gap);
      const rowHeight = baseRowHeight + rowGap;
      return { columnWidth, rowHeight };
    }

    function updateRenderedBlock(block) {
      const element = document.querySelector('[data-layout-id="' + block.id + '"]');
      if (!element) return;
      applyGridPosition(element, block);
      const count = element.querySelector('.count');
      if (count) count.textContent = formatBlockPosition(block);
    }

    function applyGridPosition(element, block) {
      const colSpan = clamp(block.colSpan || block.span || 12, 1, 12);
      const rowSpan = clamp(block.rowSpan || 1, 1, 12);
      element.style.gridColumn = block.col ? String(block.col) + ' / span ' + String(colSpan) : 'span ' + String(colSpan);
      element.style.gridRow = block.row ? String(block.row) + ' / span ' + String(rowSpan) : 'span ' + String(rowSpan);
    }

    function getComponentCount(block) {
      const data = state.model.data || {};
      if (block.component === 'search') return state.query ? '搜索中' : '';
      if (block.component === 'quickCapture') return String((data.quickCaptures || []).length);
      if (block.component === 'focusTimer') return '';
      if (block.component === 'countdown') return String(((data.countdown && data.countdown.items) || []).filter((item) => !item.done).length);
      if (block.component === 'nextAction') {
        const nextAction = data.nextAction || {};
        const systemCount = Array.isArray(nextAction.systemRecommendations)
          ? nextAction.systemRecommendations.length
          : Array.isArray(nextAction.recommendations) ? nextAction.recommendations.length : 0;
        const aiCount = Array.isArray(nextAction.aiRecommendations) ? nextAction.aiRecommendations.length : 0;
        return String(systemCount + aiCount);
      }
      if (block.component === 'knowledgeGraph') {
        const graph = data.knowledgeGraph || {};
        return String(graph.stats && graph.stats.edges || (Array.isArray(graph.edges) ? graph.edges.length : 0));
      }
      if (block.component === 'favorites') return String((data.favorites || []).length);
      if (block.component === 'prompts') return String((data.prompts || []).length);
      if (block.component === 'fourQuadrants') return String((data.quadrants || []).reduce((count, quadrant) => count + (quadrant.items || []).length, 0));
      if (block.component === 'weekCalendar') return String((data.calendarEvents || []).length);
      if (block.component === 'monthCalendar') return String(getMonthCalendarItems().length);
      if (block.component === 'stats') return '概览';
      return '';
    }

    function getLimit(block, fallback) {
      const value = block && block.options ? Number.parseInt(block.options.limit, 10) : NaN;
      return Number.isNaN(value) ? fallback : Math.max(1, value);
    }

    function getFavoritePaths() { return new Set((state.model.data.favorites || []).map((item) => item.filePath)); }
    function getFocusTimerSession() {
      const timer = state.model.data.focusTimer || {};
      const settings = timer.settings || {};
      const session = timer.activeSession || {};
      const durationMs = Number.isFinite(Number(session.durationMs))
        ? Number(session.durationMs)
        : Number.isFinite(Number(settings.defaultFocusDurationMs))
          ? Number(settings.defaultFocusDurationMs)
          : 1500000;
      const elapsedMs = Math.min(durationMs, (Number(session.focusedMs) || 0) + (Number(session.blurredMs) || 0));
      return Object.assign({
        id: '',
        type: 'focus',
        status: 'idle',
        durationMs,
        focused: false,
        focusedMs: 0,
        strictFocusedMs: 0,
        blurredMs: 0,
        idleMs: 0,
        interruptions: 0,
        activityEvents: 0,
        task: undefined,
        elapsedMs,
        remainingMs: Math.max(0, durationMs - elapsedMs),
        progress: durationMs > 0 ? Math.round((elapsedMs / durationMs) * 100) : 0
      }, session);
    }
    function closeDatePickers(event) {
      if (event.target.closest('.date-picker')) return;
      for (const picker of document.querySelectorAll('.date-picker.open')) {
        picker.classList.remove('open');
      }
    }
    function groupCalendarItemsByDate(items) {
      return (items || []).reduce((result, item) => {
        if (!result[item.date]) result[item.date] = [];
        result[item.date].push(item);
        result[item.date].sort((a, b) => a.sortWeight - b.sortWeight || a.title.localeCompare(b.title));
        return result;
      }, {});
    }
    function getVisibleMonthItems(itemsByDate, visibleMonth) {
      const prefix = String(visibleMonth.getFullYear()) + '-' + padDatePart(visibleMonth.getMonth() + 1) + '-';
      return Object.keys(itemsByDate || {})
        .filter((dateKey) => dateKey.startsWith(prefix))
        .reduce((result, dateKey) => result.concat(itemsByDate[dateKey] || []), []);
    }
    function getMonthCalendarItems() {
      const events = (state.model.data.calendarEvents || []).map((event) => ({
        type: 'event',
        date: event.date,
        title: (event.start ? event.start + ' ' : '') + event.title,
        meta: '日历事件' + (event.start ? ' · ' + event.start : ''),
        className: 'month-item calendar-event',
        sortWeight: 10
      }));
      const tasks = [];
      for (const quadrant of state.model.data.quadrants || []) {
        for (const task of quadrant.items || []) {
          if (!normalizeDateValue(task.dueDate)) continue;
          const overdue = !task.done && daysUntil(task.dueDate) < 0;
          tasks.push({
            type: 'task',
            date: task.dueDate,
            title: task.text,
            meta: quadrant.title + (overdue ? ' · 已过期' : ''),
            quadrantId: quadrant.id,
            quadrantTitle: quadrant.title,
            taskId: task.id,
            done: Boolean(task.done),
            overdue,
            className: 'month-item ' + quadrant.id + (task.done ? ' done' : '') + (overdue ? ' overdue' : ''),
            sortWeight: task.done ? 80 : getQuadrantSortWeight(quadrant.id)
          });
        }
      }
      return events.concat(tasks);
    }
    function getQuadrantSortWeight(quadrantId) {
      return ({
        importantUrgent: 20,
        notImportantUrgent: 30,
        importantNotUrgent: 40,
        notImportantNotUrgent: 50
      })[quadrantId] || 60;
    }
    function getDefaultQuadrantForDate(dateKey) {
      const days = daysUntil(dateKey);
      return days <= 3 ? 'importantUrgent' : 'importantNotUrgent';
    }
    function daysUntil(dateKey) {
      const date = parseDateKey(dateKey);
      if (!date) return 99;
      return Math.round((date.getTime() - startOfDay(new Date()).getTime()) / 86400000);
    }
    function addDays(date, days) { const next = new Date(date); next.setDate(next.getDate() + days); return next; }
    function startOfDay(date) { return new Date(date.getFullYear(), date.getMonth(), date.getDate()); }
    function startOfWeek(date) { return addDays(startOfDay(date), -((date.getDay() + 6) % 7)); }
    function toDateKey(date) { return [date.getFullYear(), padDatePart(date.getMonth() + 1), padDatePart(date.getDate())].join('-'); }
    function isSameDate(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
    function weekdayName(date) { return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][date.getDay()]; }
    function formatDueDate(value, placeholder) {
      if (!value) return placeholder || '截止日';
      const date = parseDateKey(value);
      if (!date) return placeholder || '截止日';
      const days = Math.round((date.getTime() - startOfDay(new Date()).getTime()) / 86400000);
      if (days === 0) return '今天';
      if (days === 1) return '明天';
      if (days === -1) return '昨天';
      return String(date.getMonth() + 1) + '/' + String(date.getDate());
    }
    function formatShortDate(date) { return String(date.getMonth() + 1) + '/' + String(date.getDate()); }
    function formatFullDate(value) {
      const date = parseDateKey(value);
      if (!date) return value;
      return String(date.getFullYear()) + ' 年 ' + String(date.getMonth() + 1) + ' 月 ' + String(date.getDate()) + ' 日';
    }
    function formatCaptureTime(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      const today = startOfDay(new Date());
      const target = startOfDay(date);
      const time = padDatePart(date.getHours()) + ':' + padDatePart(date.getMinutes());
      if (target.getTime() === today.getTime()) return time;
      return formatShortDate(date) + ' ' + time;
    }
    function formatQuickCaptureKind(kind) {
      return {
        note: '想法',
        task: '待办',
        link: '链接',
        code: '代码'
      }[kind] || '记录';
    }
    function formatFocusStatus(session) {
      if (session.status === 'running' && session.type === 'shortBreak') return '短休息中';
      if (session.status === 'running' && session.type === 'longBreak') return '长休息中';
      if (session.status === 'running' && session.focused) return '专注中';
      if (session.status === 'running') return '窗口已离开';
      if (session.status === 'paused') return '已暂停';
      if (session.status === 'completed') return formatFocusSessionType(session.type) + '完成';
      return '未开始';
    }
    function formatFocusSessionType(type) {
      return {
        focus: '专注',
        shortBreak: '短休息',
        longBreak: '长休息'
      }[type] || '专注';
    }
    function formatFocusHistoryBadge(item) {
      if (item && item.result === 'aborted') return '终止';
      return formatFocusSessionType(item && item.type);
    }
    function focusHistoryMain(item) {
      const taskPrefix = focusTaskTitle(item && item.task) ? truncateText(focusTaskTitle(item.task), 18) + ' · ' : '';
      if (item.result === 'aborted') {
        return taskPrefix + '已进行 ' + formatCompactDuration(getFocusHistoryElapsed(item));
      }
      if (item.type === 'focus') {
        return taskPrefix + '专注 ' + formatCompactDuration(item.focusedMs || 0) + ' · 打断 ' + String(item.interruptions || 0);
      }
      return '完成 ' + formatCompactDuration(item.durationMs || 0);
    }
    function getFocusHistoryElapsed(item) {
      return Math.min(item.durationMs || 0, (item.focusedMs || 0) + (item.blurredMs || 0));
    }
    function formatTimeOfDay(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return padDatePart(date.getHours()) + ':' + padDatePart(date.getMinutes());
    }
    function formatClock(ms) {
      const seconds = Math.max(0, Math.ceil((Number(ms) || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      return String(minutes).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
    }
    function formatCompactDuration(ms) {
      const seconds = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
      const minutes = Math.floor(seconds / 60);
      if (minutes >= 60) return String(Math.floor(minutes / 60)) + 'h ' + String(minutes % 60) + 'm';
      if (minutes > 0) return String(minutes) + 'm';
      return String(seconds) + 's';
    }
    function truncateText(value, maxLength) {
      const text = String(value || '').replace(/\s+/g, ' ').trim();
      const limit = Math.max(1, Number(maxLength) || 20);
      return text.length > limit ? text.slice(0, limit - 1) + '…' : text;
    }
    function padDatePart(value) { return String(value).padStart(2, '0'); }
    function normalizeDateValue(value) { const text = String(value || '').trim(); return /^\\d{4}-\\d{2}-\\d{2}$/.test(text) ? text : ''; }
    function parseDateKey(value) {
      const normalized = normalizeDateValue(value);
      if (!normalized) return undefined;
      const parts = normalized.split('-').map((part) => Number.parseInt(part, 10));
      return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    function formatBlockPosition(block) { return '列 ' + (block.col || '-') + ' · 行 ' + (block.row || '-') + ' · 宽 ' + (block.colSpan || 12) + ' · 高 ' + (block.rowSpan || 1); }
    function formatCollisionName(block) { return (block.title || getComponentDefinition(block.component).title || block.component) + '（' + (block.col || 1) + ',' + (block.row || 1) + '）'; }
    function formatMovedBlocks(blockIds) { return blockIds.map((blockId) => state.draftLayout.find((block) => block.id === blockId)).filter(Boolean).map(formatCollisionName).join('、'); }
    function clamp(value, min, max) { const number = Number.parseInt(value, 10); return Number.isNaN(number) ? min : Math.min(Math.max(number, min), max); }
    function summarizeModel(model) {
      const data = model && model.data ? model.data : {};
      return {
        ready: Boolean(model && model.ready),
        layout: Array.isArray(model && model.layout) ? model.layout.length : 0,
        items: Array.isArray(data.items) ? data.items.length : 0,
        favorites: Array.isArray(data.favorites) ? data.favorites.length : 0,
        recent: Array.isArray(data.recent) ? data.recent.length : 0,
        quickCaptures: Array.isArray(data.quickCaptures) ? data.quickCaptures.length : 0,
        countdowns: data.countdown && Array.isArray(data.countdown.items) ? data.countdown.items.length : 0,
        recommendations: data.nextAction && Array.isArray(data.nextAction.recommendations) ? data.nextAction.recommendations.length : 0,
        aiRecommendations: data.nextAction && Array.isArray(data.nextAction.aiRecommendations) ? data.nextAction.aiRecommendations.length : 0,
        graphNodes: data.knowledgeGraph && Array.isArray(data.knowledgeGraph.nodes) ? data.knowledgeGraph.nodes.length : 0,
        graphEdges: data.knowledgeGraph && Array.isArray(data.knowledgeGraph.edges) ? data.knowledgeGraph.edges.length : 0,
        quadrants: Array.isArray(data.quadrants) ? data.quadrants.length : 0
      };
    }
    function formatWebviewError(error) {
      if (!error) return { message: '未知错误' };
      return {
        message: error.message || String(error),
        stack: error.stack || ''
      };
    }

    function actionButton(text, action, secondary) {
      const result = button(text, undefined, secondary);
      result.dataset.action = action;
      return result;
    }
    function searchActionButton(icon, label, action, options) {
      const result = actionButton(icon, action, true);
      result.className = ['search-action', options && options.primary ? 'primary' : '', options && options.active ? 'active' : ''].filter(Boolean).join(' ');
      result.title = label;
      result.setAttribute('aria-label', label);
      return result;
    }
    function actionsWrap(buttons) { const wrap = div('designer-actions'); for (const item of buttons) wrap.appendChild(item); return wrap; }
    function button(text, onClick, secondary) { const result = document.createElement('button'); result.type = 'button'; result.textContent = text; if (secondary) result.className = 'secondary'; if (onClick) result.addEventListener('click', onClick); return result; }
    function div(className, text) { const result = document.createElement('div'); result.className = className; if (text !== undefined) result.textContent = text; return result; }
    function strongText(text) { const result = document.createElement('strong'); result.textContent = text; return result; }
    function spanText(text) { const result = document.createElement('span'); result.textContent = text; return result; }
    function empty(text) { return div('empty', text); }
    function fieldWrap(labelText, control) { const wrap = div('designer-field'); const label = document.createElement('label'); label.textContent = labelText; wrap.append(label, control); return wrap; }
    function inputField(labelText, value, type, onChange, min, max) { const input = document.createElement('input'); input.type = type; input.value = String(value ?? ''); if (min !== undefined) input.min = String(min); if (max !== undefined) input.max = String(max); input.addEventListener('change', () => onChange(input.value)); return fieldWrap(labelText, input); }
    function readonlyField(labelText, value) { return fieldWrap(labelText, div('template-name', value)); }

    requestModel('boot');
    const readyTimer = window.setInterval(() => {
      if (hasModel || readyAttempts >= 6) {
        window.clearInterval(readyTimer);
        if (!hasModel) {
          logToExtension('model still missing after retries', { attempts: readyAttempts });
        }
        return;
      }
      requestModel('retry');
    }, 1000);
  </script>
</body>
</html>`;
}

module.exports = {
  getWebviewHtml
};
