require("dotenv").config({ quiet: true });
const mongoose = require("mongoose");
const { createApp } = require("./app");
let server;
async function start() {
  if (process.env.NODE_ENV === "production") {
    if (
      !process.env.MONGO_URI ||
      !process.env.APP_ORIGIN ||
      !/^https:\/\/[^/]+$/.test(process.env.APP_ORIGIN)
    )
      throw new Error(
        "Production requires MONGO_URI and an HTTPS APP_ORIGIN with no trailing slash.",
      );
    if (
      process.env.TRUST_PROXY_HOPS &&
      !/^[1-5]$/.test(process.env.TRUST_PROXY_HOPS)
    )
      throw new Error(
        "TRUST_PROXY_HOPS must be an exact proxy count from 1 to 5.",
      );
  }
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tenx",
    { serverSelectionTimeoutMS: 10000 },
  );
  await Promise.all(
    Object.values(require("./models")).map((model) => model.init()),
  );
  server = createApp().listen(Number(process.env.PORT || 3000), "0.0.0.0", () =>
    console.log(`TenX API listening on port ${process.env.PORT || 3000}`),
  );
}
let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 10000);
  timeout.unref();
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  clearTimeout(timeout);
}
process.on("SIGTERM", () => shutdown().then(() => process.exit(0)));
process.on("SIGINT", () => shutdown().then(() => process.exit(0)));
start().catch((error) => {
  console.error(
    "Startup failed:",
    error.name === "Error" ? error.message : error.name,
  );
  mongoose.disconnect().finally(() => process.exit(1));
});
