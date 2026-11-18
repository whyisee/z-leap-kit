import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'api/api_client.dart';
import 'api/models.dart';
import 'api/token_store.dart';

/// 登录态。`unknown` 是启动瞬间的初始值，UI 用它决定显示骨架还是内容。
enum SessionStatus { unknown, signedOut, signedIn }

class SessionUser {
  const SessionUser({
    required this.id,
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.email,
    this.role,
  });

  final int id;
  final String username;
  final String displayName;
  final String? avatarUrl;
  final String? email;
  final String? role;

  factory SessionUser.fromJson(Map<String, dynamic> json) => SessionUser(
        id: (json['id'] as num?)?.toInt() ?? 0,
        username: json['username'] as String? ?? '',
        displayName: (json['displayName'] as String?)?.trim().isNotEmpty == true
            ? json['displayName'] as String
            : (json['username'] as String? ?? ''),
        avatarUrl: json['avatarUrl'] as String?,
        email: json['email'] as String?,
        role: json['role'] as String?,
      );

  Author toAuthor() => Author(
        id: id,
        username: username,
        displayName: displayName,
        avatarUrl: avatarUrl,
        role: role,
      );
}

class SessionState {
  const SessionState({
    required this.status,
    this.user,
    this.unreadCount = 0,
  });

  const SessionState.unknown()
      : status = SessionStatus.unknown,
        user = null,
        unreadCount = 0;

  final SessionStatus status;
  final SessionUser? user;
  final int unreadCount;

  bool get isSignedIn => status == SessionStatus.signedIn && user != null;

  SessionState copyWith({
    SessionStatus? status,
    SessionUser? user,
    int? unreadCount,
  }) =>
      SessionState(
        status: status ?? this.status,
        user: user ?? this.user,
        unreadCount: unreadCount ?? this.unreadCount,
      );
}

final tokenStoreProvider = Provider<TokenStore>((ref) => TokenStore());

final apiClientProvider = Provider<ApiClient>((ref) {
  final client = ApiClient(ref.watch(tokenStoreProvider));
  // 401 统一在这里兜底，页面不需要各自处理登出
  client.onUnauthorized = () => ref.read(sessionProvider.notifier).markSignedOut();
  return client;
});

final sessionProvider =
    NotifierProvider<SessionController, SessionState>(SessionController.new);

class SessionController extends Notifier<SessionState> {
  @override
  SessionState build() {
    unawaited(_restore());
    return const SessionState.unknown();
  }

  ApiClient get _api => ref.read(apiClientProvider);

  /// 启动时若有可用 token，直接换回用户；失败不打扰用户，静默降级为未登录。
  Future<void> _restore() async {
    final store = ref.read(tokenStoreProvider);
    await store.load();

    if (!store.isUsable) {
      state = const SessionState(status: SessionStatus.signedOut);
      return;
    }

    try {
      final payload = await _api.get('/auth/me');
      state = SessionState(
        status: SessionStatus.signedIn,
        user: SessionUser.fromJson(
          (payload.data['user'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        unreadCount: (payload.data['unreadCount'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      state = const SessionState(status: SessionStatus.signedOut);
    }
  }

  Future<void> signIn(String identifier, String password) async {
    final payload = await _api.post('/auth/login', body: {
      'identifier': identifier,
      'password': password,
      'platform': 'app',
    });

    await _adoptTokenPayload(payload.data);
  }

  /// 注册。校验在服务端（邀请码、用户名格式、邮箱唯一），这里不做本地预判 ——
  /// 预判漏一条，用户就会看到「本地说没问题、服务端说不行」。
  Future<void> signUp({
    required String username,
    required String email,
    required String password,
    required String inviteCode,
  }) async {
    final payload = await _api.post('/auth/signup', body: {
      'username': username,
      'email': email,
      'password': password,
      'inviteCode': inviteCode,
      'platform': 'app',
    });

    await _adoptTokenPayload(payload.data);
  }

  /// 登录 / 注册回的是同一副样子：token + expiresAt + user。
  Future<void> _adoptTokenPayload(Map<String, dynamic> data) async {
    final token = data['token'] as String?;
    if (token == null || token.isEmpty) {
      throw StateError('登录成功但没拿到 token');
    }

    final expiresAt = DateTime.tryParse(data['expiresAt'] as String? ?? '');
    await ref.read(tokenStoreProvider).save(token, expiresAt: expiresAt);

    state = SessionState(
      status: SessionStatus.signedIn,
      user: SessionUser.fromJson(
        (data['user'] as Map?)?.cast<String, dynamic>() ?? const {},
      ),
      unreadCount: state.unreadCount,
    );
  }

  /// WebView 里网页登录成功后，由 JS 桥推过来的 token（同一个 sessionId）。
  Future<void> adopt(String token, DateTime? expiresAt) async {
    if (token.isEmpty) return;
    if (ref.read(tokenStoreProvider).token == token) return;

    await ref.read(tokenStoreProvider).save(token, expiresAt: expiresAt);
    try {
      final payload = await _api.get('/auth/me');
      state = SessionState(
        status: SessionStatus.signedIn,
        user: SessionUser.fromJson(
          (payload.data['user'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        unreadCount: (payload.data['unreadCount'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      // token 拿到但用不了（已失效），保持未登录
      await ref.read(tokenStoreProvider).clear();
    }
  }

  Future<void> refreshMe() async {
    if (!ref.read(tokenStoreProvider).isUsable) return;
    try {
      final payload = await _api.get('/auth/me');
      state = state.copyWith(
        user: SessionUser.fromJson(
          (payload.data['user'] as Map?)?.cast<String, dynamic>() ?? const {},
        ),
        unreadCount: (payload.data['unreadCount'] as num?)?.toInt() ?? 0,
      );
    } catch (_) {
      // 静默失败，不打断当前操作
    }
  }

  Future<void> signOut() async {
    try {
      await _api.post('/auth/logout');
    } catch (_) {
      // 网络失败也要清本地，否则用户卡在“退不出去”的状态
    }
    await ref.read(tokenStoreProvider).clear();
    state = const SessionState(status: SessionStatus.signedOut);
  }

  /// 401 由 ApiClient 回调进来：只清状态，不再发请求（避免递归）。
  void markSignedOut() {
    if (state.status != SessionStatus.signedIn) return;
    state = const SessionState(status: SessionStatus.signedOut);
  }
}
