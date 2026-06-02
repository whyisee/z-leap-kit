# Leap Home

[中文说明](README.md)

Leap Home is a personal knowledge dashboard for Cursor / VS Code. It opens in the editor area and brings AI search, quick capture, Pomodoro focus, task planning, calendars, recommendations, and a knowledge graph into one workspace home.

![Leap Home overview](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/home-overview.png)

## Installation

- Search for `Leap Home` in the Cursor / VS Code Extensions view.
- Or install it from [Open VSX](https://open-vsx.org/extension/whyisee/leap-home).
- Run `Leap Home: Open Knowledge Home` or `Leap Home: 打开知识首页`.
- Click the Leap Home status bar entry to reopen the dashboard quickly.
- Run `Leap Home: 切换语言 / Switch Language` to switch between English, Chinese, or automatic language detection.

## Repository

- Repository: [whyisee/z-leap-kit](https://github.com/whyisee/z-leap-kit/tree/main/leap-home)
- Issues: [GitHub Issues](https://github.com/whyisee/z-leap-kit/issues)
- License: [MIT](LICENSE)

## Screenshots

![Quick Capture](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/quick-capture.png)

![Quadrants, week calendar, and month calendar](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/planning-calendar.png)

![Knowledge Graph](https://raw.githubusercontent.com/whyisee/z-leap-kit/main/leap-home/resources/screenshots/knowledge-graph.png)

## Highlights

- Opens a knowledge homepage in the editor area, not the sidebar.
- Uses a 12-column grid layout with built-in templates and multiple custom homepages.
- Provides a visual homepage designer with drag, resize, collision handling, component settings, and reusable templates.
- Indexes Markdown, code, configuration, and common text files in the current workspace.
- Supports additional local knowledge sources.
- Searches by title, filename, source, relative path, full path, and indexed content.
- Includes Search, Quick Capture, Focus Timer, Countdown, Next Action, Four Quadrants, Week Calendar, Month Calendar, Knowledge Graph, Favorites, Prompt Templates, and Stats components.
- Adds a left-side status bar entry that can show Home, Focus Timer, Countdown, or Today Stats.
- Stores workspace data under `.leap`.
- Appends quick notes to `.leap/inbox.md` by default.
- Provides optional DeepSeek-powered AI features for search understanding, task classification, recommendations, and knowledge organization.

## Commands

| Command | Description |
| --- | --- |
| `Leap Home: 打开知识首页` | Open Leap Home in the editor area |
| `Leap Home: 切换状态栏显示组件` | Choose what the status bar entry displays |
| `Leap Home: 切换语言 / Switch Language` | Switch between English, Chinese, or automatic language detection |
| `Leap Home: 搜索知识库` | Search indexed knowledge files |
| `Leap Home: 记录到收集箱` | Append a note to the inbox |
| `Leap Home: 刷新索引` | Rebuild the knowledge index |
| `Leap Home: 收藏当前文件` | Add the active file to favorites |
| `Leap Home: 复制 Prompt` | Copy a prompt template to the clipboard |
| `Leap Home: 切换主页` | Switch between built-in and custom homepages |
| `Leap Home: 新建自定义主页` | Create a custom homepage |
| `Leap Home: 编辑当前主页` | Edit the current homepage |
| `Leap Home: 退出主页编辑` | Exit homepage editing mode |
| `Leap Home: 配置 AI` | Configure DeepSeek settings |
| `Leap Home: 打开调试日志` | Open Leap Home logs |

## Configuration Example

```json
{
  "leapHome.homeTemplate": "project-workbench",
  "leapHome.homeLayout": [],
  "leapHome.sources": [
    {
      "name": "Notes",
      "path": "~/Documents/notes",
      "type": "markdown",
      "enabled": true
    }
  ],
  "leapHome.promptDirs": [
    "~/Documents/prompts"
  ],
  "leapHome.inboxPath": "${workspaceFolder}/.leap/inbox.md",
  "leapHome.maxRecentItems": 12,
  "leapHome.statusBar.enabled": true,
  "leapHome.statusBar.component": "focusTimer",
  "leapHome.language": "auto",
  "leapHome.autoIndexWorkspace": true,
  "leapHome.focusTimer.trackForegroundApp": true,
  "leapHome.focusTimer.trustedApps": [
    "Cursor",
    "Obsidian",
    "Notion",
    "Google Chrome",
    "Safari",
    "Preview"
  ],
  "leapHome.ai.provider": "deepseek",
  "leapHome.ai.deepseekModel": "deepseek-v4-flash"
}
```

## AI

Leap Home currently prioritizes DeepSeek for AI features. Run `Leap Home: 配置 AI` and follow the prompts to save your API key and model into Cursor / VS Code user settings. You can also search for `Leap Home AI` in Settings.

AI requests are only sent when you explicitly trigger AI actions, such as AI search, task classification, knowledge organization, or Next Action recommendations.

## Focus Timer

The Focus Timer can optionally track the foreground application during a focus session. When `leapHome.focusTimer.trackForegroundApp` is enabled, switching to trusted apps still counts as focus time. Leap Home records only application names, not window titles.

On macOS, Cursor may need permission to access `System Events`. If the permission is unavailable, Leap Home falls back to detecting only the Cursor / VS Code window focus state.

## Grid Layout

`leapHome.homeLayout` uses a 12-column grid. Each component can configure its start column, start row, width, and height.

```json
{
  "leapHome.homeLayout": [
    {
      "id": "search",
      "component": "search",
      "col": 1,
      "row": 1,
      "colSpan": 12,
      "rowSpan": 2
    },
    {
      "id": "capture",
      "component": "quickCapture",
      "col": 1,
      "row": 3,
      "colSpan": 6,
      "rowSpan": 2
    },
    {
      "id": "focus",
      "component": "focusTimer",
      "col": 7,
      "row": 3,
      "colSpan": 6,
      "rowSpan": 2
    }
  ]
}
```

## Workspace Data

Leap Home stores runtime data under the current workspace's `.leap` directory.

```text
.leap/
  state.json
  inbox.md
  components/
    favorites.json
    recent.json
    four-quadrants.json
    calendar.json
    search-history.json
    quick-capture.json
    focus-timer.json
    countdown.json
    next-action.json
    knowledge-graph.json
```

## Development

Open the `leap-home` directory with Cursor or VS Code:

```sh
cd leap-home
```

Then launch the extension host with the `Run Leap Home Extension` debug configuration.

Run checks before packaging:

```sh
npm run check
npx @vscode/vsce package
```

## Notes

Leap Home keeps the index local and stores workspace data under `.leap`. It does not require a database or external service unless you explicitly enable and trigger AI features.
