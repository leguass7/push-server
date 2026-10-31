import { spawnSync } from 'node:child_process';

const extra = process.argv.slice(2);
const token = spawnSync('gh', ['auth', 'token'], { encoding: 'utf8' });
if (token.status !== 0) {
  process.stderr.write('gh auth token falhou. Rode `gh auth login`.\n');
  process.exit(token.status ?? 1);
}

const result = spawnSync('pnpm', ['exec', 'release-it', ...extra], {
  stdio: 'inherit',
  env: {
    ...process.env,
    GH_TOKEN: token.stdout.trim(),
    GITHUB_TOKEN: token.stdout.trim(),
  },
});

process.exit(result.status ?? 1);
