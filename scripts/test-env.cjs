const path = require('node:path');
const root = path.resolve(__dirname, '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
function testUri(name, supplied) {
  if (supplied) {
    try {
      if (!new URL(supplied).pathname.slice(1).endsWith('_test')) throw new Error();
      return supplied;
    } catch { throw new Error('Tests require a dedicated MongoDB database ending in _test.'); }
  }
  const username = process.env.MONGO_INITDB_ROOT_USERNAME;
  const password = process.env.MONGO_INITDB_ROOT_PASSWORD;
  if (!username || !password) throw new Error('Set TEST_MONGO_URI/E2E_MONGO_URI to a dedicated test database or run local setup first.');
  return `mongodb://${encodeURIComponent(username)}:${encodeURIComponent(password)}@127.0.0.1:27017/${name}_test?authSource=admin`;
}
module.exports = { root, testUri };
