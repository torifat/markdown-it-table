import { describe, expect, it } from "vitest";

import { runInChild } from "./support/child.js";
import { parsers, tableRows } from "./support/markdown.js";

const generated = new URL("./support/generated.js", import.meta.url).href;

// Heap retained by the tokens of `documents.plugin` with this plugin and of
// `documents.builtin` with markdown-it's own table rule.
function retainedHeap(documents) {
  return JSON.parse(
    runInChild(
      `const documents = JSON.parse(input);
       const retained = (md, src) => {
         global.gc();
         const before = process.memoryUsage().heapUsed;
         const tokens = md.parse(src, {});
         global.gc();
         return tokens.length && process.memoryUsage().heapUsed - before;
       };
       process.stdout.write(JSON.stringify({
         plugin: retained(new MarkdownIt().disable("table").use(markdownItTable), documents.plugin),
         builtin: retained(new MarkdownIt(), documents.builtin),
       }));`,
      JSON.stringify(documents),
      { heapMb: 512, flags: ["--expose-gc"], timeout: 30000 },
    ),
  );
}

// Every cell costs tokens in markdown-it's own tables too, so the bound is the
// cost of the same number of cells there.
describe("memory", () => {
  it("keeps a wide table within 2.5x of the heap markdown-it's own table uses", () => {
    const columns = 2000;
    const table =
      `|${"a|".repeat(columns)}\n|${"-|".repeat(columns)}\n` +
      `|${"x|".repeat(columns)}\n`.repeat(50);
    const retained = retainedHeap({ plugin: table, builtin: table });

    expect(retained.plugin / retained.builtin).toBeLessThan(2.5);
  });

  // A row may have more cells than the header. markdown-it's own table needs a
  // header as wide as the row to render that many cells.
  it("keeps a row of pipes within 2.5x of as many cells in markdown-it's own table", () => {
    const cells = 50000;
    const retained = retainedHeap({
      plugin: `| a |\n| - |\n${"|".repeat(cells + 1)}\n`,
      builtin: `|${"a|".repeat(cells / 2)}\n|${"-|".repeat(cells / 2)}\n${"|".repeat(cells / 2 + 1)}\n`,
    });

    expect(retained.plugin / retained.builtin).toBeLessThan(2.5);
  });
});

describe("parser state", () => {
  const tables = [
    "| a | b |\n| --- | --- |\n| x | y |\n",
    "| a | b |\n| --- | --- |\n| x ||\n",
    "| a | b |\n| --- | --- |\n|-|*|\n",
    "| a | b |\n| --- | --- |\n| > q | - l |\n",
    "| a | b |\n| --- | --- |\n\u00a0| x | y |\n",
    "|a|b|\n|-|-|\n|[r]: /x|`|`|\n",
  ];
  const after = [
    "- a\n- b\n",
    "1. a\n\n2. b\n",
    "# h\n",
    "text\n===\n",
    "text\n---\n",
    "```\ncode\n```\n",
    "> q\n",
    "    code\n",
    "<div>\nx\n</div>\n",
    "| c |\n| - |\n| z |\n",
  ];

  it.each(["default", "html"])(
    "leaves the rest of the document as it would be with %s",
    (parser) => {
      const md = parsers[parser]();
      const changed = tables.flatMap((table) =>
        after
          .map((rest) => ({ src: `${table}\n${rest}`, expected: md.render(rest) }))
          .filter(({ src, expected }) => !md.render(src).endsWith(expected)),
      );

      expect(changed).toEqual([]);
    },
  );

  it("keeps a list around a table tight", () => {
    for (const row of ["| x ||", "|| y |", "| | |", "| x | y |", "| - x ||", "| > q | |"]) {
      const html = parsers
        .default()
        .render(`- before\n- | a | b |\n  | - | - |\n  ${row}\n- after\n`);

      expect(html).toContain("<li>before</li>");
      expect(html).toContain("<li>after</li>");
    }
  });

  it("does not turn a table followed by a `-` line into a heading", () => {
    for (const line of ["-", "---", "==="]) {
      const html = parsers.default().render(`| a | b |\n| - | - |\n| x | y |\n${line}\n`);

      expect(html).toMatch(/^<table>/);
    }
  });

  it("maps the table to every line it spans", () => {
    const tokens = parsers.default().parse("text\n\n| a |\n| - |\n| b |\n| c |\n\nafter\n", {});

    expect(tokens.find((token) => token.type === "table_open").map).toEqual([2, 6]);
  });

  it("parses cells inside list items", () => {
    const tokens = parsers.default().parse("- item\n  | a | b |\n  | - | - |\n  | x | y |\n", {});

    expect(tableRows(tokens)).toEqual([
      ["a", "b"],
      ["x", "y"],
    ]);
  });

  it("splits a row on the pipe after an unclosed backtick and a trailing backslash", () => {
    const tokens = parsers.default().parse("| a | b |\n| - | - |\n| `| x \\\n", {});

    expect(tableRows(tokens)[1]).toEqual(["`", "x \\"]);
  });

  it("keeps an escaped pipe at the end of a row", () => {
    const html = parsers.default().render("| a | b |\n| - | - |\n| x | y \\|\n");

    expect(html).toContain("<p>y |</p>");
  });

  // Generated documents run in a child process, so a hang or runaway allocation
  // fails the test rather than stalling the runner.
  it("produces balanced tokens with maps inside the document", () => {
    const problems = JSON.parse(
      runInChild(
        `const { documents, tokenProblems } = await import(${JSON.stringify(generated)});
         const parsers = [
           new MarkdownIt().disable("table").use(markdownItTable),
           new MarkdownIt("commonmark").use(markdownItTable),
           new MarkdownIt({ html: true, linkify: true, typographer: true }).disable("table").use(markdownItTable),
           new MarkdownIt("zero").use(markdownItTable),
         ];
         const problems = [];
         for (const src of documents(20261008, 3000)) {
           for (const md of parsers) {
             const found = tokenProblems(md.parse(src, {}), src.split("\\n").length);
             md.render(src);
             if (found.length) problems.push({ src, found });
           }
         }
         process.stdout.write(JSON.stringify(problems.slice(0, 10)));`,
        "",
        { heapMb: 256, timeout: 60000 },
      ),
    );

    expect(problems).toEqual([]);
  });
});
