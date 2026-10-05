const express = require("express");
const mongoose = require("mongoose");
const { User } = require("../models");
// ponytail: one API process. Scale-out requires distributed locks or transactions.
// Await the actual handler, including DB cleanup, even if the client disconnects.
const locks = new Map();
async function withUserLock(id, task) {
  const raw = String(id);
  const suffix = raw.startsWith("group:") ? raw.slice(6) : raw;
  const key = mongoose.isValidObjectId(suffix)
    ? (raw.startsWith("group:") ? "group:" : "") +
      new mongoose.Types.ObjectId(suffix).toString()
    : raw;
  const previous = locks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((resolve) => {
    release = resolve;
  });
  locks.set(key, current);
  await previous;
  try {
    return await task();
  } finally {
    release();
    if (locks.get(key) === current) locks.delete(key);
  }
}
function mutationRouter({ groups = false } = {}) {
  const router = express.Router();
  for (const method of ["post", "delete"]) {
    const register = router[method].bind(router);
    router[method] = (...args) => {
      const handler = args.pop();
      args.push(async (req, res, next) => {
        const run = async () => {
          if (req.user) {
            req.user = await User.findOne({
              _id: req.user._id,
              suspended: false,
            })
              .select("_id alias role passwordHash")
              .lean();
            if (!req.user)
              return res.status(401).json({ error: "Sign in to continue." });
          }
          const invoke = () => handler(req, res, next);
          return groups && req.params.id
            ? withUserLock(`group:${req.params.id}`, invoke)
            : invoke();
        };
        return req.user ? withUserLock(req.user._id, run) : run();
      });
      return register(...args);
    };
  }
  return router;
}
module.exports = { withUserLock, mutationRouter };
