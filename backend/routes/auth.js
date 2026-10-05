const express = require("express");
const { rateLimit } = require("express-rate-limit");
const { User, Invite, Session, Group, Message, Report } = require("../models");
const s = require("../lib/security");
const router = require("../lib/mutations").mutationRouter();
const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});
router.get("/me", (req, res) =>
  res.json({ user: req.user ? s.publicUser(req.user) : null }),
);
router.post("/register", authLimit, async (req, res) => {
  s.body(req, ["alias", "email", "password", "inviteCode"]);
  const { alias, email, password, inviteCode } = req.body;
  if (
    !s.string(alias, 2, 32) ||
    !/^[\p{L}\p{N} ._-]+$/u.test(alias) ||
    !s.string(email, 3, 254) ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !s.string(password, 12, 128) ||
    !s.string(inviteCode, 32, 128)
  )
    s.fail(
      "Use an alias, valid email, password of 12–128 characters and invitation code.",
    );
  const normalized = email.trim().toLowerCase();
  const hash = await s.passwordHash(password);
  if (await User.exists({ email: normalized }))
    s.fail("Registration details or invitation are unavailable.");
  const invite = await Invite.findOneAndUpdate(
    {
      codeHash: s.digest(inviteCode),
      usedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  if (!invite) s.fail("Registration details or invitation are unavailable.");
  let user;
  try {
    user = await User.create({
      alias: alias.trim(),
      email: normalized,
      passwordHash: hash,
    });
  } catch (error) {
    await Invite.updateOne({ _id: invite._id }, { $unset: { usedAt: 1 } });
    if (error.code === 11000)
      s.fail("Registration details or invitation are unavailable.");
    throw error;
  }
  await s.createSession(res, user);
  res.status(201).json({ user: s.publicUser(user) });
});
router.post("/login", authLimit, async (req, res) => {
  s.body(req, ["email", "password"]);
  const { email, password } = req.body;
  if (!s.string(email, 3, 254) || !s.string(password, 1, 128))
    s.fail("Email or password is incorrect.", 401);
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  // Always perform the same expensive password derivation, including for absent accounts.
  const hash =
    user?.passwordHash || "00000000000000000000000000000000:" + "00".repeat(64);
  const matches = await s.passwordMatches(password, hash);
  if (!matches || !user || user.suspended)
    s.fail("Email or password is incorrect.", 401);
  await s.createSession(res, user);
  res.json({ user: s.publicUser(user) });
});
router.post("/logout", async (req, res) => {
  const token = s.cookieToken(req);
  if (token) await Session.deleteOne({ tokenHash: s.digest(token) });
  res.clearCookie("tenx_session", s.cookieOptions());
  res.json({ ok: true });
});
async function removeParticipation(userId) {
  const hosted = await Group.find({
    hostId: userId,
    status: "active",
    departureAt: { $gt: new Date() },
  })
    .select("_id")
    .lean();
  for (const group of hosted) {
    await require("../lib/mutations").withUserLock(`group:${group._id}`, () =>
      Group.updateOne({ _id: group._id }, { $set: { status: "cancelled" } }),
    );
  }
  await Group.updateMany(
    { memberIds: userId },
    { $pull: { memberIds: userId } },
  );
  await Session.deleteMany({ userId });
}
router.delete("/account", s.authenticated, authLimit, async (req, res) => {
  s.body(req, ["password"]);
  if (
    !s.string(req.body.password, 1, 128) ||
    !(await s.passwordMatches(req.body.password, req.user.passwordHash))
  )
    s.fail("Password is incorrect.", 403);
  await removeParticipation(req.user._id);
  await Message.deleteMany({ authorId: req.user._id });
  await Report.updateMany(
    { reporterId: req.user._id },
    { $unset: { reporterId: 1 }, $set: { reporterAlias: "Deleted member" } },
  );
  await Group.updateMany(
    { hostId: req.user._id },
    { $set: { hostAlias: "Deleted member" } },
  );
  await User.deleteOne({ _id: req.user._id });
  res.clearCookie("tenx_session", s.cookieOptions());
  res.json({ ok: true });
});
module.exports = { router, removeParticipation };
