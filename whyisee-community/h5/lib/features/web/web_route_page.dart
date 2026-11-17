import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:material_ui/material_ui.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../../core/env.dart';
import '../../core/providers.dart';
import '../errors/error_view.dart';

/// 被 push 进导航栈的网页页（设置、通知、公开主页这类低频页）。
///
/// 和 [WebTabPage] 的区别：这里的返回走 go_router 的 pop，所以自带 AppBar；
/// 不需要 tab 级控制器登记。P1 只做首页/详情原生，其余继续吃网页版。
class WebRoutePage extends ConsumerStatefulWidget {
  const WebRoutePage({
    super.key,
    required this.path,
    required this.title,
  });

  /// 站内路径，如 `/settings/profile`。
  final String path;
  final String title;

  @override
  ConsumerState<WebRoutePage> createState() => _WebRoutePageState();
}

class _WebRoutePageState extends ConsumerState<WebRoutePage> {
  late final WebViewController _controller;
  bool _failed = false;
  String _errorMessage = '';
  double _progress = 0;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(Env.bg))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (value) {
            if (mounted) setState(() => _progress = value / 100);
          },
          onNavigationRequest: _decideNavigation,
          onWebResourceError: (error) {
            if (error.isForMainFrame == false || !mounted) return;
            setState(() {
              _failed = true;
              _errorMessage = error.description;
            });
          },
          onPageFinished: (_) {
            if (mounted) setState(() => _failed = false);
          },
        ),
      )
      ..addJavaScriptChannel('FlutterBridge', onMessageReceived: _onBridgeMessage)
      ..loadRequest(Env.uri(widget.path));
  }

  NavigationDecision _decideNavigation(NavigationRequest request) {
    final uri = Uri.tryParse(request.url);
    if (uri == null || uri.host.isEmpty) return NavigationDecision.navigate;
    if (Env.allowedHosts.contains(uri.host)) return NavigationDecision.navigate;

    launchUrl(uri, mode: LaunchMode.externalApplication);
    return NavigationDecision.prevent;
  }

  void _onBridgeMessage(JavaScriptMessage message) {
    if (message.message.length > 1024 * 1024) return;

    Object? decoded;
    try {
      decoded = jsonDecode(message.message);
    } catch (_) {
      return;
    }
    if (decoded is! Map) return;

    // 设置页里没有登录入口，但网页登录态变化（例如改密码被踢）时也要跟手
    if (decoded['type'] == 'token') {
      final payload = (decoded['payload'] as Map?)?.cast<String, dynamic>();
      final token = payload?['token'] as String?;
      if (token == null || token.isEmpty) return;
      final expiresAt = DateTime.tryParse(payload?['expiresAt'] as String? ?? '');
      ref.read(sessionProvider.notifier).adopt(token, expiresAt);
    }
  }

  void _reload() {
    setState(() {
      _failed = false;
      _progress = 0;
    });
    _controller.loadRequest(Env.uri(widget.path));
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(Env.bg),
      appBar: AppBar(
        backgroundColor: const Color(Env.headerBg),
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        titleSpacing: 0,
        title: Text(
          widget.title,
          style: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
            color: Color(Env.text),
          ),
        ),
        iconTheme: const IconThemeData(color: Color(Env.text), size: 21),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(height: 1, color: const Color(Env.line)),
        ),
      ),
      body: Stack(
        children: [
          if (_failed)
            ErrorView(
              title: '打不开页面',
              message: _errorMessage.isEmpty ? '网络好像不通，检查一下再试。' : _errorMessage,
              onRetry: _reload,
            )
          else
            WebViewWidget(controller: _controller),
          if (!_failed && _progress < 1)
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
      ),
    );
  }
}
