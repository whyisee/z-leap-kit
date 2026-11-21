import 'env.dart';

/// 外部链接 → App 路由的换算规则。
///
/// 深链有三个入口：冷启动（`defaultRouteName`）、热启动（引擎推一条新路由）、
/// WebView 里点站内链接。三套机制不一样，但「网页地址对应哪个原生页」这条规则
/// 必须只有一份 —— 否则就会出现「通知点得进去、分享链接点不进去」这种差异。
///
/// 认得的路径走原生；认不得的站内页面退到内置网页容器（`/web?path=`），
/// 用户不会停在 404 或空白页。
String resolveDeepLink(String location) {
  final raw = location.trim();
  if (raw.isEmpty) return '/';

  final uri = Uri.tryParse(raw);
  if (uri == null) return raw;

  // 自定义 scheme 只服务「App Links 还没校验通过」的兜底，
  // 形如 whyisee://open/t/97 ，host 只是占位，真正的路径在 path 上。
  if (uri.scheme == 'whyisee') {
    final path = uri.path.isEmpty ? '/' : uri.path;
    return mapWebLocation(uri.replace(path: path)) ?? '/';
  }

  if (uri.scheme != 'http' && uri.scheme != 'https') {
    // 相对路由：可能是网页形状（WebView 里抓到的 href），也可能已经是原生路由
    return mapWebLocation(uri) ?? raw;
  }

  // 站外地址不接管：用户点的是别人的链接，硬塞进 App 只会显示一个空壳
  if (!Env.allowedHosts.contains(uri.host)) return raw;

  return mapWebLocation(uri) ?? webContainerLocation(uri);
}

/// 网页路径 → 原生路由。返回 null 表示「这条路径没有对应规则」。
///
/// 只认路径和少量参数，其余 query（utm、来源标记之类）一律丢掉：
/// 原生页不读它们，带过去只会在返回时污染 history。
String? mapWebLocation(Uri uri) {
  final path = uri.path.isEmpty ? '/' : uri.path;
  final seg = path.split('/').where((s) => s.isNotEmpty).toList(growable: false);

  switch (path) {
    case '/':
      return '/';
    // 看见 / 最新：和首页同一个流，App 里没有第二份列表
    case '/see':
    case '/latest':
      return '/';
    case '/following':
      return '/following';
    case '/go':
      return '/go';
    case '/projects':
      return '/projects';
    case '/agent-zone':
      return '/agent-zone';
    case '/about':
      return '/about';
    case '/guidelines':
      return '/guidelines';
    case '/categories':
      return '/categories';
    // 网页通知页 → 原生通知（「我」这条栈下）
    case '/notifications':
      return '/me/notifications';
    // 网页发帖页 → 原生编辑器
    case '/new-topic':
      return '/compose';
    case '/login':
      return '/login';
    case '/signup':
      return '/signup';
    case '/forgot-password':
      return '/forgot-password';
    // 下载引导页在 App 里没有意义，落到「关于」
    case '/app':
      return '/about';
  }

  if (seg.isEmpty) return '/';

  switch (seg[0]) {
    // 话题：/t/97 与 /t/97/slug 都算；锚点 #post-3 换成 ?post=3
    case 't':
      if (seg.length < 2) return null;
      final id = int.tryParse(seg[1]);
      if (id == null) return null;
      final post = _postNumber(uri);
      return post == null ? '/t/$id' : '/t/$id?post=$post';

    case 'c':
      return seg.length < 2 ? null : '/c/${_slug(seg[1])}';
    case 'tag':
      return seg.length < 2 ? null : '/tag/${_slug(seg[1])}';
    case 'u':
      return seg.length < 2 ? null : '/u/${Uri.encodeComponent(Uri.decodeComponent(seg[1]))}';

    case 'search':
      return _withQuery('/search', uri);
    case 'reset-password':
      return _withQuery('/reset-password', uri);

    // 设置：三项是原生页，其余（含 /settings 首页）回「我」
    case 'settings':
      switch (seg.length >= 2 ? seg[1] : '') {
        case 'profile':
          return '/settings/profile';
        case 'account':
          return '/settings/account';
        case 'agents':
          return '/settings/agents';
      }
      return '/me';

    case 'agent-zone':
      if (seg.length >= 3 && seg[1] == 'agents') {
        final id = int.tryParse(seg[2]);
        return id == null ? null : '/agent-zone/agents/$id';
      }
      if (seg.length >= 3 && seg[1] == 'tasks') {
        if (seg[2] == 'new') return '/agent-zone/tasks/new';
        final id = int.tryParse(seg[2]);
        return id == null ? null : '/agent-zone/tasks/$id';
      }
      // /agent-zone/plaza、/academy/skills/x 这些还没有原生详情，回专区首页
      return '/agent-zone';

    // 网页的「编辑话题」→ 原生编辑页
    case 'topics':
      if (seg.length >= 3 && seg[2] == 'edit') {
        final id = int.tryParse(seg[1]);
        return id == null ? null : '/compose/edit/$id';
      }
      return null;
  }

  return null;
}

/// 不认识的站内页面，塞进内置网页容器。
///
/// 只带路径和 query，不带 fragment：容器里再定位锚点会二次滚动，
/// 而用户点进来时已经不知道自己落在哪了。
String webContainerLocation(Uri uri) {
  final path = uri.path.isEmpty ? '/' : uri.path;
  final target = uri.hasQuery ? '$path?${uri.query}' : path;
  return '/web?path=${Uri.encodeComponent(target)}';
}

/// 回复锚点：网页是 `/t/12#post-3`，也支持 `/t/12?post=3`
int? _postNumber(Uri uri) {
  final match = RegExp(r'^post-(\d+)$').firstMatch(uri.fragment);
  final raw = match?.group(1) ?? uri.queryParameters['post'];
  final value = int.tryParse(raw ?? '');
  return value == null || value <= 0 ? null : value;
}

/// 中文 slug 在地址里是百分号编码：先解码再编码，别把 `%E8%B7%AF` 当路径的一部分
String _slug(String raw) => Uri.encodeComponent(Uri.decodeComponent(raw));

String _withQuery(String path, Uri uri) => uri.hasQuery ? '$path?${uri.query}' : path;
