import '../../core/api/api_client.dart';
import '../../core/api/api_exception.dart';
import '../../core/providers.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// 找回密码两段（发邮件 / 拿 token 改密）。
///
/// 注册不在这里：它登录完就是「已登录」，走 `sessionProvider.signUp`，
/// 否则要写两遍「存 token + 更新会话状态」。
class AuthRepository {
  AuthRepository(this._api);

  final ApiClient _api;

  /// 发起找回。服务端无论账号是否存在都回 `sent: true`，不要再做二次判断。
  Future<String?> requestReset(String identifier) async {
    final payload = await _api.post(
      '/auth/password-reset/request',
      body: {'identifier': identifier},
    );

    return payload.data['debugToken'] as String?;
  }

  Future<void> confirmReset({required String token, required String password}) {
    return _api.post(
      '/auth/password-reset/confirm',
      body: {'token': token, 'password': password},
    );
  }
}

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepository(ref.watch(apiClientProvider)),
);

/// 把服务端的错误码翻成人话。注册 / 找回 / 重置三处共用。
String authErrorText(ApiException error) {
  return switch (error.code) {
    'unauthorized' || 'invalid_credentials' => '账号或密码不对，再试一次',
    'rate_limited' => '试得太频繁了，过一会儿再来',
    'validation_failed' => error.message.isNotEmpty ? error.message : '填的内容有问题，检查一下',
    _ => error.isNetwork ? '网络不通，检查一下再试' : error.message,
  };
}
