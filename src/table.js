// Copied from https://github.com/markdown-it/markdown-it/blob/master/lib/rules_block/table.js

const LIST_RE = /^ {0,3}(\d+\.|\*|-)$/;
const BLOCKQUOTE_RE = /^(?<space> {0,3})>/;

function isSpace(code) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true;
  }
  return false;
}

function getLine(state, line) {
  var pos = state.bMarks[line] + state.blkIndent,
    max = state.eMarks[line];

  return state.src.substr(pos, max - pos);
}

function escapedSplit(str) {
  var result = [],
    pos = 0,
    max = str.length,
    ch,
    escapes = 0,
    lastPos = 0,
    backTicked = false,
    lastBackTick = 0;

  ch = str.charCodeAt(pos);

  while (pos < max) {
    if (ch === 0x60 /* ` */) {
      if (backTicked) {
        // make \` close code sequence, but not open it;
        // the reason is: `\` is correct code block
        backTicked = false;
        lastBackTick = pos;
      } else if (escapes % 2 === 0) {
        backTicked = true;
        lastBackTick = pos;
      }
    } else if (ch === 0x7c /* | */ && escapes % 2 === 0 && !backTicked) {
      result.push(str.substring(lastPos, pos));
      lastPos = pos + 1;
    }

    if (ch === 0x5c /* \ */) {
      escapes++;
    } else {
      escapes = 0;
    }

    pos++;

    // If there was an un-closed backtick, go back to just after
    // the last backtick, but as if it was a normal character
    if (pos === max && backTicked) {
      backTicked = false;
      pos = lastBackTick + 1;
    }

    ch = str.charCodeAt(pos);
  }

  result.push(str.substring(lastPos));

  return result;
}

export default function table(state, startLine, endLine, silent) {
  var ch,
    lineText,
    pos,
    i,
    nextLine,
    columns,
    columnCount,
    token,
    aligns,
    t,
    tableLines,
    tbodyLines;

  // should have at least two lines
  if (startLine + 2 > endLine) {
    return false;
  }

  nextLine = startLine + 1;

  if (state.sCount[nextLine] < state.blkIndent) {
    return false;
  }

  // if it's indented more than 3 spaces, it should be a code block
  if (state.sCount[nextLine] - state.blkIndent >= 4) {
    return false;
  }

  // first character of the second line should be '|', '-', ':',
  // and no other characters are allowed but spaces;
  // basically, this is the equivalent of /^[-:|][-:|\s]*$/ regexp

  pos = state.bMarks[nextLine] + state.tShift[nextLine];
  if (pos >= state.eMarks[nextLine]) {
    return false;
  }

  ch = state.src.charCodeAt(pos++);
  if (ch !== 0x7c /* | */ && ch !== 0x2d /* - */ && ch !== 0x3a /* : */) {
    return false;
  }

  while (pos < state.eMarks[nextLine]) {
    ch = state.src.charCodeAt(pos);

    if (
      ch !== 0x7c /* | */ &&
      ch !== 0x2d /* - */ &&
      ch !== 0x3a /* : */ &&
      !isSpace(ch)
    ) {
      return false;
    }

    pos++;
  }

  lineText = getLine(state, startLine + 1);

  columns = lineText.split("|");
  aligns = [];
  for (i = 0; i < columns.length; i++) {
    t = columns[i].trim();
    if (!t) {
      // allow empty columns before and after table, but not in between columns;
      // e.g. allow ` |---| `, disallow ` ---||--- `
      if (i === 0 || i === columns.length - 1) {
        continue;
      } else {
        return false;
      }
    }

    if (!/^:?-+:?$/.test(t)) {
      return false;
    }
    if (t.charCodeAt(t.length - 1) === 0x3a /* : */) {
      aligns.push(t.charCodeAt(0) === 0x3a /* : */ ? "center" : "right");
    } else if (t.charCodeAt(0) === 0x3a /* : */) {
      aligns.push("left");
    } else {
      aligns.push("");
    }
  }

  lineText = getLine(state, startLine).trim();
  if (lineText.indexOf("|") === -1) {
    return false;
  }
  if (state.sCount[startLine] - state.blkIndent >= 4) {
    return false;
  }
  columns = escapedSplit(lineText.replace(/^\||\|$/g, ""));

  // header row will define an amount of columns in the entire table,
  // and align row shouldn't be smaller than that (the rest of the rows can)
  columnCount = columns.length;
  if (columnCount > aligns.length) {
    return false;
  }

  if (silent) {
    return true;
  }

  token = state.push("table_open", "table", 1);
  token.map = tableLines = [startLine, 0];

  // token     = state.push('thead_open', 'thead', 1);
  // token.map = [ startLine, startLine + 1 ];

  token = state.push("tr_open", "tr", 1);
  token.map = [startLine, startLine + 1];

  for (i = 0; i < columns.length; i++) {
    token = state.push("th_open", "th", 1);
    token.map = [startLine, startLine + 1];
    if (aligns[i]) {
      token.attrs = [["style", "text-align:" + aligns[i]]];
    }

    token = state.push("paragraph_open", "p", 1);
    token = state.push("inline", "", 0);
    token.content = columns[i].trim();
    token.map = [startLine, startLine + 1];
    token.children = [];
    token = state.push("paragraph_close", "p", -1);

    token = state.push("th_close", "th", -1);
  }

  token = state.push("tr_close", "tr", -1);
  token.map = tbodyLines = [startLine + 2, 0];

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) {
      break;
    }

    lineText = getLine(state, nextLine).trim();
    if (lineText.indexOf("|") === -1) {
      break;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      break;
    }
    columns = escapedSplit(lineText.replace(/^\||\|$/g, ""));

    token = state.push("tr_open", "tr", 1);

    for (let i = 0, offset = 1; i < columns.length; i++) {
      token = state.push("td_open", "td", 1);
      if (aligns[i]) {
        token.attrs = [["style", "text-align:" + aligns[i]]];
      }

      // https://github.com/markdown-it/markdown-it/blob/e6f19eab4204122e85e4a342e0c1c8486ff40c2d/lib/rules_block/state_block.js#L25
      // bMarks => line begin offsets for fast jumps
      // eMarks => line end offsets for fast jumps
      // tShift => offsets of the first non-space characters (tabs not expanded)
      // sCount => indents for each line (tabs expanded)

      let shift = 0, ret;
      if (ret = BLOCKQUOTE_RE.exec(columns[i])) {
        shift = ret.groups.space.length;
      } else if (ret = LIST_RE.exec(columns[i])) {
        shift = ret.input.length;
      }

      state.bMarks[nextLine] += offset + state.tShift[nextLine] + shift;
      state.tShift[nextLine] = 0;
      state.sCount[nextLine] = 0;
      offset = (columns[i] || "").length + 1;
      state.eMarks[nextLine] = state.bMarks[nextLine] + offset - shift - 1;
      state.lineMax = 1;
      state.md.block.tokenize(state, nextLine, nextLine + 1);

      token = state.push("td_close", "td", -1);
    }

    token = state.push("tr_close", "tr", -1);
  }
  token = state.push("table_close", "table", -1);

  tbodyLines[1] = nextLine;
  state.line = nextLine;
  return true;
}
