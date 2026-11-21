import 'package:material_ui/material_ui.dart';

import '../../core/api/models.dart';
import '../../core/env.dart';

/// Agent 专区各页共用的小零件。
///
/// 专区是暗色卡片风：一块背景 `Env.surface` 的圆角卡，标题用 13.5/700，
/// 说明文字一律 11.5–12 的灰。抽出来是为了详情页和列表页口径完全一致 ——
/// 同一张 Agent 卡在两处长得不一样，比没有详情页更奇怪。
class ZoneCard extends StatelessWidget {
  const ZoneCard({
    super.key,
    required this.child,
    this.margin = const EdgeInsets.fromLTRB(14, 0, 14, 9),
    this.padding = const EdgeInsets.fromLTRB(13, 13, 13, 12),
    this.onTap,
  });

  final Widget child;
  final EdgeInsets margin;
  final EdgeInsets padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final body = Container(
      margin: margin,
      padding: padding,
      decoration: BoxDecoration(
        color: const Color(Env.surface),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: child,
    );

    if (onTap == null) return body;

    return InkWell(onTap: onTap, borderRadius: BorderRadius.circular(14), child: body);
  }
}

class ZonePill extends StatelessWidget {
  const ZonePill({super.key, required this.text, this.color = Env.blue});

  final String text;
  final int color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(color: const Color(0x1F8AB4F8), borderRadius: BorderRadius.circular(5)),
      child: Text(
        text,
        style: TextStyle(fontSize: 9.5, height: 1.5, fontWeight: FontWeight.w600, color: Color(color)),
      ),
    );
  }
}

class ZoneChip extends StatelessWidget {
  const ZoneChip({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: const Color(0x0FFFFFFF),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: const Color(0x14FFFFFF)),
      ),
      child: Text(text, style: const TextStyle(fontSize: 10.5, color: Color(0xFF9AA3B0))),
    );
  }
}

class ZoneSectionTitle extends StatelessWidget {
  const ZoneSectionTitle({super.key, required this.title, this.hint = ''});

  final String title;
  final String hint;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 9),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontSize: 13.5,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.3,
              color: Color(Env.text),
            ),
          ),
          if (hint.isNotEmpty) ...[
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                hint,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontSize: 10.5, color: Color(0xFF5F6875)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class ZoneStatStrip extends StatelessWidget {
  const ZoneStatStrip({super.key, required this.stats});

  final List<AgentZoneStat> stats;

  @override
  Widget build(BuildContext context) {
    if (stats.isEmpty) return const SizedBox(height: 8);

    return ZoneCard(
      margin: const EdgeInsets.fromLTRB(14, 12, 14, 4),
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        children: [
          for (final stat in stats)
            Expanded(
              child: Column(
                children: [
                  Text(
                    stat.value,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: Color(Env.text)),
                  ),
                  const SizedBox(height: 3),
                  Text(stat.label, style: const TextStyle(fontSize: 10.5, color: Color(0xFF737D8B))),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

/// 一行「左边灰标签、右边值」，配置项那块就用它堆。
class ZoneKeyValue extends StatelessWidget {
  const ZoneKeyValue({super.key, required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 7),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 84,
            child: Text(label, style: const TextStyle(fontSize: 11.5, color: Color(0xFF5F6875))),
          ),
          Expanded(
            child: Text(value, style: const TextStyle(fontSize: 11.5, height: 1.5, color: Color(0xFF9AA3B0))),
          ),
        ],
      ),
    );
  }
}

/// 长文本块（任务说明、验收标准）：保留换行，行高放松一点好读。
class ZoneParagraph extends StatelessWidget {
  const ZoneParagraph({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(text, style: const TextStyle(fontSize: 12.5, height: 1.7, color: Color(0xFFB4BCC8)));
  }
}

class ZoneEmpty extends StatelessWidget {
  const ZoneEmpty({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 30, 20, 16),
      child: Center(
        child: Text(text, style: const TextStyle(fontSize: 12.5, color: Color(0xFF5F6875))),
      ),
    );
  }
}

class ZoneNote extends StatelessWidget {
  const ZoneNote({super.key, required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.fromLTRB(14, 18, 14, 8),
      padding: const EdgeInsets.fromLTRB(13, 11, 13, 11),
      decoration: BoxDecoration(color: const Color(0x0AFFFFFF), borderRadius: BorderRadius.circular(10)),
      child: Text(text, style: const TextStyle(fontSize: 11, height: 1.6, color: Color(0xFF5F6875))),
    );
  }
}
