const express = require("express");
const helmet = require("helmet");
const { rateLimit } = require("express-rate-limit");
const mongoose = require("mongoose");
const { identify, fail } = require("./lib/security");
function createApp() {
  const app = express();
  app.disable("x-powered-by");
  // Enable proxy trust only for a known deployment's exact proxy hop count.
  if (process.env.TRUST_PROXY_HOPS)
    app.set("trust proxy", Number(process.env.TRUST_PROXY_HOPS));
  app.use(helmet());
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "8kb" }));
  app.get("/api/health", (req, res) =>
    res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({
      status: mongoose.connection.readyState === 1 ? "ok" : "unavailable",
    }),
  );
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("X-Requested-With") !== "TenX")
        return res.status(403).json({ error: "Request verification failed." });
      const origin = req.get("Origin");
      if (
        origin &&
        origin !== (process.env.APP_ORIGIN || "http://localhost:5173")
      )
        return res.status(403).json({ error: "Origin is not allowed." });
    }
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 2400,
      skip: (req) => !["GET", "HEAD", "OPTIONS"].includes(req.method),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Try again shortly." },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 60,
      skip: (req) => ["GET", "HEAD", "OPTIONS"].includes(req.method),
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many changes. Try again shortly." },
    }),
  );
  app.use("/api", identify);
  app.use("/api/auth", require("./routes/auth").router);
  app.use("/api/groups", require("./routes/groups"));
  app.use("/api", require("./routes/moderation"));
  app.use((req, res) => res.status(404).json({ error: "Not found." }));
  app.use((error, req, res, next) => {
    let status = error.status || 500;
    if (
      error.name === "CastError" ||
      error.name === "ValidationError" ||
      error.type === "entity.parse.failed"
    )
      status = 400;
    if (error.code === 11000) status = 409;
    if (status >= 500) console.error("API request failed:", error.name);
    res.status(status).json({
      error:
        status >= 500
          ? "Something went wrong. Try again shortly."
          : error.code === 11000
            ? "This record already exists."
            : error.message,
    });
  });
  return app;
}
module.exports = { createApp };
