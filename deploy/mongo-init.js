// Runs only when the named MongoDB volume is first initialized.
const username = process.env.MONGO_APP_USERNAME;
const password = process.env.MONGO_APP_PASSWORD;
if (!username || !password || password.length < 32) {
  throw new Error('Set a database application username and a unique password of at least 32 characters.');
}
db.getSiblingDB('tenx').createUser({
  user: username,
  pwd: password,
  roles: [{ role: 'readWrite', db: 'tenx' }],
});
