#!/usr/bin/env node
'use strict';

/**
 * Project-local Stop hook for Revenova.
 * On every session stop:
 *   1. Captures current git branch + modified/staged files
 *   2. Overwrites the ## Resume Point section in MEMORY.md
 *   3. Appends a timestamped entry to the ## Session Log section
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.resolve(__dirname, '../..');
const MEMORY_FILE = path.join(PROJECT_ROOT, '.claude/memory/MEMORY.md');

function git(cmd) {
  try {
    return execSync(cmd, { cwd: PROJECT_ROOT, encoding: 'utf8' }).trim();
  } catch (_) {
    return '';
  }
}

function main() {
  let event = {};
  try {
    const raw = fs.readFileSync('/dev/stdin', 'utf8');
    if (raw.trim()) event = JSON.parse(raw);
  } catch (_) {}

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 16);
  const sessionId = (event.session_id || 'unknown').slice(0, 8);

  const branch = git('git rev-parse --abbrev-ref HEAD') || 'unknown';
  const status = git('git status --short') || '(clean)';
  const lastCommit = git('git log -1 --oneline') || '';

  const resumeBlock = `## Resume Point
<!-- Auto-updated by session-end hook — edit "In progress" manually before stopping -->
- **Last stop:** ${timestamp}
- **Branch:** ${branch}
- **Last commit:** ${lastCommit}
- **Modified files:**
\`\`\`
${status}
\`\`\`
- **In progress:** _(update this manually before closing session)_`;

  const logEntry = `- ${timestamp} [${sessionId}] branch:${branch}\n`;

  try {
    let content = fs.readFileSync(MEMORY_FILE, 'utf8');

    // Replace Resume Point block
    content = content.replace(
      /## Resume Point[\s\S]*?(?=\n## |\n---|\Z)/,
      resumeBlock + '\n'
    );

    // Append session log entry
    content = content.replace(
      '<!-- Appended by .claude/hooks/session-end.js on Stop -->',
      `${logEntry}<!-- Appended by .claude/hooks/session-end.js on Stop -->`
    );

    fs.writeFileSync(MEMORY_FILE, content, 'utf8');
  } catch (err) {
    process.stderr.write(`[session-end] ${err.message}\n`);
  }

  process.exit(0);
}

main();
