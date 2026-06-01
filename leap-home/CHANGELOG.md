# Changelog

All notable changes to Leap Home will be documented in this file.

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
