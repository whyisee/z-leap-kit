# Changelog

All notable changes to Leap Home will be documented in this file.

## [0.3.0] - 2026-06-02

### Added

- Added full Chinese/English internationalization support for the homepage webview, status bar, commands, component metadata, and extension messages.
- Added `leapHome.language` support with Auto, Chinese, and English modes, plus the `Leap Home: 切换语言 / Switch Language` command.
- Added language-aware DeepSeek prompts for Next Action AI recommendations so summaries, suggestions, action labels, and generated note content follow the selected UI language.

### Changed

- Localized Search, Next Action, Focus Timer, Countdown, Week Calendar, Month Calendar, and Stats component details, including placeholders, empty states, tooltips, labels, date text, and dynamic status messages.
- Improved Search result rendering so plugin-generated metadata such as quadrants, task status, search groups, match reasons, and action tooltips follow the selected language while preserving user-authored note/task content.
- Improved Focus Timer language coverage for task binding, completed focus actions, history details, app usage tooltips, and follow-up focus controls.
- Improved date and countdown formatting for English mode, including month titles, week/month summaries, due-date labels, countdown units, overdue text, and color names.

### Fixed

- Fixed mixed-language Search result items where task metadata such as `四象限`, quadrant names, and `已完成/未完成` still appeared in English mode.
- Fixed untranslated Focus Timer controls such as `+ 新建事项` and `再专注`.
- Fixed untranslated Stats health summaries and dynamic tooltip text.

## [0.2.0] - 2026-06-01

### Added

- Added more Next Action recommendation actions, including 10-minute focus starts, scheduling tasks, completing countdowns, converting captures into tasks, opening the inbox, and AI-generated direct focus actions.
- Added AI-powered Next Action note writing actions for creating new Markdown notes or appending content to existing notes in the most relevant workspace/knowledge-source path.
- Added an English README for international users and linked it from the Chinese README.

### Changed

- Improved Open VSX listing metadata, README positioning, installation guidance, and screenshot URLs for the monorepo release page.

### Fixed

- Fixed malformed DeepSeek JSON responses in Next Action recommendations by increasing output budget, tightening note-writing prompts, adding tolerant JSON extraction, and retrying once on parse failures.

## [0.1.3] - 2026-06-01

### Added

- Added a left status bar entry for opening Leap Home quickly.
- Added configurable status bar summaries for Home, Focus Timer, Countdown, and Today Stats.
- Added foreground app tracking for Focus Timer, including trusted external focus apps and app usage details.
- Added modular webview component files under `src/webview/`.
- Added restored extension icons and screenshot resources for publishing.

### Changed

- Split the large webview implementation into component modules for Search, Quick Capture, Focus Timer, Countdown, Next Action, Knowledge Graph, Four Quadrants, Calendar, Stats, and list components.
- Improved Focus Timer tooltip rendering with a custom hover panel and multiline details.
- Updated README with status bar usage, component modules, screenshots, repository metadata, and AI/focus timer configuration notes.

### Fixed

- Fixed Focus Timer background ticks rebuilding the whole homepage every second, which could interrupt inputs and interactions in other components.
- Fixed Focus Timer tooltip line breaks displaying literal `\n`.
- Fixed status bar countdown display for date-only items due today.
- Fixed package dry-run validation by ensuring screenshot and icon assets are included.

## [0.1.1] - 2026-05-31

### Added

- Added the first MVP of Leap Home as an editor-window knowledge homepage for Cursor and VS Code.
- Added grid-based customizable home pages with built-in templates.
- Added Search, Quick Capture, Focus Timer, Countdown, Next Action, Four Quadrants, Week Calendar, Month Calendar, Knowledge Graph, Favorites, Prompt Templates, and Stats components.
- Added workspace data storage under `.leap` with per-component JSON files.
- Added DeepSeek-backed AI features for search understanding, task classification, quick capture, next-action suggestions, and knowledge organization.
- Added README, license, repository metadata, icon, and screenshots for extension publishing.
