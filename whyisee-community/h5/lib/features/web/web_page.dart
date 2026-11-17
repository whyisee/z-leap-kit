import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/env.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';
import 'web_registry.dart';

/// P0 的页面容器：远程 URL + 错误兜底 + 外链拦截 + JS 桥。
///
/// P1 起只有「看见」「帖子详情」会换成原生页，其余页面继续用这个容器。
class WebTabPage extends ConsumerStatefulWidget {
  const WebTabPage({
    super.key,
    required this.tabIndex,
    required this.path,
    this.showLoadingBar = true,
  });

  /// 用于登记控制器，返回键要按 tab 找对应的网页栈。
  final int tabIndex;

  /// 站内路径，如 '/'、'/go'、'/following'、'/settings'。
  final String path;

  final bool showLoadingBar;

  @override
  ConsumerState<WebTabPage> createState() => WebTabPageState();
}

class WebTabPageState extends ConsumerState<WebTabPage> {
  late final WebViewController _controller;
  bool _failed = false;
  String _errorMessage = '';
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      // 站点是深色，WebView 默认白底，每次加载会闪一下白（见 §5.1）
      ..setBackgroundColor(const Color(Env.bg))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (value) {
            if (!mounted || !widget.showLoadingBar) return;
            setState(() => _progress = value / 100);
          },
          onNavigationRequest: _decideNavigation,
          onWebResourceError: _onResourceError,
          onPageFinished: (_) {
            if (mounted) setState(() => _failed = false);
          },
        ),
      )
      ..addJavaScriptChannel('FlutterBridge', onMessageReceived: _onBridgeMessage)
      ..loadRequest(Env.uri(widget.path));

    WebTabRegistry.register(widget.tabIndex, _controller);
  }

  @override
  void dispose() {
    WebTabRegistry.unregister(widget.tabIndex, _controller);
    super.dispose();
  }

  NavigationDecision _decideNavigation(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);

    // about:blank、data:、blob: 这类内部请求没有 host，必须放行，否则页面自己会挂
    if (uri == null || uri.host.isEmpty) return NavigationDecision.navigate;
    if (Env.allowedHosts.contains(uri.host)) return NavigationDecision.navigate;

    // 帖子正文里的外链不拦，用户会困在没有地址栏、退不出去的 WebView 里
    launchUrl(uri, mode: LaunchMode.externalApplication);
    return NavigationDecision.prevent;
  }

  void _onResourceError(WebResourceError error) {
    // 子资源（图片、字体）失败不该整页报错，只看主文档
    if (error.isForMainFrame == false) return;
    if (!mounted) return;
    setState(() {
      _failed = true;
      _errorMessage = error.description;
    });
  }

  void _onBridgeMessage(JavaScriptMessage message) {
    // 桥协议：只认白名单类型，payload 过大直接丢（见 §5.8）
    if (message.message.length > 1024 * 1024) return;

    Object? decoded;
    try {
      decoded = jsonDecode(message.message);
    } catch (_) {
      return;
    }
    if (decoded is! Map) return;

    switch (decoded['type']) {
      case 'toast':
        final text = (decoded['payload'] as Map?)?['text'];
        if (text is String && text.isNotEmpty) {
          ScaffoldMessenger.maybeOf(context)?.showSnackBar(
            SnackBar(content: Text(text), behavior: SnackBarBehavior.floating),
          );
        }
        break;
      case 'token':
        // 网页登录成功后由 AppTokenBridge 推过来，落盘后原生页立刻是登录态
        final payload = (decoded['payload'] as Map?)?.cast<String, dynamic>();
        final token = payload?['token'] as String?;
        if (token == null || token.isEmpty) break;
        final expiresAt = DateTime.tryParse(payload?['expiresAt'] as String? ?? '');
        ref.read(sessionProvider.notifier).adopt(token, expiresAt);
        break;
      // share / haptic 在 P2 接入，收到也不处理，避免半成品逻辑
      default:
        break;
    }
  }

  void reload() {
    setState(() {
      _failed = false;
      _progress = 0;
    });
    _controller.loadRequest(Env.uri(widget.path));
  }

  Future<bool> canGoBack() => _controller.canGoBack();

  Future<void> goBack() => _controller.goBack();

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        if (_failed)
          ErrorView(
            title: '打不开页面',
            message: _errorMessage.isEmpty ? '网络好像不通，检查一下再试。' : _errorMessage,
            onRetry: reload,
          )
        else
          WebViewWidget(controller: _controller),
        if (!_failed && widget.showLoadingBar && _progress < 1)
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: LinearProgressIndicator(
              value: _progress == 0 ? null : _progress,
              minHeight: 2,
              backgroundColor: Colors.transparent,
              color: const Color(Env.blue),
            ),
          ),
      ],
    );
  }
}
