# markdown-it-table

[![CI](https://github.com/torifat/markdown-it-table/actions/workflows/ci.yml/badge.svg)](https://github.com/torifat/markdown-it-table/actions/workflows/ci.yml) [![NPM version](https://img.shields.io/npm/v/markdown-it-table.svg?style=flat)](https://www.npmjs.org/package/markdown-it-table)

> Plugin for [markdown-it](https://github.com/markdown-it/markdown-it) markdown parser, adding table with nested block syntax support.

> [!WARNING]
> These tables are neither CommonMark nor GFM. CommonMark has no table syntax, and GFM cells hold inline content only, so GitHub renders `| - item |` as the text `- item` where this plugin renders a list. The HTML differs as well, as listed under [Differences from markdown-it's table](#differences-from-markdown-its-table).

## Install

```bash
$ yarn add markdown-it-table
```

## Usage

markdown-it's default preset has its own `table` rule, and that rule runs before this plugin. Disable it, or start from the `commonmark` preset, which leaves it off.

```js
import MarkdownIt from "markdown-it";
import { markdownItTable } from "markdown-it-table";

const md = new MarkdownIt().disable("table").use(markdownItTable);
```

With the `commonmark` preset, `new MarkdownIt("commonmark").use(markdownItTable)` is enough. That preset also sets `html: true`, so raw HTML in the source reaches the output. For untrusted input, pass `{ html: false }` with it or use the default preset. CommonJS works with `const { markdownItTable } = require("markdown-it-table");`. The plugin takes no options.

## Syntax

A table is a header row, a delimiter row, then one line per body row. In the delimiter row, `:--` aligns a column left, `:-:` centers it and `--:` aligns it right. A line without a `|` ends the table, and so does a line that starts another block, such as a blockquote, list, heading, fence or HTML block.

The plugin parses each body cell as markdown blocks, so a cell can hold a list, a blockquote, a heading or a thematic break.

```md
| Syntax | Cell          |
| ------ | ------------- |
| List   | - item        |
| Quote  | > quoted text |
```

renders as

<table>
<tr>
<th>
<p>Syntax</p>
</th>
<th>
<p>Cell</p>
</th>
</tr>
<tr>
<td>
<p>List</p>
</td>
<td>
<ul>
<li>item</li>
</ul>
</td>
</tr>
<tr>
<td>
<p>Quote</p>
</td>
<td>
<blockquote>
<p>quoted text</p>
</blockquote>
</td>
</tr>
</table>

<details>
<summary>HTML</summary>

```html
<table>
<tr>
<th>
<p>Syntax</p>
</th>
<th>
<p>Cell</p>
</th>
</tr>
<tr>
<td>
<p>List</p>
</td>
<td>
<ul>
<li>item</li>
</ul>
</td>
</tr>
<tr>
<td>
<p>Quote</p>
</td>
<td>
<blockquote>
<p>quoted text</p>
</blockquote>
</td>
</tr>
</table>
```

</details>

### Cells

- Header cells take inline markdown only.
- A row is one line, so a cell's content has to fit on it.
- The plugin ignores the spaces and tabs around a cell's content, so a padded cell never turns into an indented code block.
- A cell holding only a list marker, like `| - |` or `| 1. |`, renders as that text.
- `\|` and a `|` inside a code span don't split a cell.

## Differences from markdown-it's table

- Plain text in a cell goes in a `<p>`, header cells included.
- There is no `<thead>` or `<tbody>`. Rows go straight into `<table>`.
- Rows keep the cells they're written with. markdown-it pads short rows and drops extra cells to match the header.
- A `|` inside a code span stays in the cell. markdown-it splits the cell there.
