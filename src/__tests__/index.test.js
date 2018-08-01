import fs from 'fs';
import path from 'path';

import markdownIt from 'markdown-it';
import { markdownItTable } from '../';

const getMDFromFixture = name => {
  const filename = path.resolve(__dirname, `__fixtures__/${name}.md`);
  return fs.readFileSync(filename, 'utf8');
};

describe('markdown-it-table', () => {
  let md;
  beforeAll(() => {
    md = markdownIt('commonmark').use(markdownItTable, {});
  });

  it('should be able to parse simple table', () => {
    const input = getMDFromFixture('simple');
    expect(md.render(input)).toMatchSnapshot();
  });

  it('should be able to parse complex table', () => {
    const input = getMDFromFixture('complex');
    expect(md.render(input)).toMatchSnapshot();
  });

  it('should be able to parse cell with blockquote', () => {
    const input = getMDFromFixture('blockquote');
    expect(md.render(input)).toMatchSnapshot();
  });

  it.skip('should be able to parse table with redundant indentations', () => {
    const input = getMDFromFixture('indentation');
    expect(md.render(input)).toMatchSnapshot();
  });

  it('should be able to parse table with multiple columns', () => {
    const input = getMDFromFixture('multi-column');
    expect(md.render(input)).toMatchSnapshot();
  });

  it('should be able to parse table without proper spacing', () => {
    const input = getMDFromFixture('no-spacing');
    expect(md.render(input)).toMatchSnapshot();
  });

  it('should be able to parse table with missing cell', () => {
    const input = getMDFromFixture('table-missing-cell');
    expect(md.render(input)).toMatchSnapshot();
  });

  it('should be able to parse table with empty list', () => {
    const input = getMDFromFixture('table-empty-list');
    expect(md.render(input)).toMatchSnapshot();
  });
});
