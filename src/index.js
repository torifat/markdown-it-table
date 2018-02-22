import table from './table';

export const MarkdownItTable = (md, options) => {
  md.block.ruler.before('paragraph', 'table', table, {
    alt: ['paragraph', 'reference'],
  });
};
