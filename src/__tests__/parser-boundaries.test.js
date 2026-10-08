import { describe, expect, it } from "vitest";

import { renderInChild } from "./support/child.js";

describe.each(["commonmark", "default"])("cell parser boundaries (%s)", (preset) => {
  it.each(["-", "*", "+", "1.", "1)"])(
    "finishes a table with a bare %s marker and preserves the following row",
    (marker) => {
      const input = `| A | B |\n| --- | --- |\n| ${marker}| y |\n| z | y |\n`;
      const html = renderInChild(input, preset);

      expect(html.match(/<tr>/g)).toHaveLength(3);
      expect(html.match(/<td>/g)).toHaveLength(4);
      expect(html).toContain("<p>z</p>");
      expect(html.match(/<p>y<\/p>/g)).toHaveLength(2);
      expect(html).toMatch(/<\/table>\n$/);
    },
  );

  it("parses a table followed by an empty ordered list and paragraph", () => {
    const html = renderInChild("| a |\n| --- |\n| 1 |\n\n1.\nA\n", preset);

    expect(html).toBe(
      "<table>\n<tr>\n<th>\n<p>a</p>\n</th>\n</tr>\n<tr>\n<td>\n<p>1</p>\n</td>\n</tr>\n</table>\n<ol>\n<li></li>\n</ol>\n<p>A</p>\n",
    );
  });

  it("restores the document boundary for a thematic break after a table", () => {
    const html = renderInChild("| A | B |\n| --- | --- |\n| x | y |\n\n\n---\n\n# After\n", preset);

    expect(html).toMatch(/<\/table>\n<hr\s*\/?>\n<h1>After<\/h1>\n/);
    expect(html).not.toContain("<h2>");
  });
});
