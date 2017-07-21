import table from './table';

export default (md, options) => {
  md.block.ruler.before('paragraph', 'table', table, {
    alt: ['paragraph', 'reference'],
  });
};
