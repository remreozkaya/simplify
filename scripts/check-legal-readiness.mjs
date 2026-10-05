import { readFileSync } from 'node:fs';
import nextEnv from '@next/env';
const { loadEnvConfig } = nextEnv;
import { legalLaunchBlockers } from '../src/lib/legal/readiness.mjs';
loadEnvConfig(process.cwd(), false, { info() {}, error() {} });
const config = JSON.parse(readFileSync(new URL('../src/lib/legal/operator.json', import.meta.url), 'utf8'));
const blockers = legalLaunchBlockers(config);
if (blockers.length) {
  console.error('Legal production readiness FAILED. Missing facts/reviews (no secret values shown):');
  for (const blocker of blockers) console.error(`- ${blocker}`);
  process.exitCode = 1;
} else {
  console.log('Legal configuration check passed. This does not certify legal compliance; retain evidence of each operational review.');
}
