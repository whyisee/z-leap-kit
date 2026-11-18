/// 全局配置。所有环境差异只在这里出现，业务代码不读 Platform / 环境变量。
class Env {
  Env._();

  /// 站点根地址。app 只加载远程 URL，不打包网页资源（见 ADR-2）。
  ///
  /// 用 `--dart-define=SITE_BASE=http://127.0.0.1:4321` 可以让调试包指向本机，
  /// 配合 `adb reverse tcp:4321 tcp:4321` 在真机上验证还没部署的接口。默认仍是线上。
  static const String siteBase = String.fromEnvironment(
    'SITE_BASE',
    defaultValue: 'https://whyisee.xyz',
  );

  /// WebView 内允许停留的域名，其余一律交系统浏览器（见 §5.9）。
  static const Set<String> allowedHosts = {'whyisee.xyz', 'www.whyisee.xyz', '127.0.0.1'};

  /// 与 pubspec version 同源，服务端用 X-App-Version 判断是否需要强升。
  static const String appVersion = '0.1.0';

  /// 站点固定深色主题的真实取值，来自 app/src/styles/modules/foundation.css。
  static const int bg = 0xFF0D1016;
  static const int headerBg = 0xFF0F1118;
  static const int surface = 0xFF171B23;
  static const int panel = 0xFF1D222C;
  static const int line = 0x17FFFFFF; // rgba(255,255,255,0.09)
  static const int text = 0xFFF0F3F7;
  static const int muted = 0xFFA9B1BC;
  static const int blue = 0xFF8AB4F8;

  static Uri uri(String path) => Uri.parse('$siteBase$path');
}
