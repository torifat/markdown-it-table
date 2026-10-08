import { describe, expect, it } from "vitest";

import { runInChild } from "./support/child.js";
import {
  isUnsafeUrl,
  parsers,
  random,
  tableRows,
  unclosedRawText,
  unsafeHtml,
} from "./support/markdown.js";

const PAYLOADS = [
  "<script>alert(1)</script>",
  "<script>alert(1)",
  "<img src=x onerror=alert(1)>",
  "<svg/onload=alert(1)>",
  "<iframe src=javascript:alert(1)>",
  "<!-- x -->",
  "<!--",
  "<?php echo 1 ?>",
  "<![CDATA[<script>alert(1)</script>]]>",
  "<!DOCTYPE html>",
  "<div onclick=alert(1)>",
  "<textarea>",
  "<style>*{x:expression(alert(1))}</style>",
  "</td></tr></table><script>alert(1)</script>",
  '<img src="x|" onerror="alert(1)">',
  "<scr|ipt>alert(1)</scr|ipt>",
  "&lt;script&gt;alert(1)&lt;/script&gt;",
  "&#60;script&#62;alert(1)&#60;/script&#62;",
  "\\<script>alert(1)</script>",
  "`<script>alert(1)</script>`",
  "`|<script>|`",
  '"><script>alert(1)</script>',
  '[x](y "a\\"onmouseover=alert(1)")',
  '![a"onerror=alert(1)](x)',
  "<http://a.example/|<script>>",
  "# <script>alert(1)</script>",
  "- <script>alert(1)</script>",
  "1. <img src=x onerror=alert(1)>",
  "> <img src=x onerror=alert(1)>",
  "```<script>",
  '~~~ "><img src=x onerror=alert(1)>',
  "    <script>alert(1)</script>",
  "[r]: javascript:alert(1)",
  "**<img src=x onerror=alert(1)>**",
];

// Every position a table gives its content: header and body cells, padded and
// not, rows without a leading pipe, the line after a table, and nested tables.
function placements(payload) {
  return [
    `| ${payload} | b |\n| --- | --- |\n| x | y |\n`,
    `| a | b |\n| --- | --- |\n| ${payload} | y |\n`,
    `|a|b|\n|-|-|\n|${payload}|y|\n`,
    `| a | b |\n| :-- | --: |\n| x | ${payload} |\n`,
    `| a | b |\n| --- | --- |\n${payload} | y\n`,
    `| a | b |\n| --- | --- |\n| x | y |\n${payload}\n`,
    `- item\n\n  | a | b |\n  | --- | --- |\n  | ${payload} | y |\n`,
    `> | a | b |\n> | --- | --- |\n> |${payload}| y |\n`,
  ];
}

function unsafeCases(parser, documents) {
  const md = parser();
  return documents.flatMap((src) =>
    unsafeHtml(md.render(src)).map((problem) => ({ src, problem })),
  );
}

describe("with html: false", () => {
  const documents = PAYLOADS.flatMap(placements);

  it.each(["default", "commonmarkNoHtml"])("%s renders no raw HTML from a table", (parser) => {
    expect(unsafeCases(parsers[parser], documents)).toEqual([]);
  });

  it("renders no raw HTML from generated tables", () => {
    const next = random(20261008);
    const pieces = [
      "|",
      "| ",
      " |",
      "\\|",
      "`",
      "``",
      "\\",
      "-",
      ":-:",
      "> ",
      "- ",
      "1. ",
      "# ",
      "```",
      "~~~",
      "<",
      ">",
      "<!--",
      "-->",
      "<script>",
      "</script>",
      "<img src=x onerror=alert(1)>",
      "[x](javascript:alert(1))",
      "[r]: javascript:alert(1)",
      "[r]",
      "&",
      "&lt;",
      "\t",
      "\u00a0",
      "\u3000",
      "\ufeff",
      "    ",
      "a",
      "b c",
    ];
    const line = () =>
      Array.from({ length: 1 + Math.floor(next() * 8) }, () => next.pick(pieces)).join("");
    const documents = Array.from({ length: 2000 }, () => {
      const rows = Array.from({ length: 1 + Math.floor(next() * 4) }, line);
      return `| a | b |\n| --- | --- |\n${rows.join("\n")}\n`;
    });

    expect(unsafeCases(parsers.default, documents)).toEqual([]);
  });

  it("sets only alignment styles on table tokens", () => {
    const md = parsers.default();
    const tableTypes = /^(table|tr|th|td)_(open|close)$/;
    const problems = PAYLOADS.flatMap(placements).flatMap((src) =>
      md
        .parse(src, {})
        .filter((token) => tableTypes.test(token.type) && token.attrs !== null)
        .filter((token) => {
          const [[name, value], ...rest] = token.attrs;
          return (
            !/^t[hd]_open$/.test(token.type) ||
            rest.length ||
            name !== "style" ||
            !/^text-align:(left|center|right)$/.test(value)
          );
        })
        .map((token) => ({ src, type: token.type, attrs: token.attrs })),
    );

    expect(problems).toEqual([]);
  });
});

describe("links in tables", () => {
  const links = [
    "[x](javascript:alert(1))",
    "[x](JAVASCRIPT:alert(1))",
    "[x](javas&#99;ript:alert(1))",
    "[x](&#106;avascript:alert(1))",
    "[x](vbscript:msgbox(1))",
    "[x](data:text/html;base64,PHNjcmlwdD4=)",
    "[x](file:///etc/passwd)",
    "![x](javascript:alert(1))",
    "<javascript:alert(1)>",
    "[x][r]",
  ];
  const definition = "\n\n[r]: javascript:alert(1)\n";

  it.each(["default", "html", "commonmark"])(
    "are validated like links outside tables with %s",
    (parser) => {
      const md = parsers[parser]();
      const unsafe = links.flatMap((link) =>
        [...placements(link), `|a|b|\n|-|-|\n|[r]: javascript:alert(1)|y|\n\n[x][r]\n`].flatMap(
          (src) =>
            [...md.render(src + definition).matchAll(/\s(?:href|src)="([^"]*)"/g)]
              .filter(([, url]) => isUnsafeUrl(url))
              .map(([attr]) => ({ src, attr })),
        ),
      );

      expect(unsafe).toEqual([]);
    },
  );
});

describe("with html: true", () => {
  const md = parsers.html();
  const blocks = [
    ["<!-- note", "x -->"],
    ["<script>a", "b</script>"],
    ["<style>a", "b</style>"],
    ["<textarea>a", "b</textarea>"],
    ["<pre>a", "b</pre>"],
    ["<?php a", "b ?>"],
    ["<!DOCTYPE a", "b>"],
    ["<![CDATA[a", "b]]>"],
  ];

  // Split across two cells, raw HTML must not leave the rest of the page inside
  // a comment or raw text element, whatever block in the cell holds it.
  it.each(blocks)(
    "closes %j inside the table when its closer is in another cell",
    (open, close) => {
      const rows = [
        `|${open}|${close}|`,
        `| ${open} | ${close} |`,
        `|> ${open}|${close}|`,
        `|- ${open}|${close}|`,
        `|> - ${open}|${close}|`,
        `|<div>${open}|${close}</div>|`,
      ];
      for (const row of rows) {
        const html = md.render(`| a | b |\n| --- | --- |\n${row}\n\nafter\n`);

        expect(unclosedRawText(html), html).toBe(-1);
        expect(html).toMatch(/<\/table>\n<p>after<\/p>\n$/);
      }
    },
  );

  it("keeps an HTML block that closes inside its cell", () => {
    const html = md.render("|a|b|\n|-|-|\n|<!-- c -->|y|\n");

    expect(html).toContain("<td>\n<!-- c --></td>");
  });
});

describe("a line that starts another block", () => {
  const plain = parsers.noTables();
  const lines = [
    "~~~ x|\n<img src=x onerror=alert(1)> |\n~~~",
    "```\n| a | b |\n```",
    "<!-- a | b -->",
    "<div> | x </div>",
    "> quote | x",
    "- item | x",
    "1. item | x",
    "# heading | x",
  ];

  it.each(lines)("ends the table: %j", (line) => {
    const rest = `${line}\n\nafter\n`;
    const html = parsers.html().render(`| a | b |\n| --- | --- |\n| x | y |\n${rest}`);
    const [table, after] = html.split("</table>\n");

    expect(
      tableRows(parsers.html().parse(`| a | b |\n| --- | --- |\n| x | y |\n${rest}`, {})),
    ).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
    expect(table).not.toContain("after");
    expect(after).toBe(plain.render(rest));
  });
});

describe("cell text", () => {
  // `String#trim` removes these, but block rules do not count them as indent.
  const otherSpace = ["\u00a0", "\u00a0\u00a0\u00a0", "\u3000", "\ufeff", "\v", "\f"];

  it("never includes text from another cell", () => {
    const next = random(4242);
    const md = parsers.default();
    const mismatches = [];

    for (let n = 0; n < 1500; n++) {
      const context = next.pick(["", "- ", "> "]);
      const continuation = { "": "", "- ": next.pick(["  ", "\t"]), "> ": "> " }[context];
      // Indent stays under four columns past the container, so rows stay rows.
      const indents = continuation === "\t" ? ["", ...otherSpace] : ["", " ", "  ", ...otherSpace];
      const rows = Array.from({ length: 1 + Math.floor(next() * 3) }, (_, r) =>
        Array.from({ length: 2 }, (_, c) => `r${r}c${c}`),
      );
      const pad = () => next.pick(["", " ", "  ", "\u00a0", "\t"]);
      const body = rows.map((cells) => {
        const lead = next() < 0.8 ? "|" : "";
        const tail = lead && next() < 0.8 ? "|" : "";
        // Without a leading pipe, padding before the first cell is indent.
        const first = lead ? pad() : next.pick(["", "\u00a0"]);
        const joined = cells.map((cell, c) => (c ? pad() : first) + cell + pad()).join("|");
        return continuation + next.pick(indents) + lead + joined + tail;
      });
      const src = `${context}| a | b |\n${continuation}| --- | --- |\n${body.join("\n")}\n`;
      const actual = tableRows(md.parse(src, {})).slice(1);

      if (JSON.stringify(actual) !== JSON.stringify(rows)) mismatches.push({ src, actual });
    }

    expect(mismatches).toEqual([]);
  });

  it("keeps a reference definition to its own cell", () => {
    const env = {};
    const html = parsers.default().render("|a|b|\n|-|-|\n|[r]: /x|y|\n\n[r]\n", env);

    expect(env.references).toEqual({ R: { href: "/x", title: "" } });
    expect(html).toContain('<a href="/x">r</a>');
  });
});

describe("reference labels", () => {
  it.each(["__proto__", "constructor", "prototype", "hasOwnProperty"])(
    "%s in a cell leaves Object.prototype alone",
    (label) => {
      const before = Object.getOwnPropertyNames(Object.prototype).sort();
      const env = {};
      parsers.default().render(`|a|b|\n|-|-|\n|[${label}]: /polluted|y|\n\n[${label}]\n`, env);

      expect(Object.getOwnPropertyNames(Object.prototype).sort()).toEqual(before);
      expect({}.polluted).toBeUndefined();
    },
  );
});

describe("adversarial rows", () => {
  const n = 200_000;
  const header = "| a |\n| - |\n";
  const inputs = {
    padding: `${header}|${" ".repeat(n)}x |\n`,
    "delimiter dashes": `| a |\n|${"-".repeat(n)}|\n| x |\n`,
    "unclosed backticks": `${header}|${"`".repeat(n)}\n`,
    "backtick pairs": `${header}|${"`a".repeat(n / 2)}|\n`,
    backslashes: `${header}|${"\\".repeat(n)}|\n`,
    // Every pipe is a cell, so this one is smaller to fit the default heap.
    pipes: `${header}${"|".repeat(n / 4)}\n`,
    "many rows": `${header}${"| x |\n".repeat(n / 5)}`,
    "list markers": `${header}${"|-|\n".repeat(n / 4)}`,
  };

  // Catastrophic backtracking or a quadratic loop takes minutes on these, while
  // a linear parse takes milliseconds, so the bound can stay generous.
  it.each(Object.keys(inputs))("parse in linear time: %s", (name) => {
    const ms = runInChild(
      `const md = new MarkdownIt().disable("table").use(markdownItTable);
       const start = performance.now();
       md.render(input);
       process.stdout.write(String(performance.now() - start));`,
      inputs[name],
      { timeout: 20000 },
    );

    expect(Number(ms)).toBeLessThan(2000);
  });
});
