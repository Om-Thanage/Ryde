require("dotenv").config();
const mongoose = require("mongoose");
const crypto = require("node:crypto");
const { User, Invite } = require("../models");
const { passwordHash, digest } = require("../lib/security");
(async () => {
  const email = process.env.BOOTSTRAP_EMAIL;
  const password = process.env.BOOTSTRAP_PASSWORD;
  const alias = process.env.BOOTSTRAP_ALIAS || "Community admin";
  if (
    !email ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    !password ||
    password.length < 12 ||
    password.length > 128 ||
    alias.length > 32
  )
    throw new Error(
      "Set BOOTSTRAP_EMAIL, BOOTSTRAP_PASSWORD (12–128 characters) and optional BOOTSTRAP_ALIAS.",
    );
  await mongoose.connect(
    process.env.MONGO_URI || "mongodb://127.0.0.1:27017/tenx",
  );
  await User.init();
  if (await User.exists({ role: "admin" }))
    throw new Error(
      "Administrator already exists; use the signed-in invitation screen.",
    );
  await User.create({
    email: email.trim().toLowerCase(),
    alias,
    passwordHash: await passwordHash(password),
    role: "admin",
  });
  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await Invite.create({ codeHash: digest(code), expiresAt });
  console.log(
    `Administrator created. Single-use invite: ${code}\nExpires: ${expiresAt.toISOString()}`,
  );
})()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
