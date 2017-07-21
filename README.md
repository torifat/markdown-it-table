# markdown-it-table
[![CircleCI branch](https://img.shields.io/circleci/project/github/torifat/markdown-it-table/master.svg)]() [![NPM version](https://img.shields.io/npm/v/markdown-it-table.svg?style=flat)](https://www.npmjs.org/package/markdown-it-table)

> Plugin for [markdown-it](https://github.com/markdown-it/markdown-it) markdown parser, adding table with nested block syntax support.

## Install

```bash
$ yarn add markdown-it-table
```

## Use

### init

```js
var md = require('markdown-it')();
var table = require('markdown-it-table');

md.use(table [, options]);
```
