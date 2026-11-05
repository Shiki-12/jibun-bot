import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const FORBIDDEN_WORDS_REGEX = /\b(mika|cewek|wanita|perempuan|gadis|girl|female|waifu|cute-girl|calm-girl|energetic-female|sayangku)\b/i;

function scanDir(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDir(fullPath, fileList);
      }
    } else if (entry.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

test('F-M10: No Leftover Female Persona Keywords Test Suite (test/leftover-female.test.js)', () => {
  const rootDir = path.resolve();
  const srcDir = path.join(rootDir, 'src');
  const filesToScan = scanDir(srcDir);

  const violations = [];

  for (const filePath of filesToScan) {
    const relativePath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.includes('female-ok:')) {
        return;
      }
      const match = line.match(FORBIDDEN_WORDS_REGEX);
      if (match) {
        violations.push({
          file: relativePath,
          line: index + 1,
          word: match[0],
          text: line.trim(),
        });
      }
    });
  }

  assert.equal(
    violations.length,
    0,
    `Ditemukan ${violations.length} kata terlarang persona perempuan:\n` +
      violations.map((v) => `  - ${v.file}:${v.line} [${v.word}] -> ${v.text}`).join('\n'),
  );
});

