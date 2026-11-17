/// `/api/v1` 的失败语义。
///
/// 服务端统一返回 `{ok:false, error:{code,message}, meta:{requestId}}`，
/// 客户端只依赖 `code` 做分支，`message` 直接给用户看。
class ApiException implements Exception {
  ApiException({
    required this.code,
    required this.message,
    this.statusCode,
    this.requestId,
    this.fields,
  });

  final String code;
  final String message;
  final int? statusCode;
  final String? requestId;
  final Map<String, String>? fields;

  /// token 失效。调用方要清本地 token 并提示重新登录。
  bool get isUnauthorized => statusCode == 401 || code == 'unauthorized';

  /// 网络层失败（DNS、超时、断网），与业务错误区分开，UI 给“重试”而不是“返回”。
  bool get isNetwork => code == 'network_error' || code == 'timeout';

  bool get isRateLimited => statusCode == 429 || code == 'rate_limited';

  /// 给日志用的短描述，不含用户数据。
  String get debugLabel => '[$code/${statusCode ?? '-'}] $message';

  @override
  String toString() => message;
}
