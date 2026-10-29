// Modeled on GitHub's html-pipeline SanitizationFilter allowlist.
export const SANITIZE = {
  ALLOWED_TAGS: [
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'br', 'hr', 'div', 'span', 'blockquote', 'pre', 'code', 'tt',
    'b', 'i', 'strong', 'em', 's', 'strike', 'del', 'ins', 'sup', 'sub', 'small', 'mark', 'kbd', 'q', 'samp',
    'var', 'abbr', 'cite', 'dfn', 'time', 'bdo', 'ruby', 'rt', 'rp', 'wbr', 'a', 'img', 'picture', 'source',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd', 'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
    'details', 'summary', 'figure', 'figcaption', 'input',
  ],
  ALLOWED_ATTR: [
    'href', 'src', 'srcset', 'media', 'alt', 'title', 'width', 'height', 'align', 'valign', 'colspan',
    'rowspan', 'scope', 'headers', 'start', 'type', 'checked', 'disabled', 'open', 'datetime', 'dir', 'lang',
    'id', 'name', 'aria-label', 'aria-hidden', 'aria-describedby', 'aria-labelledby', 'role', 'cite',
  ],
  // Besides web and mail links, the schemes a document can reasonably link to
  // another app with. A click hands the URL to the browser, which passes it to
  // whatever handles the scheme. javascript:, vbscript:, data: and file: are not
  // listed and are stripped.
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|gemini|gopher|xmpp|tel|sms|geo|magnet|ircs?|matrix):|[^a-z]|[a-z+.-]+(?:[^a-z+.\-:]|$))/i,
  ALLOW_DATA_ATTR: false,
};
