import { marked } from 'marked';

function toSlug(text: string): string {
  return text
    .replace(/<[^>]*>/g, '')
    .toLowerCase()
    .replace(/[^\w\sÀ-ɏ-]/gu, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

marked.use({
  renderer: {
    heading(text: string, depth: number): string {
      return `<h${depth} id="${toSlug(text)}">${text}</h${depth}>\n`;
    },
  },
});

export function parseMarkdown(text: string): string {
  return String(marked.parse(text));
}
