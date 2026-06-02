import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(markdown: string) {
  return marked.parse(markdown, {
    async: false,
  }) as string;
}
