import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
if (Number(process.versions.node.split('.')[0]) !== 24) throw new Error('Use Node.js 24 LTS.');
if (!existsSync(`${root}.env`)) {
  const password = randomBytes(32).toString('hex');
  writeFileSync(`${root}.env`, `MONGO_INITDB_ROOT_USERNAME=tenx\nMONGO_INITDB_ROOT_PASSWORD=${password}\nMONGO_URI=mongodb://tenx:${password}@127.0.0.1:27017/tenx?authSource=admin\nAPP_ORIGIN=http://localhost:5173\nWEB_PORT=8080\n`, { mode: 0o600, flag: 'wx' });
  console.log('Created ignored .env with a random local database password.');
}
for (const directory of ['backend', 'client']) {
  execFileSync('npm', ['ci', '--no-audit', '--no-fund'], { cwd: `${root}${directory}`, stdio: 'inherit' });
}
execFileSync('docker', ['compose', '-f', 'compose.yaml', '-f', 'compose.mongo.yaml', 'up', '-d', '--wait', 'mongo'], { cwd: root, stdio: 'inherit' });
execFileSync('npm', ['run', 'build'], { cwd: `${root}client`, stdio: 'inherit' });
console.log('Dependencies, MongoDB and client build are ready. See README for administrator bootstrap and development startup.');
