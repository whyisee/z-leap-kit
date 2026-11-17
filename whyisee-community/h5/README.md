# whyisee h5（移动端）

Flutter 混合壳。目录名沿用 h5，实际产物是 Android/iOS 安装包，不是网页。

设计与决策见 `../docs/mobile-app-dev-design.md`（服务端 + 客户端）和 `../docs/mobile-app-design.md`（路线 ADR）。

## 当前进度

- P0 外壳：4 个底部 tab、远程 URL WebView、外链拦截、返回键四级判断、原生错误页、深色主题。所有页面暂时走 WebView。
- 未开始：原生 feed / 帖子详情（P1，依赖服务端 `/api/v1`）、token 登录（P1）。

## 结构

```
lib/
├── main.dart                  入口：状态栏、竖屏锁定
├── app.dart                   MaterialApp.router + 底色兜底（防白闪）
├── core/
│   ├── env.dart               站点域名、白名单、主题色（取自网页 foundation.css）
│   └── app_theme.dart         深色单主题，与网页 CSS 变量对齐
├── router/app_router.dart     StatefulShellRoute.indexedStack，4 条独立栈
└── features/
    ├── shell/home_shell.dart  底部 tab + 返回键四级判断
    ├── web/web_page.dart      WebView 容器 + 错误兜底 + JS 桥
    ├── web/web_registry.dart  按 tab 索引登记控制器
    └── errors/error_view.dart 原生错误页
```

## 常用命令

```bash
flutter analyze
flutter test
flutter build apk --debug
flutter install                 # 需要真机或模拟器已连接
```

Flutter SDK 在 `~/development/flutter`，已软链到 `/opt/homebrew/bin/flutter`。
Gradle 用的 JDK 已固定为 Temurin 21（`flutter config --jdk-dir`），不要用 PATH 上的 Java 8。

## 三个已踩的坑

1. Flutter 3.50 起 Material 拆成独立包，必须 `import 'package:material_ui/material_ui.dart'`，`package:flutter/material.dart` 已废弃。
2. release 包的 `INTERNET` 权限要显式写进 `android/app/src/main/AndroidManifest.xml`，模板只在 debug/profile 的 manifest 里加。
3. `brew install --cask flutter` 在本机沙箱内会失败（`sandbox-exec: sandbox_apply: Operation not permitted`），SDK 是手动下 zip 解压到 `~/development/flutter` 的。
