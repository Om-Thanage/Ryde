const { execFileSync } = require('node:child_process');
const { root, testUri } = require('./test-env.cjs');
execFileSync(process.execPath, ['--test', 'test/integration.test.js'], {
  cwd: `${root}/backend`,
  env: { ...process.env, TEST_MONGO_URI: testUri('tenx_backend', process.env.TEST_MONGO_URI) },
  stdio: 'inherit',
});
