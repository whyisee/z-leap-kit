# whyisee.xyz 移动端 App 设计方案

更新日期：2026-11-17

## 1. 结论先放

用 **Flutter 做混合外壳**：

- 外壳负责导航、底部 tab、返回键、状态栏、安全区、登录态持有。
- 内容默认用 WebView 加载远程 `https://whyisee.xyz`。
- 只把**少数高价值页面**（看见 feed、帖子详情）换成 Dart 原生页。
- 其余页面（登录、搜索、设置、管理、agent-zone）保持 WebView，不重写。

节奏：

| 阶段 | 产出 | 工期 |
|---|---|---|
| P0 | 纯壳，能装能刷能登录 | 1 天 |
| P1 | 原生 feed + 帖子详情，日常可用 | 1 周 |
| P2 | 推送、发帖编辑器、离线、iOS | 按需 |

**不做全量重写。** 理由见 §3 的 ADR-1。

---

## 2. 现状盘点

### 2.1 技术栈事实（已核实）

| 项 | 事实 |
|---|---|
| 框架 | Astro，`output: "server"`（服务端渲染） |
| 适配器 | `@astrojs/node` standalone |
| API | Hono，挂在 `src/pages/api/[...path].ts` |
| 数据库 | PostgreSQL，`src/server/db/schema.ts` 897 行 |
| 代码量 | 45,252 行（src 下 .astro/.ts） |
| 页面数 | 50+ 个 |
| 前端脚本 | 仅 19 个 `.astro` 含 `<script>` → 表单往返式交互，不是 SPA |
| 认证 | Cookie `whyisee_session`，`httpOnly: true`，`sameSite: lax`，7 天，`path: /` |
| 域名白名单 | `security.allowedDomains` 只放行 `whyisee.xyz`、`www.whyisee.xyz` |

### 2.2 已经具备的移动端基础（关键发现）

`src/styles/modules/responsive.css` 是**一整套已交付的移动端布局**，不是草稿：

- `@media (max-width: 980px)`：左侧导航 `.left-nav` 从固定栏变浮层抽屉，由 `:root[data-sidebar="collapsed"]` 控制左右滑动与透明度过渡。
- 右栏 `.sidebar` 直接 `display: none`。
- 话题卡片从表格多列重排为单列，`.topic-table-head` 隐藏，改用 `.topic-mobile-stats`。
- 管理后台导航 `.admin-nav` 变横向滚动条。
- 设置页 `.settings-nav-group` 同样横滚。
- 已使用 `env(safe-area-inset-left)`。

**结论：网页的移动端体验是可用状态。** 壳的起点不是"勉强能看"，是"本来就能用"。这直接把 P0 的工期压到 1 天以内，也意味着"原生重写能带来多大提升"这个问题的答案比预想的小 —— 主要剩下滚动性能、输入体验、推送这三项。

### 2.3 缺口清单

| 缺口 | 影响 |
|---|---|
| **无 `viewport-fit=cover`** | `env(safe-area-inset-*)` 在 WebView 内全部为 0，安全区失效 |
| **无深浅色切换**，固定深色 | app 只能跟深色，状态栏必须用亮色图标 |
| 无 PWA manifest / service worker | 不能加主屏、无离线 |
| 无推送能力 | P2 才需要 |
| `allowedDomains` 白名单 | 本地打包资源的 origin 会被 403 |
| 认证仅 httpOnly cookie | 原生页面拿不到凭证 |

---

## 3. 路线决策（ADR）

### ADR-1：不选全量原生重写

50+ 页面、45k 行。全量重写的真实成本不在"写代码"——AI 能批量翻。成本在两处：

1. **验证回路**：AI 写完看不见界面，布局错误（溢出、错位、滚动嵌套冲突）编译器不报，只能靠人逐页肉眼确认。50 页 × 2-3 轮，随页面数线性增长。
2. **接口重做**：现有 API 是给 SSR 表单用的（`FormData` 提交 + 服务端 redirect + 422 回填表单），不是给客户端消费的。这层边界要重新划，是设计决策不是翻译。

而 P0 壳的验证成本接近 0 —— 网页本身已经被验证过了。

**决策：混合渐进。** 原生页面数量由实际用户抱怨决定，不由技术偏好决定。

### ADR-2：远程 URL 加载，不打包本地资源

- Astro `output: "server"`，HTML 由服务端生成。本地打包只能拿到空壳。
- `security.allowedDomains` 会校验 Host / Origin。Capacitor 或 Flutter 本地容器的 origin（`https://localhost` / `capacitor://localhost`）不在白名单，所有请求会被挡成 403。
- 远程模式可以随时改网页即改 app，不用走商店审核。

**代价（必须接受）**：无网络时白屏，首屏依赖网络 RTT。→ 必须配原生错误页 + 重试，见 §5.1。

### ADR-3：选 Flutter，不选 RN / Capacitor

| | Capacitor | React Native | Flutter |
|---|---|---|---|
| 壳的搭建速度 | 最快 | 中 | 中 |
| 能否后续渐进加原生页 | **不能**，止步于壳 | 能 | 能 |
| 类型检查 | TS | JS（动态，运行时才暴露） | **Dart 静态 + AOT，编译期拦错** |
| 依赖复杂度 | npm 依赖地狱 | npm 依赖地狱 | pub.dev 5 万包，依赖树浅 |
| 两端 UI 一致性 | 由网页决定 | 映射系统控件，两端有差异 | 自绘，两端完全一致 |
| 桌面端 | 无 | 基本没有 | 几乎白送 |

**关键理由是第二条类型检查。** 在"AI 写代码、人验收"的模式下，Dart 的编译期检查意味着 AI 能自己发现并修复大量错误，只有布局错位还需要人眼看。JS 的 `undefined is not a function` 要等到特定数据组合才复现，在 50 个页面规模下会拖死进度。

拒 Capacitor 的理由不是它差，是它把路线锁死在"永远只是壳"，没有增量空间。

---

## 4. 目标架构

```
┌──────────────────────────────────────────────────┐
│ Flutter Shell (Dart)                             │
│  · 底部 Tab（看见 / 出发 / 关注 / 我）            │
│  · 每个 Tab 独立导航栈                            │
│  · 返回键 / 侧滑返回                              │
│  · 系统状态栏、安全区、启动屏                      │
│  · AuthStore（持有登录凭证）                      │
├───────────────────────┬──────────────────────────┤
│ Native Pages (Dart)   │ WebView Pages (Astro SSR)│
│  · 看见 feed          │  · /login  /search       │
│  · 帖子详情           │  · /settings/*  /admin/* │
│  · (P2) 发帖编辑器    │  · /u/*  /agent-zone/*   │
├───────────────────────┴──────────────────────────┤
│ ApiClient (Bearer)          │  JS Bridge          │
└─────────────────────────────┴─────────────────────┘
              ↓                        ↓
        https://whyisee.xyz  (Astro SSR + Hono + PG)
```

---

## 5. 关键技术设计

### 5.1 WebView 容器

```dart
WebViewController()
  ..setJavaScriptMode(JavaScriptMode.unrestricted)
  ..setBackgroundColor(const Color(0xFF11161F))   // 深色底，防白闪
  ..setNavigationDelegate(NavigationDelegate(
    onNavigationRequest: _onNavigationRequest,
    onWebResourceError: _onError,
  ))
  ..addJavaScriptChannel('FlutterBridge', onMessageReceived: _onBridgeMessage)
  ..loadRequest(Uri.parse('https://whyisee.xyz'));
```

**必须做 `setBackgroundColor`。** 站点是深色（`rgba(17, 21, 29)` 系），WebView 默认白底，每次加载会闪一下白，观感很差。

**错误页**：`onWebResourceError` 触发时切到一个 Dart 写的原生页，含「重试」按钮和离线说明。不要用 `error.html`，那个在远程模式下拿不到。

### 5.2 认证（本方案最核心的难点）

三个既定事实：

1. Cookie 名 `whyisee_session`，`httpOnly: true` → WebView 里的 JS 读不到，Dart 也读不到。
2. 原生页面要调 API，必须有凭证。
3. `readSessionId()` 在 `src/lib/auth.ts`，凭证就是 `sessions` 表里的 `sessionId`。

#### 方案 A —— WebView 代请求（P1 用，零后端改动）

原生页不直接发 HTTP，让 WebView 里的 JS 发，再把结果回传：

```dart
Future<ApiResult> fetchViaWebView(String path) async {
  final id = _seq++;
  final completer = Completer<ApiResult>();
  _pending[id] = completer;

  await _controller.runJavaScript("""
    (async () => {
      try {
        const r = await fetch('$path', { credentials: 'include' });
        const ct = r.headers.get('content-type') || '';
        const body = ct.includes('json') ? await r.json() : await r.text();
        FlutterBridge.postMessage(JSON.stringify({
          id: $id, status: r.status, body
        }));
      } catch (e) {
        FlutterBridge.postMessage(JSON.stringify({
          id: $id, status: 0, error: String(e)
        }));
      }
    })();
  """);

  return completer.future;
}
```

- 优点：**零后端改动**，cookie 自动带上，当天就能跑通。
- 缺点：多一跳 JS 桥（约 +20~50ms）；要求 WebView 实例活着；不能离线预取；错误处理分散。

#### 方案 B —— 双轨 token（P1 末切换到，长期方案）

后端 `src/lib/auth.ts` 加一个分支，让 `Authorization: Bearer` 和 cookie 走同一张 `sessions` 表：

```ts
export async function readSessionFromContext(ctx: APIContext) {
  const auth = ctx.request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return readSessionId(auth.slice(7));
  }
  return readSessionId(getCookie(ctx, authCookieName));
}
```

token 的获取时机：网页登录成功后，由网页侧 JS 主动向原生层推送。新增一个端点：

```
POST /api/app/session     (需 cookie 认证)
  → 200 { token: "<sessionId>", expiresAt: "..." }
```

WebView 里跑的注入脚本检测到 `window.FlutterBridge` 存在，就调一次并推给原生：

```js
if (window.FlutterBridge) {
  fetch('/api/app/session', { credentials: 'include' })
    .then(r => r.json())
    .then(d => FlutterBridge.postMessage(JSON.stringify({ type: 'token', payload: d })));
}
```

原生存进 `flutter_secure_storage`。此后原生页直连 API，请求头带 `Authorization: Bearer <token>`。

- 优点：原生页干净、可离线缓存、可预取、不依赖 WebView 存活。
- 成本：后端约半天（新端点 + auth 分支），`sessions` 表已有，不需要新建表。

#### 明确不做：把 cookie 改成非 httpOnly

那会让网页本身失去 XSS 防线，为了 app 牺牲 web 安全，不值。

### 5.3 路由分工表

| 页面 | 路径 | P0 | P1 | 说明 |
|---|---|---|---|---|
| 看见（首页 feed） | `/` | WebView | **原生** | 最高价值，列表滚动 |
| 出发 | left-nav 第二入口 | WebView | WebView | 先看数据形态再决定 |
| 关注 | `/following` | WebView | WebView | |
| 帖子详情 | `/t/[id]/[slug]` | WebView | **原生** | 阅读体验核心 |
| 分类列表 | `/c/[slug]`、`/t/[id]` | WebView | WebView | P2 候选 |
| 标签 | `/tag/[slug]` | WebView | WebView | |
| 搜索 | `/search` | WebView | WebView | |
| 新建 / 编辑帖 | `public-topic-form` 所在页 | WebView | WebView | 编辑器复杂，P2 再说 |
| 登录 / 注册 / 找回 | `/login` 等 | WebView | WebView | P0 必须能登 |
| 个人主页 | `/u/[username]` | WebView | WebView | |
| 设置 | `/settings/*` | WebView | WebView | |
| 通知 | `/notifications` | WebView | WebView | P2 原生候选 |
| 管理后台 | `/admin/*` | **系统浏览器** | 同 | 不该占 app 主流程 |
| agent-zone | `/agent-zone/*` | WebView | WebView | 桌面场景为主 |
| 邀请 / 绑定链接 | `/a/[code]`、`/a/b/[code]` | 系统浏览器 | 同 | 后续做深度链接 |
| 其他域名 | `*` | 系统浏览器 | 同 | 必须拦截 |

### 5.4 底部 Tab

按 `left-nav-recommendation-design.md` 的三入口映射，四个 tab：

**看见 · 出发 · 关注 · 我**

- 不加中间悬浮发帖按钮 —— 发帖是低频动作，放「看见」页右上角或「我」里面。
- 每个 tab 内部维护独立导航栈（iOS 惯例）。
- Tab 切换不重建 WebView 实例，用 `IndexedStack` 保活，否则每次切换都重新加载网页。

### 5.5 导航栏归属

**默认策略：WebView 页不用原生 AppBar，保留网页自己的 `.site-header`。**

理由：`.site-header` 已经有完整移动端样式（sticky、58px 高、搜索/语言/用户菜单齐备）。如果隐藏它改用原生 AppBar，就要在原生侧重新实现搜索、语言切换、用户菜单三个入口 —— 白干活。

**原生页自带 AppBar。** 原生页与 WebView 页混排时，对 WebView 按需注入：

```dart
..injectCSSCode(code: '''
  .site-header { display: none !important; }
  .site-shell { padding-top: 0 !important; }
  body { padding-bottom: env(safe-area-inset-bottom); }
''')
```

注入的 CSS 必须集中在 `lib/web/injected_css.dart` 一个文件里，选择器保持最小集并加注释 —— 网页 DOM 一改就可能失效，集中放才查得到。

**原则：app 适配不污染网站代码。** 所有视觉调整靠注入完成，`whyisee-community/app/` 里不为 app 新增任何样式分支。

### 5.6 返回键与手势

Android 硬件返回，三级判断：

```dart
if (nativeNavigator.canPop()) return nativeNavigator.pop();
if (await webController.canGoBack()) return webController.goBack();
if (currentTab != TabHome) return switchTo(TabHome);
if (lastPress + 2s > now) return SystemNavigator.pop();
toast('再按一次退出'); lastPress = now;
```

iOS 侧滑返回：WKWebView 需显式开启 `allowsBackForwardNavigationGestures = true`，否则手势失效。

### 5.7 主题与安全区

站点固定深色（`responsive.css` 里全是 `rgba(17, 22, 31)` 一类值，无 `prefers-color-scheme`）。所以 app 不做深浅切换，固定深色：

```dart
SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
  statusBarColor: Colors.transparent,
  statusBarIconBrightness: Brightness.light,      // 深底亮字
  systemNavigationBarColor: Color(0xFF11161F),
  systemNavigationBarIconBrightness: Brightness.light,
));
```

**前端必须改一处**：`src/layouts/BaseLayout.astro` 的 viewport 缺 `viewport-fit=cover`，导致 `env(safe-area-inset-*)` 在 WebView 内恒为 0，底部会被手势条压住。

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

这一条改动对网页在 iPhone Safari 上也有正面收益，不只是为 app。

### 5.8 JS 桥协议

统一 envelope，只接受白名单类型：

```json
{ "type": "navigate | token | share | toast | haptic", "payload": { } }
```

Dart 侧必须做的两条防护：

1. `type` 白名单校验，未识别类型直接丢弃。
2. `payload` 序列化长度上限（比如 1 MB），防止网页被注入后乱推大数据卡死主线程。

### 5.9 外链拦截

```dart
NavigationDecision _onNavigationRequest(NavigationRequest req) {
  final uri = Uri.parse(req.url);
  const allowed = {'whyisee.xyz', 'www.whyisee.xyz'};
  if (uri.host.isEmpty || allowed.contains(uri.host)) {
    return NavigationDecision.navigate;   // 含 about:blank 等内部请求
  }
  launchUrl(uri, mode: LaunchMode.externalApplication);
  return NavigationDecision.prevent;
}
```

必须做。帖子正文 markdown 里的外链如果不拦，用户会被困在一个没有地址栏、退不出去的 WebView 里。

### 5.10 上传与相机

发帖配图、改头像走 `<input type="file">`。

- Android：`webview_flutter` 默认已接 `onShowFileChooser`，可用。
- iOS：必须在 `ios/Runner/Info.plist` 声明，否则**直接崩溃**而不是报错：
  - `NSCameraUsageDescription`
  - `NSPhotoLibraryUsageDescription`

### 5.11 缓存与离线

- P0：不做。
- P2：Astro SSR 的 HTML 不缓存，但静态资源（CSS/JS/图片）走 HTTP 缓存有效。原生 feed 页可做本地首屏缓存，冷启动先渲染上次数据再刷新。

---

## 6. 网页侧改动清单

**P0 必须（1 处）**

1. `src/layouts/BaseLayout.astro`：viewport 加 `viewport-fit=cover`。

**P1 需要（1 处）**

2. `src/lib/auth.ts`：加 `readSessionFromContext()`，支持 `Authorization: Bearer` 分支。
3. 新增 `POST /api/app/session`：cookie 认证后返回当前 `sessionId` 作为 token。

**上架前需要**

4. `public/.well-known/apple-app-site-association` + `assetlinks.json`（深度链接，P2）。
5. 隐私政策页（应用商店强制）。

**明确不改**

- 不为了 app 改任何现有页面的结构和样式。
- 不把 Astro 改成 SPA。
- 不重写一套 JSON API（只在 auth 层加一个分支）。
- 不维护第二套前端。

---

## 7. 工程结构

**新目录 `whyisee-app/`，与 `whyisee-community/` 平级，不进同一个仓库目录树。**

```
whyisee-app/
├── lib/
│   ├── main.dart
│   ├── shell/
│   │   ├── home_shell.dart       底部 tab + IndexedStack 保活
│   │   ├── back_handler.dart     返回键三级判断
│   │   └── theme.dart            深色固定主题、状态栏
│   ├── web/
│   │   ├── web_page.dart         WebView 容器 + 错误页
│   │   ├── bridge.dart           JS 通道与白名单
│   │   ├── navigation_delegate.dart
│   │   └── injected_css.dart     注入样式（集中管理）
│   ├── native/
│   │   ├── feed/                 看见 feed（P1）
│   │   └── topic/                帖子详情（P1）
│   ├── api/
│   │   ├── client.dart
│   │   └── auth_store.dart       flutter_secure_storage
│   └── models/
├── android/
├── ios/
└── pubspec.yaml
```

依赖：

| 包 | 用途 |
|---|---|
| `webview_flutter` | P0/P1；功能不够时换 `flutter_inappwebview` |
| `flutter_secure_storage` | token |
| `http` 或 `dio` | 原生页请求 |
| `url_launcher` | 外链跳系统浏览器 |
| `intl` | 时间格式化，对齐网页 `src/lib/format.ts` |

---

## 8. 分期与验收

### P0（1 天）纯壳

产出：能装到手机的 apk。

验收项：

- [ ] 启动直达看见页，列表可滚动
- [ ] 点进帖子详情，能进能退
- [ ] 登录后能发一条回复
- [ ] 返回键：先退网页栈，再到首页，再按退出
- [ ] 外链跳系统浏览器
- [ ] 断网时有原生错误页 + 重试
- [ ] 深色无白闪
- [ ] 底部不被手势条遮挡

这 8 条过了，壳就能日常用。

### P1（1 周）原生 feed + 帖子详情

- [ ] 底部 4 tab 切换不重新加载网页（IndexedStack）
- [ ] 原生 feed 下拉刷新 + 上滑加载
- [ ] 帖子详情渲染 markdown、图片、代码块、外链
- [ ] 原生页与网页版数据一致（同一接口、同一排序）
- [ ] 登录态在原生页和 WebView 间共享（方案 B 已切）
- [ ] 原生页进入 WebView 页时导航栏无重影

### P2（按需触发，不预设时间）

- 推送：FCM + 国内厂商通道（小米/华为/OPPO/vivo 各一套，这块工作量比预期大）
- 发帖编辑器原生
- 离线缓存
- iOS 上架（先解决审核问题，见 §9）

---

## 9. 风险登记

| 风险 | 概率 | 影响 | 对策 |
|---|---|---|---|
| **iOS 审核 4.2 拒绝纯壳** | 高 | 无法上架 | P1 完成 2 个原生页 + 推送后再提审。纯壳提审基本必拒 |
| Astro `allowedDomains` 403 | 已确认存在 | 白屏 | 只用远程 URL，绝不打包本地资源 |
| httpOnly cookie 拿不到 | 已确认存在 | 原生页无法认证 | §5.2 方案 A → B |
| 无 `viewport-fit=cover` | 已确认存在 | 底部被手势条压 | §6 第 1 条 |
| 深色站 + WebView 白闪 | 高 | 观感差 | `setBackgroundColor(0xFF11161F)` |
| 注入 CSS 失效 | 中 | 样式错乱 | 集中单文件 + 最小选择器 + 注释 |
| 网页 DOM 改名导致桥接断 | 中 | 原生页白屏 | 桥协议只依赖 `window.FlutterBridge` 一个入口，不依赖任何 DOM 结构 |
| Flutter 大版本升级断裂 | 低 | 编译不过 | 每年至少 2 次升级，别堆着 |
| 国内厂商推送通道碎片化 | 高 | P2 工期超预期 | 一期可以只做应用内通知，不做系统推送 |

---

## 10. 明确不做

- ❌ 全量原生重写 50+ 页面
- ❌ 把 Astro 改造成 SPA
- ❌ 要求后端重写一套客户端专用 JSON API
- ❌ 为 app 单独维护一套前端分支
- ❌ 做管理后台的 app 版本
- ❌ 首期做 iOS（先安卓自用验证，避免被审核卡住）
- ❌ 首期做推送（通道碎片化，是独立工程）

---

## 11. 一句话给未来的自己

**这个 app 的价值不在"有 app"，在"能在桌面图标那一点就进去"。** 只要这点成立，WebView 就够了。原生页面是体验优化，不是目标。任何一次"干脆全重写"的冲动，先回去看 §3 ADR-1 的第二段。
