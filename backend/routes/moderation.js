const express = require("express");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { Report, Invite, Group, User } = require("../models");
const { authenticated, admin, body, fail, digest } = require("../lib/security");
const { removeParticipation } = require("./auth");
const { withUserLock } = require("../lib/mutations");
const router = require("../lib/mutations").mutationRouter();
router.use(authenticated);
router.post("/reports", async (req, res) => {
  body(req, ["groupId", "reason"]);
  const { groupId, reason } = req.body;
  if (
    !mongoose.isValidObjectId(groupId) ||
    !["spam", "harassment", "unsafe", "other"].includes(reason)
  )
    fail("Select a group and valid report reason.");
  if (!(await Group.exists({ _id: groupId, expiresAt: { $gt: new Date() } })))
    fail("Group not found.", 404);
  if (
    await Report.exists({ groupId, reporterId: req.user._id, status: "open" })
  )
    fail("You have already reported this group.", 409);
  await Report.create({
    groupId,
    reason,
    reporterId: req.user._id,
    reporterAlias: req.user.alias,
    expiresAt: new Date(Date.now() + 30 * 86400000),
  });
  res.json({ ok: true });
});
router.use("/admin", admin);
router.get("/admin/members", async (req, res) => {
  const raw = req.query.page === undefined ? "1" : req.query.page;
  if (
    typeof raw !== "string" ||
    !/^\d{1,5}$/.test(raw) ||
    Number(raw) < 1 ||
    Number(raw) > 10000
  )
    fail("Invalid page.");
  const page = Number(raw);
  const members = await User.find({})
    .select("_id alias role suspended")
    .sort({ alias: 1, _id: 1 })
    .skip((page - 1) * 100)
    .limit(101)
    .lean();
  res.json({
    members: members
      .slice(0, 100)
      .map((user) => ({
        id: String(user._id),
        alias: user.alias,
        role: user.role,
        suspended: user.suspended,
      })),
    page,
    hasMore: members.length > 100,
  });
});
router.get("/admin/reports", async (req, res) => {
  const reports = await Report.find({ expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .limit(200)
    .select("_id reason groupId reporterAlias createdAt status")
    .lean();
  res.json({
    reports: reports.map((report) => ({
      id: String(report._id),
      reason: report.reason,
      groupId: String(report.groupId),
      reporterAlias: report.reporterAlias,
      createdAt: report.createdAt.toISOString(),
      status: report.status,
    })),
  });
});
router.post("/admin/reports/:id/resolve", async (req, res) => {
  body(req, []);
  if (
    !mongoose.isValidObjectId(req.params.id) ||
    !(await Report.findOneAndUpdate(
      { _id: req.params.id, expiresAt: { $gt: new Date() } },
      { $set: { status: "resolved" } },
    ))
  )
    fail("Report not found.", 404);
  res.json({ ok: true });
});
router.post("/admin/invites", async (req, res) => {
  body(req, []);
  const code = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await Invite.create({ codeHash: digest(code), expiresAt });
  res.json({ code, expiresAt: expiresAt.toISOString() });
});
router.post("/admin/members/:id/suspend", async (req, res) => {
  body(req, []);
  if (!mongoose.isValidObjectId(req.params.id)) fail("Member not found.", 404);
  if (String(req.user._id) === req.params.id)
    fail("You cannot suspend yourself.");
  const target = await User.findById(req.params.id).select("role").lean();
  if (!target || target.role === "admin")
    fail("Member not found or is an administrator.", 404);
  await withUserLock(req.params.id, async () => {
    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $ne: "admin" } },
      { $set: { suspended: true } },
      { new: true },
    );
    if (!user) fail("Member not found or is an administrator.", 404);
    await removeParticipation(user._id);
  });
  res.json({ ok: true });
});
module.exports = router;
