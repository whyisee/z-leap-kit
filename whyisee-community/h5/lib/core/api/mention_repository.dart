import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../providers.dart';
import 'api_client.dart';

final mentionRepositoryProvider = Provider<MentionRepository>(
  (ref) => MentionRepository(ref.watch(apiClientProvider)),
);

/// `@` 候选里的一个人。
class MentionTarget {
  const MentionTarget({
    required this.username,
    required this.displayName,
    this.avatarUrl,
    this.isBot = false,
  });

  final String username;
  final String displayName;
  final String? avatarUrl;
  final bool isBot;

  /// 头像是空的就显示首字，和列表里的 Author 一个规矩
  String get initial {
    final name = (displayName.isNotEmpty ? displayName : username).trim();
    return name.isEmpty ? '?' : name.substring(0, 1).toUpperCase();
  }

  factory MentionTarget.fromJson(Map<String, dynamic> json) => MentionTarget(
    username: json['username'] as String? ?? '',
    displayName: (json['displayName'] as String?)?.trim().isNotEmpty == true
        ? json['displayName'] as String
        : (json['username'] as String? ?? ''),
    avatarUrl: json['avatarUrl'] as String?,
    isBot: json['isBot'] as bool? ?? false,
  );
}

class MentionRepository {
  MentionRepository(this._api);

  final ApiClient _api;

  /// 输入 `@` 时捞候选；[query] 为空就是「常出现的几个人」。
  Future<List<MentionTarget>> search(String query) async {
    final payload = await _api.get('/mentions/search', query: {'q': query});
    return ((payload.data['users'] as List?) ?? const [])
        .whereType<Map>()
        .map((e) => MentionTarget.fromJson(e.cast<String, dynamic>()))
        .where((target) => target.username.isNotEmpty)
        .toList(growable: false);
  }
}
