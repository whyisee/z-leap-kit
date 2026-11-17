import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../env.dart';
import 'api_exception.dart';
import 'token_store.dart';

/// 一次成功调用解包后的结果：`data` + `meta`（分页游标、requestId 在这）。
class ApiPayload {
  const ApiPayload(this.data, this.meta);

  final Map<String, dynamic> data;
  final Map<String, dynamic> meta;

  String? get requestId => meta['requestId'] as String?;
}

/// `/api/v1` 的唯一出口。
///
/// 约定：
/// - 业务代码不直接碰 dio，也不自己拼 URL；
/// - 所有失败都抛 [ApiException]，调用方只处理这一种异常；
/// - 401 会清本地 token 并回调，避免每个页面各写一遍登出逻辑。
class ApiClient {
  ApiClient(this._store, {String? baseUrl})
      : _baseUrl = baseUrl ?? '${Env.siteBase}/api/v1' {
    _dio = Dio(
      BaseOptions(
        baseUrl: _baseUrl,
        connectTimeout: const Duration(seconds: 10),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 20),
        responseType: ResponseType.json,
        headers: {
          'Accept': 'application/json',
          'X-App-Version': Env.appVersion,
          'X-Client-Platform': _platformName,
        },
        // 4xx/5xx 不抛，自己解包成 ApiException，保留 error.code
        validateStatus: (_) => true,
      ),
    );

    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          final token = _store.token;
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
      ),
    );
  }

  final TokenStore _store;
  final String _baseUrl;
  late final Dio _dio;

  /// 收到 401 时的回调（清 token 后通知 UI 切回未登录态）。
  void Function()? onUnauthorized;

  static String get _platformName {
    if (kIsWeb) return 'web';
    return Platform.isIOS ? 'ios' : 'android';
  }

  Future<ApiPayload> get(String path, {Map<String, dynamic>? query, Duration? receiveTimeout}) =>
      _send(
        () => _dio.get<dynamic>(
          path,
          queryParameters: _clean(query),
          options: _timeoutOptions(receiveTimeout),
        ),
      );

  /// [receiveTimeout] 用于慢接口（AI 生成要几十秒），默认 15 秒会让它误判超时。
  Future<ApiPayload> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    Duration? receiveTimeout,
  }) =>
      _send(
        () => _dio.post<dynamic>(
          path,
          data: body,
          queryParameters: _clean(query),
          options: _timeoutOptions(receiveTimeout),
        ),
      );

  static Options? _timeoutOptions(Duration? receiveTimeout) =>
      receiveTimeout == null ? null : Options(receiveTimeout: receiveTimeout);

  Future<ApiPayload> _send(Future<Response<dynamic>> Function() run) async {
    late final Response<dynamic> res;
    try {
      res = await run();
    } on DioException catch (e) {
      throw _mapDioError(e);
    }

    final body = res.data;
    final map = body is Map ? body.cast<String, dynamic>() : <String, dynamic>{};
    final status = res.statusCode ?? 0;

    // 每个请求一行：方法、路径（不含 query 敏感值）、状态码。够定位问题，不刷屏。
    if (kDebugMode) {
      final uri = res.requestOptions.uri;
      final query = uri.query.isEmpty ? '' : '?${uri.query}';
      debugPrint('[api] ${res.requestOptions.method} ${uri.path}$query -> $status');
    }
    final meta = (map['meta'] as Map?)?.cast<String, dynamic>() ?? const <String, dynamic>{};

    if (status >= 200 && status < 300 && map['ok'] == true) {
      final data = map['data'];
      return ApiPayload(
        data is Map ? data.cast<String, dynamic>() : <String, dynamic>{},
        meta,
      );
    }

    final err = (map['error'] as Map?)?.cast<String, dynamic>();
    final exception = ApiException(
      code: err?['code'] as String? ?? _fallbackCode(status),
      message: err?['message'] as String? ?? _fallbackMessage(status),
      statusCode: status,
      requestId: meta['requestId'] as String?,
      fields: (err?['fields'] as Map?)?.map((k, v) => MapEntry('$k', '$v')),
    );

    if (exception.isUnauthorized) {
      await _store.clear();
      onUnauthorized?.call();
    }
    throw exception;
  }

  ApiException _mapDioError(DioException e) {
    switch (e.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return ApiException(code: 'timeout', message: '网络有点慢，再试一次。');
      case DioExceptionType.cancel:
        return ApiException(code: 'cancelled', message: '请求已取消。');
      default:
        return ApiException(
          code: 'network_error',
          message: '连不上服务器，检查一下网络。',
        );
    }
  }

  static String _fallbackCode(int status) {
    if (status == 0) return 'network_error';
    if (status == 401) return 'unauthorized';
    if (status == 404) return 'not_found';
    if (status == 429) return 'rate_limited';
    return status >= 500 ? 'server_error' : 'bad_request';
  }

  static String _fallbackMessage(int status) {
    if (status == 0) return '连不上服务器，检查一下网络。';
    if (status == 404) return '内容不存在或已被删除。';
    if (status == 429) return '操作太频繁，稍等一会儿。';
    if (status >= 500) return '服务器出错了，稍后再试。';
    return '请求失败（$status）。';
  }

  /// 空值参数不发，避免服务端把 `?sort=` 当成显式传空。
  static Map<String, dynamic>? _clean(Map<String, dynamic>? query) {
    if (query == null) return null;
    final out = <String, dynamic>{};
    query.forEach((k, v) {
      if (v == null) return;
      if (v is String && v.isEmpty) return;
      out[k] = v;
    });
    return out.isEmpty ? null : out;
  }
}
