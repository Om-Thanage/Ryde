const mongoose = require("mongoose");
const { User, Session } = require("../models");
const { passwordHash } = require("../lib/security");
// Operator-only recovery. Stop the API before running so no active login can
// issue an old-password session while recovery revokes existing sessions.
async function resetPassword(email, password) {
  if (
    typeof email !== "string" ||
    !/^\S+@\S+\.\S+$/.test(email) ||
    email.length > 254 ||
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 128
  )
    throw new Error(
      "Set RECOVERY_EMAIL and RECOVERY_PASSWORD (12–128 characters).",
    );
  const user = await User.findOne({ email: email.trim().toLowerCase() })
    .select("_id")
    .lean();
  if (!user) throw new Error("No member matches RECOVERY_EMAIL.");
  const hash = await passwordHash(password);
  await User.updateOne({ _id: user._id }, { $set: { passwordHash: hash } });
  await Session.deleteMany({ userId: user._id });
}
if (require.main === module) {
  require("dotenv").config({ quiet: true });
  (async () => {
    if (!process.env.MONGO_URI)
      throw new Error("MONGO_URI must be configured.");
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 10000,
    });
    await resetPassword(
      process.env.RECOVERY_EMAIL,
      process.env.RECOVERY_PASSWORD,
    );
    console.log(
      "Password reset. All existing sessions revoked. Restart the API.",
    );
  })()
    .catch((error) => {
      console.error(error.name === "Error" ? error.message : error.name);
      process.exitCode = 1;
    })
    .finally(() => mongoose.disconnect());
}
module.exports = { resetPassword };
