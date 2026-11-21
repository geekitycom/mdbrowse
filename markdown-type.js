const MARKDOWN_TYPES = new Set(['text/markdown', 'text/x-markdown']);
const MARKDOWN_PATH = /(?:\.md|\.markdown|(?:^|\/)llms(?:-full)?\.txt)$/i;

// text/plain is Markdown only when its name says so: a .md or .markdown file,
// or llms.txt, whose format is Markdown but which sites serve as text/plain.
// A response with no content type is taken as Markdown.
export function isMarkdownType(contentType, url) {
  if (!contentType || MARKDOWN_TYPES.has(contentType)) return true;
  return contentType === 'text/plain' && MARKDOWN_PATH.test(new URL(url).pathname);
}
