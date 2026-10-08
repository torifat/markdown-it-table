import { random } from "./markdown.js";

const CELLS = [
  "x",
  "",
  " ",
  "-",
  "*",
  "+",
  "1.",
  "1)",
  "> q",
  "- a",
  "1. a",
  "# h",
  "***",
  "`a|b`",
  "`",
  "\\",
  "\\|",
  "[r]: /x",
  "[r]",
  "<div>",
  "<!--",
  "-->",
  "<script>",
  "a\tb",
  "\u00a0x",
  "\u3000",
];
const ROW_STARTS = ["|", "| ", "", " ", "\t", "\u00a0", "> ", "- ", "1. ", "```", "<!-- "];
const CONTAINERS = [
  ["", ""],
  ["- ", "  "],
  ["1. ", "   "],
  ["> ", "> "],
  ["- > ", "  > "],
  ["> - ", ">   "],
];
const AFTER = ["", "\n", "-\n", "===\n", "text\n", "- a\n", "```\n", "<!--\n", "[r]: /y\n"];

// Seeded documents built around a table: random cells and row prefixes, the
// table nested in a container, and arbitrary content after it.
export function* documents(seed, count) {
  const next = random(seed);
  for (let n = 0; n < count; n++) {
    const [first, rest] = next.pick(CONTAINERS);
    const columns = 1 + Math.floor(next() * 3);
    const row = () => {
      const cells = Array.from({ length: Math.floor(next() * (columns + 2)) }, () =>
        next.pick(CELLS),
      );
      return (
        next.pick(ROW_STARTS) + cells.join(next.pick(["|", " | "])) + next.pick(["", "|", " |"])
      );
    };
    const header = `| ${Array(columns).fill("h").join(" | ")} |`;
    const delimiter = `|${Array(columns)
      .fill(next.pick(["-", ":-", "-:", ":-:"]))
      .join("|")}|`;
    const body = Array.from({ length: Math.floor(next() * 4) }, row);
    const lines = [header, delimiter, ...body].map((line, i) => (i ? rest : first) + line);
    yield `${lines.join("\n")}\n${next.pick(AFTER)}${next.pick(AFTER)}`;
  }
}

// Problems with a token stream: nesting levels that do not match the opens and
// closes, maps outside the document, or a table map that does not span its rows.
export function tokenProblems(tokens, lineCount) {
  const problems = [];
  let level = 0;
  for (const token of tokens) {
    if (token.nesting < 0) level--;
    if (token.level !== level)
      problems.push(`${token.type} at level ${token.level}, expected ${level}`);
    if (token.nesting > 0) level++;
    if (token.map) {
      const [start, end] = token.map;
      if (!(start >= 0 && start <= end && end <= lineCount))
        problems.push(`${token.type} map [${token.map}]`);
      if (token.type === "table_open" && end < start + 2)
        problems.push(`table_open map [${token.map}]`);
    }
  }
  if (level !== 0) problems.push(`nesting ends at level ${level}`);
  return problems;
}
