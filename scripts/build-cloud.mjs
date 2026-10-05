// The cloud proxy needs a host mapping inside BuildKit; normal deployments can use Compose directly.
import { lookup } from 'node:dns/promises';
import { mkdtemp, writeFile, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
let directory;
try {
  const proxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (!proxy) throw new Error('This helper requires the cloud HTTPS_PROXY or HTTP_PROXY binding. Use docker compose build outside the cloud.');
  const hostname = new URL(proxy).hostname;
  const { address } = await lookup(hostname);
  const args = Object.fromEntries(['HTTP_PROXY', 'HTTPS_PROXY', 'NO_PROXY']
    .filter(name => process.env[name])
    .map(name => [name, process.env[name]]));
  const ca = process.env.NODE_EXTRA_CA_CERTS;
  if (ca) await access(ca);
  const build = { network: 'host', extra_hosts: [`${hostname}:${address}`], args };
  if (ca) build.secrets = ['npm_ca'];
  const config = { services: { api: { build }, web: { build } } };
  if (ca) config.secrets = { npm_ca: { file: ca } };
  directory = await mkdtemp(join(tmpdir(), 'tenx-build-'));
  const override = join(directory, 'compose.json');
  await writeFile(override, JSON.stringify(config), { mode: 0o600 });
  const child = spawn('docker', ['compose', '-f', 'compose.yaml', '-f', 'compose.mongo.yaml', '-f', override, 'build'], {
    cwd: root,
    env: { ...process.env, DOCKER_CONFIG: process.env.DOCKER_CONFIG || '/workspace/.docker-cache' },
    stdio: 'inherit',
  });
  const interrupt = signal => child.kill(signal);
  const onInterrupt = () => interrupt('SIGINT');
  const onTerminate = () => interrupt('SIGTERM');
  process.on('SIGINT', onInterrupt);
  process.on('SIGTERM', onTerminate);
  try {
    process.exitCode = await new Promise((resolve, reject) => {
      child.on('error', reject);
      child.on('exit', (code, signal) => resolve(code ?? (signal ? 1 : 0)));
    });
  } finally {
    process.off('SIGINT', onInterrupt);
    process.off('SIGTERM', onTerminate);
  }
} catch {
  console.error('Cloud build failed. Check Docker access, proxy DNS, and the trusted NODE_EXTRA_CA_CERTS file. For a normal deployment, use docker compose build.');
  process.exitCode = 1;
} finally {
  if (directory) await rm(directory, { recursive: true, force: true });
}
