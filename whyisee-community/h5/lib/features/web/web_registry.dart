import 'package:webview_flutter/webview_flutter.dart';

/// 每个 tab 的 WebView 控制器登记表。
/// 返回键需要"当前 tab 的网页能不能后退"，而控制器活在 WebTabPage 的 State 里，
/// 壳层拿不到，所以在这里按 tab 索引登记一份引用。页面销毁时必须注销。
class WebTabRegistry {
  WebTabRegistry._();

  static final Map<int, WebViewController> _controllers = {};

  static void register(int tabIndex, WebViewController controller) {
    _controllers[tabIndex] = controller;
  }

  static void unregister(int tabIndex, WebViewController controller) {
    if (identical(_controllers[tabIndex], controller)) {
      _controllers.remove(tabIndex);
    }
  }

  static WebViewController? of(int tabIndex) => _controllers[tabIndex];
}
