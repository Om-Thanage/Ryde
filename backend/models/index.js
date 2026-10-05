const mongoose = require("mongoose");
const { Schema } = mongoose;
const expiry = { type: Date, required: true, index: { expires: 0 } };
const User = mongoose.model(
  "User",
  new Schema(
    {
      alias: { type: String, required: true },
      email: { type: String, required: true, unique: true },
      passwordHash: { type: String, required: true },
      role: { type: String, enum: ["member", "admin"], default: "member" },
      suspended: { type: Boolean, default: false },
    },
    { timestamps: true },
  ),
  "tenx_members",
);
const Session = mongoose.model(
  "Session",
  new Schema({
    tokenHash: { type: String, unique: true, required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    expiresAt: expiry,
  }),
  "tenx_sessions",
);
const Invite = mongoose.model(
  "Invite",
  new Schema({
    codeHash: { type: String, unique: true, required: true },
    expiresAt: expiry,
    usedAt: Date,
  }),
  "tenx_invites",
);
const Group = mongoose.model(
  "Group",
  new Schema(
    {
      direction: {
        type: String,
        enum: ["to-station", "to-tenx"],
        required: true,
      },
      departureAt: { type: Date, required: true, index: true },
      windowMinutes: Number,
      meetingPoint: String,
      hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      hostAlias: String,
      memberIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
      status: {
        type: String,
        enum: ["active", "cancelled"],
        default: "active",
      },
      expiresAt: expiry,
    },
    { timestamps: true },
  ),
  "tenx_groups",
);
const Message = mongoose.model(
  "Message",
  new Schema({
    groupId: { type: Schema.Types.ObjectId, required: true, index: true },
    authorId: { type: Schema.Types.ObjectId, required: true },
    alias: String,
    text: String,
    createdAt: { type: Date, default: Date.now },
    expiresAt: expiry,
  }),
  "tenx_messages",
);
const Report = mongoose.model(
  "Report",
  new Schema({
    groupId: { type: Schema.Types.ObjectId, required: true },
    reporterId: Schema.Types.ObjectId,
    reporterAlias: String,
    reason: { type: String, enum: ["spam", "harassment", "unsafe", "other"] },
    status: { type: String, default: "open", enum: ["open", "resolved"] },
    createdAt: { type: Date, default: Date.now },
    expiresAt: expiry,
  }),
  "tenx_reports",
);
module.exports = { User, Session, Invite, Group, Message, Report };
