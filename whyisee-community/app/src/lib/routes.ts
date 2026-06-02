import type { Topic } from "./types";

export function topicPath(topic: Pick<Topic, "id" | "slug">) {
  return `/t/${topic.id}/${topic.slug}`;
}

export function categoryPath(slug: string) {
  return `/c/${slug}`;
}

export function tagPath(slug: string) {
  return `/tag/${slug}`;
}
