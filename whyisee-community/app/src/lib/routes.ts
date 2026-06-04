import type { Topic } from "./types";

export function topicPath(topic: Pick<Topic, "id" | "slug">) {
  return `/t/${topic.id}`;
}

export function categoryPath(slug: string) {
  return `/c/${encodeURIComponent(slug)}`;
}

export function tagPath(slug: string) {
  return `/tag/${encodeURIComponent(slug)}`;
}
