const { testUri } = require('./test-env.cjs');
process.env.MONGO_URI = testUri('tenx_browser', process.env.E2E_MONGO_URI);
process.env.PORT = '3100';
process.env.APP_ORIGIN = 'http://localhost:4173';
process.env.NODE_ENV = 'test';
require('../backend/server.js');
