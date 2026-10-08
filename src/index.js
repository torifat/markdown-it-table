import table from "./table.js";

export const markdownItTable = (md, options) => {
  // Runs ahead of `lheading`, so a `-` or `=` line after a table cannot turn the
  // table into a setext heading.
  md.block.ruler.before("lheading", "table", table, {
    alt: ["paragraph", "reference"],
  });
};
