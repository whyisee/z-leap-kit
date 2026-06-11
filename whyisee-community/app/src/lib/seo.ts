import type { Category, Tag, Topic } from "./types";

interface PublicProfile {
  username: string;
  displayName: string;
  bio?: string | null;
  avatarUrl?: string | null;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  createdAt?: string;
}

export function buildTopicJsonLd(topic: Topic, url: string, image: string, lang: "zh-CN" | "en") {
  const origin = new URL(url).origin;

  return {
    "@context": "https://schema.org",
    "@type": topic.type === "article" ? "Article" : "DiscussionForumPosting",
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": url,
    },
    headline: topic.title,
    description: topic.summary,
    image: [image],
    datePublished: topic.publishedAt,
    dateModified: topic.updatedAt || topic.lastActivityAt || topic.publishedAt,
    inLanguage: lang,
    articleSection: topic.category.name,
    keywords: [topic.category.name, ...topic.tags.map((tag) => tag.name)].filter(Boolean).join(", "),
    articleBody: normalizeBody(topic.contentMarkdown),
    commentCount: topic.replyCount,
    author: {
      "@type": "Person",
      name: topic.author.displayName || topic.author.username,
      url: topic.author.isAnonymous ? undefined : `${origin}/u/${encodeURIComponent(topic.author.username)}`,
      image: topic.author.avatarUrl ? new URL(topic.author.avatarUrl, origin).toString() : undefined,
    },
    publisher: publisher(),
    interactionStatistic: [
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/ViewAction",
        userInteractionCount: topic.viewCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/CommentAction",
        userInteractionCount: topic.replyCount,
      },
      {
        "@type": "InteractionCounter",
        interactionType: "https://schema.org/LikeAction",
        userInteractionCount: topic.likeCount,
      },
    ],
  };
}

export function buildCollectionPageJsonLd(input: {
  name: string;
  description: string;
  url: string;
  lang: "zh-CN" | "en";
  topics: Topic[];
  about?: Category | Tag;
}) {
  const origin = new URL(input.url).origin;

  return {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: input.name,
    description: input.description,
    url: input.url,
    inLanguage: input.lang,
    isPartOf: {
      "@type": "WebSite",
      name: "whyisee.xyz",
      url: `${origin}/`,
    },
    about: input.about
      ? {
          "@type": "Thing",
          name: input.about.name,
          description: input.about.description,
        }
      : undefined,
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: input.topics.length,
      itemListElement: input.topics.slice(0, 30).map((topic, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${origin}/t/${topic.id}`,
        name: topic.title,
      })),
    },
  };
}

export function buildProfilePageJsonLd(user: PublicProfile, url: string, image: string, lang: "zh-CN" | "en") {
  const sameAs = [user.websiteUrl, user.githubUrl].filter(Boolean);
  const origin = new URL(url).origin;

  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    dateCreated: user.createdAt,
    inLanguage: lang,
    isPartOf: {
      "@type": "WebSite",
      name: "whyisee.xyz",
      url: `${origin}/`,
    },
    mainEntity: {
      "@type": "Person",
      name: user.displayName,
      alternateName: user.username,
      description: user.bio || undefined,
      image,
      url,
      sameAs: sameAs.length ? sameAs : undefined,
    },
  };
}

function publisher() {
  return {
    "@type": "Organization",
    name: "whyisee.xyz",
    url: "https://whyisee.xyz/",
    logo: {
      "@type": "ImageObject",
      url: "https://whyisee.xyz/icon.png",
    },
  };
}

function normalizeBody(markdown: string) {
  return markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[#>*_\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 5000);
}
