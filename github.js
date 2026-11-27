const BLOB = /^\/([^/]+)\/([^/]+)\/blob\/(.+\.(?:md|markdown|mdown|mkd))$/i;

// GitHub shows a Markdown file in a repository as an HTML page. The raw
// file for a github.com/<owner>/<repo>/blob/<ref>/<path>.md page, or null for
// any other URL.
export function githubRawUrl(target) {
  let url;
  try {
    url = new URL(target);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com') return null;
  const match = url.pathname.match(BLOB);
  if (!match) return null;
  const [, owner, repo, rest] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${rest}${url.hash}`;
}
