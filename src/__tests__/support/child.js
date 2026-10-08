import { expect } from "vitest";

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../..", import.meta.url));
const plugin = new URL("../../index.js", import.meta.url).href;

// Runs `script` in a new Node process with a capped heap and a timeout, so a
// parser regression fails the test instead of exhausting or hanging the runner.
// The script sees the document from stdin as `input`, plus `MarkdownIt` and
// `markdownItTable`, and reports through stdout.
export function runInChild(script, input, { heapMb = 128, timeout = 10000, flags = [] } = {}) {
  const result = spawnSync(
    process.execPath,
    [
      `--max-old-space-size=${heapMb}`,
      ...flags,
      "--input-type=module",
      "--eval",
      `import fs from "node:fs";
       import MarkdownIt from "markdown-it";
       import { markdownItTable } from ${JSON.stringify(plugin)};
       const input = fs.readFileSync(0, "utf8");
       ${script}`,
    ],
    { cwd: root, input, encoding: "utf8", timeout, maxBuffer: 64 * 1024 * 1024 },
  );

  expect(result.error, result.stderr).toBeUndefined();
  expect(result.signal, result.stderr).toBeNull();
  expect(result.status, result.stderr).toBe(0);
  return result.stdout;
}

export function renderInChild(input, preset, options) {
  return runInChild(
    `process.stdout.write(new MarkdownIt(${JSON.stringify(preset)})
       .disable("table").use(markdownItTable).render(input));`,
    input,
    options,
  );
}
