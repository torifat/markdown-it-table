import MarkdownIt from "markdown-it";

import { markdownItTable } from "../../index.js";

export const parsers = {
  default: () => new MarkdownIt().disable("table").use(markdownItTable),
  html: () => new MarkdownIt({ html: true }).disable("table").use(markdownItTable),
  commonmark: () => new MarkdownIt("commonmark").use(markdownItTable),
  commonmarkNoHtml: () => new MarkdownIt("commonmark", { html: false }).use(markdownItTable),
  builtin: () => new MarkdownIt(),
  noTables: () => new MarkdownIt({ html: true }).disable("table"),
};

// Index of a comment or raw text element that never closes, where a browser
// would treat the rest of the page as part of it, or -1 when there is none.
export function unclosedRawText(html) {
  const opener = /<!--|<(script|style|textarea|title|xmp|iframe|noembed|noframes)\b/gi;
  let match;
  while ((match = opener.exec(html))) {
    const closer = match[1] ? `</${match[1].toLowerCase()}` : "-->";
    const end = html.toLowerCase().indexOf(closer, match.index + match[0].length);
    if (end === -1) return match.index;
    opener.lastIndex = end;
  }
  return -1;
}

// Rows of the first table in `tokens`, each a list of cell texts. A cell's text
// joins the content of every inline token inside it.
export function tableRows(tokens) {
  const rows = [];
  let row = null;
  let cell = null;
  for (const token of tokens) {
    if (token.type === "table_close") break;
    if (token.type === "tr_open") rows.push((row = []));
    if (token.type === "th_open" || token.type === "td_open") cell = [];
    if (token.type === "inline" && cell) cell.push(token.content);
    if (token.type === "th_close" || token.type === "td_close") {
      row.push(cell.join(" ").trim());
      cell = null;
    }
  }
  return rows;
}

const ALLOWED_TAGS = new Set(
  "table tr th td p ul ol li blockquote h1 h2 h3 h4 h5 h6 hr pre code em strong a img br s".split(
    " ",
  ),
);
const ALLOWED_ATTRS = {
  a: ["href", "title"],
  img: ["src", "alt", "title"],
  th: ["style"],
  td: ["style"],
  ol: ["start"],
  code: ["class"],
};
const STYLE_RE = /^text-align:(left|center|right)$/;
const TAG_RE =
  /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:="[^"<>]*")?)*)\s*\/?>/g;
const ATTR_RE = /\s+([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"<>]*)")?/g;

function decodeAttr(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&");
}

// A URL whose scheme a browser would run or load as a document. Browsers skip
// leading control characters and spaces and drop tabs and newlines anywhere.
export function isUnsafeUrl(value) {
  const url = decodeAttr(value)
    .replace(/^[\u0000- ]+/, "")
    .replace(/[\t\n\r]/g, "")
    .toLowerCase();
  if (/^data:image\/(gif|png|jpeg|webp);/.test(url)) return false;
  return /^(javascript|vbscript|data|file):/.test(url);
}

// Problems in HTML rendered with `html: false`: any tag or attribute markdown-it
// does not produce itself, an unsafe URL, or a raw `<`, `>` or bare `&` in text.
export function unsafeHtml(html) {
  const problems = [];
  const text = html.replace(TAG_RE, (whole, close, name, attrs) => {
    const tag = name.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) problems.push(`tag ${whole}`);
    if (close && attrs.trim()) problems.push(`attributes on ${whole}`);
    for (const [, attr, value = ""] of attrs.matchAll(ATTR_RE)) {
      if (!ALLOWED_ATTRS[tag]?.includes(attr)) problems.push(`attribute ${attr} on ${whole}`);
      if (attr === "style" && !STYLE_RE.test(value)) problems.push(`style on ${whole}`);
      if ((attr === "href" || attr === "src") && isUnsafeUrl(value))
        problems.push(`url on ${whole}`);
      if (attr === "class" && !/^language-[^\s"<>]*$/.test(value))
        problems.push(`class on ${whole}`);
    }
    return "";
  });
  const raw = text.search(/[<>]/);
  if (raw !== -1) problems.push(`raw ${JSON.stringify(text.slice(raw - 20, raw + 20))}`);
  if (/&(?!(?:amp|lt|gt|quot|#\d+|#x[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);)/.test(text)) {
    problems.push("bare &");
  }
  return problems;
}

// Deterministic PRNG (mulberry32), so a failing generated case reproduces.
export function random(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.pick = (list) => list[Math.floor(next() * list.length)];
  return next;
}
