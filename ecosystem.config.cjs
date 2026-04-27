// pm2 ecosystem for DESAIN POS production on Aureonforge VPS.
// Ports: api=23000, worker=metrics 29091, admin=23001, pos=23180.
// All bind to 127.0.0.1 — exposed publicly only via host nginx.

const fs = require('node:fs');
const path = require('node:path');

function loadDotenv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
  }
  return env;
}

const baseEnv = loadDotenv(path.join(__dirname, '.env'));

module.exports = {
  apps: [
    {
      name: 'desain-api',
      cwd: '/root/projects/pos/apps/api',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      interpreter: 'node',
      env: {
        ...baseEnv,
        NODE_ENV: 'production',
        API_PORT: '23000',
        HOST: '127.0.0.1',
      },
      max_memory_restart: '600M',
      watch: false,
    },
    {
      name: 'desain-worker',
      cwd: '/root/projects/pos/apps/worker',
      script: 'node_modules/tsx/dist/cli.mjs',
      args: 'src/index.ts',
      interpreter: 'node',
      env: {
        ...baseEnv,
        NODE_ENV: 'production',
        WORKER_METRICS_PORT: '29091',
      },
      max_memory_restart: '500M',
      watch: false,
    },
    {
      name: 'desain-admin',
      cwd: '/root/projects/pos/apps/admin',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 23001 -H 127.0.0.1',
      interpreter: 'node',
      env: {
        ...baseEnv,
        NODE_ENV: 'production',
        PORT: '23001',
        API_BASE_URL: 'http://127.0.0.1:23000',
      },
      max_memory_restart: '700M',
      watch: false,
    },
    {
      name: 'desain-pos',
      cwd: '/root/projects/pos/apps/pos',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview --port 23180 --host 127.0.0.1 --strictPort',
      interpreter: 'node',
      env: {
        ...baseEnv,
        NODE_ENV: 'production',
      },
      max_memory_restart: '400M',
      watch: false,
    },
  ],
};
