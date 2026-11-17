import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:material_ui/material_ui.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../../../core/env.dart';

/// 正文渲染器：把服务端给的 `contentHtml` 塞进一个带站点样式的文档里跑。
///
/// 为什么不用 Dart 重写 markdown → widget：网页侧的图片 grid、@提及、代码块高亮
/// 都是服务端产出的 HTML，在客户端重新实现一遍必然走样（见设计文档 §4.6）。
///
/// 关键是高度：WebView 自己不会告诉 Flutter 内容多高。这里注入 JS 测量
/// `scrollHeight` 并通过 JS 通道回传，父级据此设置高度，让正文像普通 widget
/// 一样在页面滚动流里自然展开，而不是一个内部可滚的小窗口。
class ArticleWebView extends StatefulWidget {
  const ArticleWebView({super.key, required this.html});

  final String html;

  @override
  State<ArticleWebView> createState() => _ArticleWebViewState();
}

class _ArticleWebViewState extends State<ArticleWebView> {
  static const _channel = 'ContentMetrics';

  late final WebViewController _controller;
  double _height = 320;

  /// 高度上报会抖：WebView 首次 attach 时宽度还没定型，文字按极窄宽度换行，
  /// 量出来会是正常值的十倍（实测 750 → 7680）。这里攒 120ms 只取最后一次，
  /// 等宽度稳定后的正确值把抖动值覆盖掉。
  Timer? _settleTimer;
  double? _pending;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(Env.bg))
      ..addJavaScriptChannel(_channel, onMessageReceived: _onMetrics)
      ..loadHtmlString(_buildDocument(widget.html), baseUrl: Env.siteBase);
  }

  @override
  void dispose() {
    _settleTimer?.cancel();
    super.dispose();
  }

  void _onMetrics(JavaScriptMessage message) {
    final raw = double.tryParse(message.message.trim());
    if (raw == null || raw < 40) return;
    // 夹一层上限：异常长的文章不至于把列表撑爆
    _pending = raw.clamp(80.0, 30000.0);
    _settleTimer?.cancel();
    _settleTimer = Timer(const Duration(milliseconds: 120), _applyHeight);
  }

  void _applyHeight() {
    final next = _pending;
    if (next == null) return;
    if ((next - _height).abs() < 1) return;
    if (!mounted) return;
    if (kDebugMode) debugPrint('[article] height=${next.toStringAsFixed(0)}');
    setState(() => _height = next);
  }

  @override
  void didUpdateWidget(covariant ArticleWebView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.html != widget.html) {
      _controller.loadHtmlString(_buildDocument(widget.html), baseUrl: Env.siteBase);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Android 上必须用 Hybrid Composition（SurfaceView），不能用默认的纹理合成。
    // 默认模式把 WebView 画到 SurfaceTexture 再当作 Flutter 图层合成，
    // 在部分设备上会出现「DOM 有内容、高度正常，但屏幕一片黑」——正文区看起来全白。
    // 这是插件的已知限制，见 AndroidWebViewWidgetCreationParams.displayWithHybridComposition 文档。
    if (defaultTargetPlatform == TargetPlatform.android &&
        _controller.platform is AndroidWebViewController) {
      return SizedBox(
        height: _height,
        child: WebViewWidget.fromPlatformCreationParams(
          params: AndroidWebViewWidgetCreationParams(
            controller: _controller.platform,
            displayWithHybridComposition: true,
          ),
        ),
      );
    }
    return SizedBox(height: _height, child: WebViewWidget(controller: _controller));
  }

  static String _buildDocument(String contentHtml) => '''
<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no">
<style>
  :root { color-scheme: dark; }
  html, body { margin: 0; padding: 0; background: #0d1016; }
  body {
    color: #f0f3f7;
    font: 400 15.5px/1.78 -apple-system, BlinkMacSystemFont, "PingFang SC", "Noto Sans CJK SC", sans-serif;
    overflow-x: hidden;
    overflow-wrap: break-word;
    -webkit-text-size-adjust: 100%;
  }
  a { color: #8ab4f8; text-decoration: none; }
  img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin: 12px 0; }
  p { margin: 0 0 14px; }
  /* 首个元素的 margin-top 会折叠到 body 外，表现为正文上方莫名多出 20px 空隙 */
  body > :first-child { margin-top: 0; }
  h1, h2, h3, h4 { line-height: 1.42; margin: 22px 0 10px; font-weight: 600; }
  h1 { font-size: 19px; } h2 { font-size: 17.5px; } h3 { font-size: 16px; }
  blockquote { margin: 14px 0; padding: 2px 14px; border-left: 2px solid #2c3340; color: #a9b1bc; }
  code { background: #1d222c; padding: 1px 5px; border-radius: 4px; font-size: 13.5px; font-family: ui-monospace, Menlo, monospace; }
  pre { background: #141821; padding: 12px; border-radius: 8px; overflow-x: auto; }
  pre code { background: none; padding: 0; }
  ul, ol { padding-left: 22px; margin: 0 0 14px; }
  li { margin: 4px 0; }
  hr { border: none; border-top: 1px solid rgba(255,255,255,.09); margin: 20px 0; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
  th, td { border: 1px solid rgba(255,255,255,.09); padding: 6px 8px; text-align: left; }
  figure { margin: 12px 0; } figcaption { font-size: 12px; color: #8a94a6; text-align: center; }
</style>
</head>
<body>
$contentHtml
<script>
(function () {
  var last = 0;
  function measure() {
    // 宽度还没定型时（WebView 刚 attach），文字按极窄宽度换行，量出来是废数，
    // 直接不报，等 ResizeObserver 在宽度正常后触发。
    if ((window.innerWidth || 0) < 60) return 0;
    var b = document.body;
    // 只量 body：documentElement.scrollHeight 至少等于视口高度，
    // 一旦父级把 WebView 撑高，它会把撑高后的视口高度报回来，导致只增不减。
    return Math.ceil(Math.max(b.scrollHeight, b.getBoundingClientRect().height));
  }
  function report() {
    var h = measure();
    if (!h) return;
    if (Math.abs(h - last) >= 1) {
      last = h;
      window.$_channel.postMessage(String(h));
    }
  }
  window.addEventListener('load', report);
  document.addEventListener('DOMContentLoaded', report);
  if (window.ResizeObserver) { try { new ResizeObserver(report).observe(document.body); } catch (e) {} }
  var imgs = document.querySelectorAll('img');
  for (var i = 0; i < imgs.length; i++) {
    imgs[i].addEventListener('load', report);
    imgs[i].addEventListener('error', report);
  }
  setTimeout(report, 100);
  setTimeout(report, 600);
  setTimeout(report, 1500);
})();
</script>
</body></html>''';
}
