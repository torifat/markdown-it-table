// Copied from https://github.com/markdown-it/markdown-it/blob/master/lib/rules_block/table.js

const LIST_RE = /^ {0,3}(\d+\.|\*|-)$/;
const BLOCKQUOTE_RE = /^(?<space> {0,3})>/;

// Openers of comments and raw text elements. A browser treats everything after
// one as part of it until the matching closer.
const RAW_TEXT_OPEN_RE =
  /<!--|<(script|style|textarea|title|xmp|iframe|noembed|noframes|plaintext)(?=[\s/>]|$)/gi;

// Whether `html` opens a comment or raw text element that it does not close.
// A cell ends at the next pipe, so its closer may be in another cell.
function leavesRawTextOpen(html) {
  const lower = html.toLowerCase();
  const opener = new RegExp(RAW_TEXT_OPEN_RE);
  let match;
  while ((match = opener.exec(lower))) {
    const closer = match[1] ? `</${match[1]}` : "-->";
    const end = lower.indexOf(closer, opener.lastIndex);
    if (end === -1) return true;
    opener.lastIndex = end + closer.length;
  }
  return false;
}

function isSpace(code) {
  switch (code) {
    case 0x09:
    case 0x20:
      return true;
  }
  return false;
}

function getLine(state, line) {
  var pos = state.bMarks[line] + state.tShift[line],
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
      // The character before `pos` is the backtick, so no escapes are pending.
      escapes = 0;
    }

    ch = str.charCodeAt(pos);
  }

  result.push(str.substring(lastPos));

  return result;
}

// Splits a trimmed row into cells. Only an unescaped pipe at either end is a
// delimiter, so `\|` at the end of a row stays in the last cell. A row of a
// single `|` is one empty cell.
function splitRow(lineText) {
  const columns = escapedSplit(lineText);
  if (columns.length && columns[0] === "") columns.shift();
  if (columns.length && columns[columns.length - 1] === "") columns.pop();
  return columns.length ? columns : [""];
}

// Parses a body cell as block content in a state of its own. Block rules then see
// only the cell's text: they cannot read the next cell's pipe, and the table's
// lines keep their original marks for the rules that run after the table.
function pushCell(state, text, line) {
  const tokensBeforeCell = state.tokens.length;
  let isInline = false;

  if (!LIST_RE.test(text)) {
    const ret = BLOCKQUOTE_RE.exec(text);
    const content = ret ? text.slice(ret.groups.space.length) : text;
    const cell = new state.md.block.State(content, state.md, state.env, state.tokens);
    // Padding before anything but `>` keeps the cell out of the block rules.
    cell.tShift[0] = 0;
    cell.sCount[0] = 0;
    cell.level = state.level;
    state.md.block.tokenize(cell, 0, cell.lineMax);

    const tokens = state.tokens.slice(tokensBeforeCell);
    // Raw HTML that stays open past the cell would swallow the rest of the page,
    // so the cell falls back to inline text, where markdown-it escapes it.
    isInline = tokens.some(
      (token) => token.type === "html_block" && leavesRawTextOpen(token.content),
    );
    if (isInline) {
      state.tokens.length = tokensBeforeCell;
    } else {
      for (const token of tokens) {
        if (token.map) token.map = [token.map[0] + line, token.map[1] + line];
      }
    }
  }

  if (state.tokens.length === tokensBeforeCell) {
    let token = state.push("paragraph_open", "p", 1);
    token = state.push("inline", "", 0);
    token.content = isInline ? text.trim() : "";
    token.map = [line, line + 1];
    token.children = [];
    state.push("paragraph_close", "p", -1);
  }
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

    if (ch !== 0x7c /* | */ && ch !== 0x2d /* - */ && ch !== 0x3a /* : */ && !isSpace(ch)) {
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
  columns = splitRow(lineText);

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

  const oldParentType = state.parentType;
  state.parentType = "table";
  // A line that starts another block ends the table, as in markdown-it's own tables.
  const terminatorRules = state.md.block.ruler.getRules("blockquote");

  for (nextLine = startLine + 2; nextLine < endLine; nextLine++) {
    if (state.sCount[nextLine] < state.blkIndent) {
      break;
    }

    if (terminatorRules.some((rule) => rule(state, nextLine, endLine, true))) {
      break;
    }

    lineText = getLine(state, nextLine).trim();
    if (lineText.indexOf("|") === -1) {
      break;
    }
    if (state.sCount[nextLine] - state.blkIndent >= 4) {
      break;
    }
    columns = splitRow(lineText);

    token = state.push("tr_open", "tr", 1);

    for (i = 0; i < columns.length; i++) {
      token = state.push("td_open", "td", 1);
      if (aligns[i]) {
        token.attrs = [["style", "text-align:" + aligns[i]]];
      }

      pushCell(state, columns[i], nextLine);

      token = state.push("td_close", "td", -1);
    }

    token = state.push("tr_close", "tr", -1);
  }
  token = state.push("table_close", "table", -1);

  tableLines[1] = tbodyLines[1] = nextLine;
  state.parentType = oldParentType;
  state.line = nextLine;
  return true;
}
