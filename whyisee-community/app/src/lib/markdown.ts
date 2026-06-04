import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(markdown: string) {
  const html = marked.parse(markdown, {
    async: false,
  }) as string;

  return enhanceMarkdownHtml(html);
}

export function enhanceMarkdownHtml(html: string) {
  return wrapImageParagraphs(linkMentions(html));
}

function wrapImageParagraphs(html: string) {
  const imageParagraphPattern = /<p>\s*(<img\b[^>]*>)\s*<\/p>/gi;
  const images: string[] = [];
  let output = "";
  let position = 0;

  const flushImages = () => {
    if (images.length === 0) {
      return;
    }

    output += `<div class="markdown-image-grid">${images.map((image) => `<figure>${image}</figure>`).join("")}</div>`;
    images.length = 0;
  };

  for (const match of html.matchAll(imageParagraphPattern)) {
    const index = match.index ?? 0;
    const between = html.slice(position, index);

    if (between.trim()) {
      flushImages();
    }

    output += between;
    images.push(match[1]);
    position = index + match[0].length;
  }

  flushImages();
  output += html.slice(position);

  return output;
}

function linkMentions(html: string) {
  const parts = html.split(/(<[^>]+>)/g);
  const skipTags: string[] = [];

  return parts
    .map((part) => {
      if (!part) {
        return part;
      }

      if (part.startsWith("<")) {
        const tag = readHtmlTag(part);

        if (tag) {
          if (!tag.closing && (tag.name === "a" || tag.name === "code" || tag.name === "pre")) {
            skipTags.push(tag.name);
          } else if (tag.closing) {
            const index = skipTags.lastIndexOf(tag.name);

            if (index >= 0) {
              skipTags.splice(index, 1);
            }
          }
        }

        return part;
      }

      if (skipTags.length > 0) {
        return part;
      }

      return part.replace(/(^|[^a-zA-Z0-9_@./-])@([a-zA-Z0-9][a-zA-Z0-9_-]{1,31})\b/g, (_match, prefix, username) => {
        const safeUsername = String(username).toLowerCase();
        return `${prefix}<a class="mention-link" href="/u/${encodeURIComponent(safeUsername)}">@${username}</a>`;
      });
    })
    .join("");
}

function readHtmlTag(value: string) {
  const match = value.match(/^<\/?\s*([a-zA-Z0-9-]+)/);

  if (!match) {
    return undefined;
  }

  return {
    name: match[1].toLowerCase(),
    closing: /^<\//.test(value),
  };
}
