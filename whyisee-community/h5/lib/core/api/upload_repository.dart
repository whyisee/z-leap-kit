import 'dart:io';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'api_client.dart';

final uploadRepositoryProvider = Provider<UploadRepository>(
  (ref) => UploadRepository(ref.watch(apiClientProvider)),
);

/// 上传返回的图片。
///
/// [url] 是站内相对路径（`/uploads/2026/11/xxx.jpg`），正文里就存这个 ——
/// 网页和 WebView 都按当前域名解析，换域名不用改库里的历史内容。
class UploadedImage {
  const UploadedImage({required this.url, required this.markdown, this.sizeBytes = 0});

  final String url;
  final String markdown;
  final int sizeBytes;

  factory UploadedImage.fromJson(Map<String, dynamic> json) => UploadedImage(
    url: json['url'] as String? ?? '',
    markdown: json['markdown'] as String? ?? '',
    sizeBytes: (json['sizeBytes'] as num?)?.toInt() ?? 0,
  );
}

class UploadRepository {
  UploadRepository(this._api);

  final ApiClient _api;

  /// 传一张图，返回可以直接插进正文的相对地址。
  Future<UploadedImage> image(File file) async {
    final payload = await _api.upload('/uploads/images', file: file);
    return UploadedImage.fromJson(payload.data);
  }
}
