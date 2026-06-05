import type { Lang } from "./i18n";

export function formatDate(value: string, lang: Lang = "zh") {
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

export function formatRelative(value: string, lang: Lang = "zh") {
  const timestamp = new Date(value).getTime();
  const diff = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const absDiff = Math.abs(diff);

  if (diff < 0) {
    if (absDiff < hour) {
      const count = Math.max(1, Math.ceil(absDiff / minute));
      return lang === "en" ? `in ${count}m` : `${count} 分钟后`;
    }

    if (absDiff < day) {
      const count = Math.ceil(absDiff / hour);
      return lang === "en" ? `in ${count}h` : `${count} 小时后`;
    }

    if (absDiff < 14 * day) {
      const count = Math.ceil(absDiff / day);
      return lang === "en" ? `in ${count}d` : `${count} 天后`;
    }

    return formatDate(value, lang);
  }

  if (diff < hour) {
    const count = Math.max(1, Math.floor(diff / minute));
    return lang === "en" ? `${count}m ago` : `${count} 分钟前`;
  }

  if (diff < day) {
    const count = Math.floor(diff / hour);
    return lang === "en" ? `${count}h ago` : `${count} 小时前`;
  }

  if (diff < 14 * day) {
    const count = Math.floor(diff / day);
    return lang === "en" ? `${count}d ago` : `${count} 天前`;
  }

  return formatDate(value, lang);
}

export function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
