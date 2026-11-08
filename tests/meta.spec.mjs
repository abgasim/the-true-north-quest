// Every @TAG scenario in specs/TEST-SPECS.feature must have a test whose title starts with it,
// and every tagged test must be documented in the feature file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './support/harness.mjs';

test('@META feature file and test suite cover each other', () => {
  const feature = fs.readFileSync(path.join(ROOT, 'specs', 'TEST-SPECS.feature'), 'utf8');
  const specTags = new Set([...feature.matchAll(/^\s*@([A-Z0-9-]+)\s*$/gm)].map((m) => m[1]));
  const code = fs.readdirSync(path.join(ROOT, 'tests')).filter((f) => f.endsWith('.spec.mjs') && f !== 'meta.spec.mjs')
    .map((f) => fs.readFileSync(path.join(ROOT, 'tests', f), 'utf8')).join('\n');
  const testTags = new Set([...code.matchAll(/test\(\s*[`'"]@([A-Z0-9-]+)/g)].map((m) => m[1]));
  assert.deepEqual([...specTags].filter((t) => !testTags.has(t)), [], 'scenarios without a test');
  assert.deepEqual([...testTags].filter((t) => !specTags.has(t)), [], 'tests without a scenario');
});
