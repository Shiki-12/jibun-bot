import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const EMOJI_REGEX = /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D]/gu;

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

test('F-M10: Zero Unicode Emoji Test Suite (test/no-emoji.test.js)', () => {
  const rootDir = path.resolve();
  const filesToScan = [
    ...scanDir(path.join(rootDir, 'src')),
    ...scanDir(path.join(rootDir, 'scripts')),
  ];

  const singleFiles = [
    path.join(rootDir, 'README.md'),
    path.join(rootDir, '.env.example'),
  ];

  for (const sf of singleFiles) {
    if (fs.existsSync(sf)) {
      filesToScan.push(sf);
    }
  }

  const violations = [];

  for (const filePath of filesToScan) {
    const relativePath = path.relative(rootDir, filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split(/\r?\n/);

    lines.forEach((line, index) => {
      if (line.includes('emoji-ok:')) {
        return;
      }
      const matches = line.match(EMOJI_REGEX);
      if (matches) {
        violations.push({
          file: relativePath,
          line: index + 1,
          matches,
          text: line.trim(),
        });
      }
    });
  }

  assert.equal(
    violations.length,
    0,
    `Ditemukan ${violations.length} pelanggaran Unicode Emoji:\n` +
      violations.map((v) => `  - ${v.file}:${v.line} [${v.matches.join(', ')}] -> ${v.text}`).join('\n'),
  );
});

