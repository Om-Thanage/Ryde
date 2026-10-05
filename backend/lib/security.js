const crypto = require("node:crypto");
const { promisify } = require("node:util");
const scrypt = promisify(crypto.scrypt);
const { User, Session } = require("../models");
let activeHashes = 0;
async function derive(password, salt) {
  if (activeHashes >= 2)
    fail("Authentication is busy. Try again shortly.", 429);
  activeHashes++;
  try {
    return await scrypt(password, salt, 64, {
      N: 131072,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    });
  } finally {
    activeHashes--;
  }
}
const SESSION_MS = 7 * 86400000;
const digest = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");
async function passwordHash(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const key = await derive(password, salt);
  return `${salt}:${key.toString("hex")}`;
}
async function passwordMatches(password, stored) {
  const [salt, hash] = stored.split(":");
  const key = await derive(password, salt);
  const expected = Buffer.from(hash, "hex");
  return (
    key.length === expected.length && crypto.timingSafeEqual(key, expected)
  );
}
const cookieOptions = () => ({
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.NODE_ENV === "production",
  path: "/",
});
function cookieToken(req) {
  const match = (req.headers.cookie || "").match(
    /(?:^|;\s*)tenx_session=([a-f0-9]{64})(?:;|$)/,
  );
  return match?.[1];
}
async function createSession(res, user) {
  const token = crypto.randomBytes(32).toString("hex");
  await Session.create({
    tokenHash: digest(token),
    userId: user._id,
    expiresAt: new Date(Date.now() + SESSION_MS),
  });
  res.cookie("tenx_session", token, { ...cookieOptions(), maxAge: SESSION_MS });
}
async function identify(req, res, next) {
  const token = cookieToken(req);
  if (token) {
    const session = await Session.findOne({
      tokenHash: digest(token),
      expiresAt: { $gt: new Date() },
    }).lean();
    if (session)
      req.user = await User.findOne({ _id: session.userId, suspended: false })
        .select("_id alias role passwordHash")
        .lean();
  }
  next();
}
function authenticated(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "Sign in to continue." });
  next();
}
function admin(req, res, next) {
  if (req.user?.role !== "admin")
    return res.status(403).json({ error: "Administrator access required." });
  next();
}
const publicUser = (user) => ({
  id: String(user._id),
  alias: user.alias,
  role: user.role,
});
function body(req, keys) {
  if (req.body === undefined && keys.length === 0) return;
  if (
    !req.body ||
    typeof req.body !== "object" ||
    Array.isArray(req.body) ||
    Object.keys(req.body).some((key) => !keys.includes(key))
  )
    throw Object.assign(new Error("Invalid request body."), { status: 400 });
}
function string(value, min, max) {
  return (
    typeof value === "string" && value.length >= min && value.length <= max
  );
}
function fail(message, status = 400) {
  throw Object.assign(new Error(message), { status });
}
module.exports = {
  digest,
  passwordHash,
  passwordMatches,
  cookieOptions,
  cookieToken,
  createSession,
  identify,
  authenticated,
  admin,
  publicUser,
  body,
  string,
  fail,
};
