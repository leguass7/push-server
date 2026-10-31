import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Versão em `package.json` na raiz do processo (`cwd`). */
export function readAppVersion(cwd = process.cwd()): string {
  const raw = readFileSync(join(cwd, 'package.json'), 'utf8');
  const pkg = JSON.parse(raw) as { version?: unknown };
  return typeof pkg.version === 'string' ? pkg.version : '0.0.0';
}
