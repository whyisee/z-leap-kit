import type { Lang } from "./i18n";
import type { TopicAuthor } from "./types";

export const TREE_HOLE_CATEGORY_SLUG = "tree-hole";

export function isTreeHoleCategorySlug(slug: string | null | undefined) {
  return slug === TREE_HOLE_CATEGORY_SLUG;
}

export function getAnonymousAuthor(lang: Lang = "zh"): TopicAuthor {
  return {
    id: 0,
    username: "anonymous",
    displayName: lang === "en" ? "Anonymous" : "匿名用户",
    role: "member",
    avatarUrl: null,
    bio: lang === "en" ? "Identity hidden in Tree Hole." : "树洞板块已隐藏身份。",
    isAnonymous: true,
  };
}

export function getAnonymousInitial(lang: Lang = "zh") {
  return lang === "en" ? "A" : "匿";
}
