const express = require("express");
const mongoose = require("mongoose");
const { Group, Message, User } = require("../models");
const { authenticated, body, string, fail } = require("../lib/security");
const router = require("../lib/mutations").mutationRouter({ groups: true });
router.use(authenticated);
const points = {
  "to-station": ["tenx-main-gate", "tenx-auto-stand"],
  "to-tenx": ["station-west-auto-stand", "station-west-exit"],
};
const member = (group, user) =>
  group.memberIds.some((id) => String(id) === String(user._id));
function projection(group, user) {
  return {
    id: String(group._id),
    direction: group.direction,
    departureAt: group.departureAt.toISOString(),
    windowMinutes: group.windowMinutes,
    meetingPoint: group.meetingPoint,
    status: group.status,
    capacity: 3,
    memberCount: group.memberIds.length,
    hostAlias: group.hostAlias,
    isMember: member(group, user),
    isHost: String(group.hostId) === String(user._id),
  };
}
const messageProjection = (message, user) => ({
  id: String(message._id),
  alias: message.alias,
  text: message.text,
  createdAt: message.createdAt.toISOString(),
  isOwn: String(message.authorId) === String(user._id),
});
async function getGroup(id) {
  if (!mongoose.isValidObjectId(id)) fail("Group not found.", 404);
  const group = await Group.findOne({
    _id: id,
    expiresAt: { $gt: new Date() },
  }).lean();
  if (!group) fail("Group not found.", 404);
  return group;
}
async function room(req) {
  const group = await getGroup(req.params.id);
  if (!member(group, req.user))
    fail("Join this group to access its private room.", 403);
  return group;
}
router.get("/", async (req, res) => {
  const query = {
    status: "active",
    departureAt: { $gt: new Date(), $lt: new Date(Date.now() + 48 * 3600000) },
  };
  if (req.query.direction !== undefined) {
    if (!Object.hasOwn(points, req.query.direction)) fail("Invalid direction.");
    query.direction = req.query.direction;
  }
  if (req.query.date !== undefined) {
    if (
      typeof req.query.date !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(req.query.date)
    )
      fail("Invalid date.");
    const start = new Date(`${req.query.date}T00:00:00+05:30`);
    if (
      !Number.isFinite(start.getTime()) ||
      new Date(start.getTime() + 19800000).toISOString().slice(0, 10) !==
        req.query.date
    )
      fail("Invalid date.");
    query.departureAt = {
      $gte: new Date(Math.max(start.getTime(), Date.now())),
      $lt: new Date(start.getTime() + 86400000),
    };
  }
  const groups = await Group.find(query)
    .sort({ departureAt: 1 })
    .limit(100)
    .lean();
  res.json({ groups: groups.map((group) => projection(group, req.user)) });
});
router.get("/mine", async (req, res) => {
  const groups = await Group.find({
    $or: [{ memberIds: req.user._id }, { hostId: req.user._id }],
    departureAt: { $gt: new Date() },
    expiresAt: { $gt: new Date() },
  })
    .sort({ departureAt: 1 })
    .limit(100)
    .lean();
  res.json({ groups: groups.map((group) => projection(group, req.user)) });
});
router.post("/", async (req, res) => {
  body(req, ["direction", "departureAt", "windowMinutes", "meetingPoint"]);
  const { direction, departureAt, windowMinutes, meetingPoint } = req.body;
  if (
    typeof direction !== "string" ||
    typeof meetingPoint !== "string" ||
    !Object.hasOwn(points, direction) ||
    !points[direction].includes(meetingPoint) ||
    ![5, 10, 15].includes(windowMinutes) ||
    !string(departureAt, 20, 35) ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      departureAt,
    )
  )
    fail("Choose a valid direction, meeting point, departure and time window.");
  const departure = new Date(departureAt);
  const calendarDay = departureAt.slice(0, 10);
  const parsedDay = new Date(`${calendarDay}T00:00:00Z`);
  if (
    !Number.isFinite(parsedDay.getTime()) ||
    parsedDay.toISOString().slice(0, 10) !== calendarDay
  )
    fail("Invalid departure date.");
  if (
    !Number.isFinite(departure.getTime()) ||
    departure.getTime() < Date.now() + 300000 ||
    departure.getTime() > Date.now() + 7 * 86400000
  )
    fail("Departure must be between five minutes and seven days from now.");
  if (
    (await Group.countDocuments({
      hostId: req.user._id,
      status: "active",
      departureAt: { $gt: new Date() },
    })) >= 10
  )
    fail("You can host at most ten upcoming groups.", 409);
  const group = await Group.create({
    direction,
    departureAt: departure,
    windowMinutes,
    meetingPoint,
    hostId: req.user._id,
    hostAlias: req.user.alias,
    memberIds: [req.user._id],
    expiresAt: new Date(departure.getTime() + 86400000),
  });
  res.status(201).json({ group: projection(group, req.user) });
});
router.get("/:id", async (req, res) => {
  const group = await getGroup(req.params.id);
  const result = { group: projection(group, req.user) };
  if (member(group, req.user)) {
    result.members = (
      await User.find({ _id: { $in: group.memberIds }, suspended: false })
        .select("_id alias")
        .lean()
    ).map((user) => ({ id: String(user._id), alias: user.alias }));
    result.messages = (
      await Message.find({ groupId: group._id, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1, _id: -1 })
        .limit(100)
        .lean()
    )
      .reverse()
      .map((message) => messageProjection(message, req.user));
  }
  res.json(result);
});
router.post("/:id/join", async (req, res) => {
  body(req, []);
  if (!mongoose.isValidObjectId(req.params.id)) fail("Group not found.", 404);
  const group = await Group.findOneAndUpdate(
    {
      _id: req.params.id,
      status: "active",
      departureAt: { $gt: new Date() },
      memberIds: { $ne: req.user._id },
      $expr: { $lt: [{ $size: "$memberIds" }, 3] },
    },
    { $addToSet: { memberIds: req.user._id } },
    { returnDocument: 'after' },
  ).lean();
  if (!group) {
    const existing = await getGroup(req.params.id);
    if (
      member(existing, req.user) &&
      existing.status === "active" &&
      existing.departureAt > new Date()
    )
      return res.json({ group: projection(existing, req.user) });
    fail("This group is full or no longer available.", 409);
  }
  res.json({ group: projection(group, req.user) });
});
router.post("/:id/leave", async (req, res) => {
  body(req, []);
  const group = await getGroup(req.params.id);
  if (String(group.hostId) === String(req.user._id))
    fail("Hosts must cancel their group instead of leaving.", 409);
  await Group.updateOne(
    { _id: group._id },
    { $pull: { memberIds: req.user._id } },
  );
  res.json({ ok: true });
});
router.post("/:id/cancel", async (req, res) => {
  body(req, []);
  const group = await getGroup(req.params.id);
  if (
    String(group.hostId) !== String(req.user._id) &&
    req.user.role !== "admin"
  )
    fail("Only the host can cancel this group.", 403);
  const updated = await Group.findByIdAndUpdate(
    group._id,
    { $set: { status: "cancelled" } },
    { returnDocument: 'after' },
  ).lean();
  res.json({ group: projection(updated, req.user) });
});
router.get("/:id/messages", async (req, res) => {
  const group = await room(req);
  const messages = (
    await Message.find({ groupId: group._id, expiresAt: { $gt: new Date() } })
      .sort({ createdAt: -1, _id: -1 })
      .limit(100)
      .lean()
  ).reverse();
  res.json({
    messages: messages.map((message) => messageProjection(message, req.user)),
  });
});
router.post("/:id/messages", async (req, res) => {
  body(req, ["text"]);
  const group = await room(req);
  if (
    group.status !== "active" ||
    group.departureAt.getTime() + group.windowMinutes * 60000 < Date.now()
  )
    fail("This group is closed for new messages.", 409);
  if (!string(req.body.text, 1, 500) || !req.body.text.trim())
    fail("Message must be 1–500 characters.");
  const text = req.body.text.trim();
  if (/\S+@\S+\.\S+|(?:\+?\d[\s().-]*){10,}/.test(text))
    fail("Keep phone numbers and email addresses out of the room.");
  const message = await Message.create({
    groupId: group._id,
    authorId: req.user._id,
    alias: req.user.alias,
    text,
    expiresAt: group.expiresAt,
  });
  res.status(201).json({ message: messageProjection(message, req.user) });
});
module.exports = router;
