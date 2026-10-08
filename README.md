# markdown-it-table

[![CI](https://github.com/torifat/markdown-it-table/actions/workflows/ci.yml/badge.svg)](https://github.com/torifat/markdown-it-table/actions/workflows/ci.yml) [![NPM version](https://img.shields.io/npm/v/markdown-it-table.svg?style=flat)](https://www.npmjs.org/package/markdown-it-table)

> Plugin for [markdown-it](https://github.com/markdown-it/markdown-it) markdown parser, adding table with nested block syntax support.

## Install

```bash
$ yarn add markdown-it-table
```

## Use

### init

```js
var md = require('markdown-it')();
var { markdownItTable } = require('markdown-it-table');

md.use(markdownItTable [, options]);
```
