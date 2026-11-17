import 'package:shared_preferences/shared_preferences.dart';

/// app 会话 token 的本地存放。
///
/// token 就是服务端的 `sessions.id`（43 位 base64url，90 天有效），
/// 不做 JWT 解析，客户端只当不透明串用。
///
/// 存 SharedPreferences 而不是 Keystore：单机、单账号、无需跨应用共享，
/// 换取零平台配置成本。若后续要支持多账号，换成 secure_storage 即可，
/// 调用方只依赖这里的三个方法。
class TokenStore {
  static const _tokenKey = 'whyisee.session.token';
  static const _expiresKey = 'whyisee.session.expiresAt';

  String? _token;
  DateTime? _expiresAt;
  bool _loaded = false;

  String? get token => _token;

  /// 提前 7 天视为过期，避免临界点请求白白 401 一次。
  bool get isUsable {
    final t = _token;
    if (t == null || t.isEmpty) return false;
    final exp = _expiresAt;
    if (exp == null) return true;
    return exp.isAfter(DateTime.now().add(const Duration(days: 7)));
  }

  Future<void> load() async {
    if (_loaded) return;
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString(_tokenKey);
    final raw = prefs.getString(_expiresKey);
    _expiresAt = raw == null ? null : DateTime.tryParse(raw);
    _loaded = true;
  }

  Future<void> save(String token, {DateTime? expiresAt}) async {
    _token = token;
    _expiresAt = expiresAt;
    _loaded = true;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_tokenKey, token);
    if (expiresAt == null) {
      await prefs.remove(_expiresKey);
    } else {
      await prefs.setString(_expiresKey, expiresAt.toIso8601String());
    }
  }

  Future<void> clear() async {
    _token = null;
    _expiresAt = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_tokenKey);
    await prefs.remove(_expiresKey);
  }
}
