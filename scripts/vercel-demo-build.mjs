import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const source = readFileSync(new URL('../src/config/env.ts', import.meta.url), 'utf8');

function readQuotedConstant(name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*"([^"]+)"`));
  if (!match?.[1]) {
    throw new Error(`Missing ${name} in src/config/env.ts`);
  }
  return match[1];
}

const env = {
  ...process.env,
  VITE_DATA_BACKEND: 'supabase',
  VITE_ENVIRONMENT: 'staging',
  VITE_SUPABASE_URL: readQuotedConstant('LENA_DEMO_SUPABASE_URL'),
  VITE_SUPABASE_PUBLISHABLE_KEY: readQuotedConstant('LENA_DEMO_PUBLISHABLE_KEY'),
  VITE_CENTER_ID: readQuotedConstant('LENA_DEMO_CENTER_ID'),
  VITE_BRANCH_MODE: 'single',
};

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['run', 'build'], {
  stdio: 'inherit',
  env,
});

if (result.error) throw result.error;
process.exit(result.status ?? 1);
