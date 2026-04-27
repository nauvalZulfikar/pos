#!/usr/bin/env node
// Create a new ADR file from template.
import { readdir, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const root = new URL('../..', import.meta.url).pathname;
const adrDir = join(root, 'docs/architecture/adr');

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('usage: pnpm adr:new "title in plain language"');
  process.exit(1);
}

await mkdir(adrDir, { recursive: true });
const existing = (await readdir(adrDir).catch(() => [])).filter((n) => /^\d{4}-/.test(n));
const nextNum = (existing.length + 1).toString().padStart(4, '0');
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const file = join(adrDir, `${nextNum}-${slug}.md`);

const today = new Date().toISOString().slice(0, 10);
const body = `# ADR ${nextNum} — ${title}

- **Status:** Proposed
- **Date:** ${today}
- **Owner:** TBD

## Context

What is the issue we're addressing?

## Decision

What is the change we're making?

## Consequences

What becomes easier? What becomes harder?

## Alternatives considered

What did we evaluate and why did we reject those?
`;

await writeFile(file, body, 'utf8');
console.warn(`created ${file}`);
