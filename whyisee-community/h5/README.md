# whyisee h5（移动端）

Flutter 混合壳。目录名沿用 h5，实际产物是 Android/iOS 安装包，不是网页。

设计与决策见 `../docs/mobile-app-dev-design.md`（服务端 + 客户端）和 `../docs/mobile-app-design.md`（路线 ADR）。

## 当前进度

- **P0 外壳（完成）**：4 个底部 tab、远程 URL WebView、外链拦截、返回键四级判断、原生错误页、深色主题。
- **P1 原生页（完成）**：`/` 换成原生 feed（四种排序、下拉刷新、游标翻页按 id 去重）、`/t/:id` 原生详情（正文 WebView 高度自适应、回帖、点赞乐观更新、相关阅读）、token 持久化、WebView 登录后经 JS 桥把 token 交接给原生。
- 仍是 WebView：「出发」「关注」「我」三个 tab；发帖/回复、配图上传走外链到网页（P2）。

## 结构

```
lib/
├── main.dart                     入口：状态栏、竖屏锁定
├── app.dart                      MaterialApp.router + 底色兜底（防白闪）
├── core/
│   ├── env.dart                  站点域名、白名单、主题色（取自网页 foundation.css）
│   ├── app_theme.dart            深色单主题，与网页 CSS 变量对齐
│   ├── format.dart               相对时间、计数压缩、回帖 HTML 降级纯文本
│   ├── providers.dart            tokenStore / apiClient / session 三个 provider
│   └── api/
│       ├── api_client.dart       dio + Bearer 注入 + 统一错误解包
│       ├── api_exception.dart    失败语义（network / unauthorized / rate_limited）
│       ├── models.dart           响应模型，两端唯一耦合点
│       └── token_store.dart      token 落盘（SharedPreferences）
├── router/app_router.dart        StatefulShellRoute.indexedStack，4 条独立栈
└── features/
    ├── shell/home_shell.dart     底部 tab + 返回键四级判断
    ├── feed/
    │   ├── feed_page.dart        原生列表（骨架屏 / 空态 / 触底预取）
    │   ├── feed_controller.dart  排序切换、游标翻页、点赞回写
    │   ├── feed_repository.dart  /feed 调用
    │   └── widgets/topic_card.dart
    ├── topic/
    │   ├── topic_detail_page.dart  一次请求聚合详情 + 点赞
    │   ├── topic_repository.dart   /topics/:id、/interactions/*
    │   └── widgets/{article_webview,post_tile}.dart
    ├── web/web_page.dart         WebView 容器 + 错误兜底 + JS 桥
    ├── web/web_registry.dart     按 tab 索引登记控制器
    └── errors/error_view.dart    原生错误页
```

## 关键实现说明

**正文为什么要 WebView**：`contentHtml` 由服务端产出，含图片 grid、@提及等增强。在 Dart 里重写一遍必然走样，所以正文用 WebView 加载一段内联深色样式的文档，靠注入 JS 测量 `scrollHeight` 回传给 Flutter 设置高度，让它在页面滚动流里自然展开，而不是内部可滚的小窗口。

**回帖为什么不用 WebView**：30 条回复 = 30 个 WebView，内存和首帧都受不了。回帖降级成纯文本（`htmlToPlainText`），保留段落换行和图片占位。

**token 从哪来**：两条路。① app 内登录（`POST /auth/login`）；② 用户在 WebView 里的网页登录，`AppTokenBridge.astro` 检测到 `window.FlutterBridge` 后调 `/auth/session-from-cookie`，把 cookie 会话升级成 app 会话并推给原生。网页退登，app 立刻失效。

**分页去重**：feed 用 offset 游标（服务端排序实时计算，做不了稳定 keyset），翻页间排序可能微变，所以客户端按 id 去重。

## 常用命令

```bash
flutter analyze
flutter test
flutter build apk --debug
flutter install                 # 需要真机或模拟器已连接
```

Flutter SDK 在 `~/development/flutter`，已软链到 `/opt/homebrew/bin/flutter`。
Gradle 用的 JDK 已固定为 Temurin 21（`flutter config --jdk-dir`），不要用 PATH 上的 Java 8。

## 已踩的坑

1. Flutter 3.50 起 Material 拆成独立包，必须 `import 'package:material_ui/material_ui.dart'`，`package:flutter/material.dart` 已废弃。
2. release 包的 `INTERNET` 权限要显式写进 `android/app/src/main/AndroidManifest.xml`，模板只在 debug/profile 的 manifest 里加。
3. `brew install --cask flutter` 在本机沙箱内会失败（`sandbox-exec: sandbox_apply: Operation not permitted`），SDK 是手动下 zip 解压到 `~/development/flutter` 的。
4. `shared_preferences_foundation` 2.6.x 依赖 `objective_c`，它的构建钩子要调 `xcodebuild`；本机只有 CommandLineTools，会让 `flutter test` 直接失败。已在 `pubspec.yaml` 用 `dependency_overrides` 锁到 2.5.3（只影响 iOS/macOS 实现，Android 不受影响）。
