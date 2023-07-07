import table from "./table.js";

export const markdownItTable = (md, options) => {
  md.block.ruler.before("paragraph", "table", table, {
    alt: ["paragraph", "reference"],
  });
};
