const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const mongoose = require("mongoose");
const { createApp } = require("../app");
const { User, Session, Invite, Group, Message, Report } = require("../models");
const { passwordHash, digest } = require("../lib/security");
const uri = process.env.TEST_MONGO_URI;
let server, base, hash;
const accounts = [];
before(async () => {
  if (!uri) return;
  const database = new URL(uri).pathname.slice(1);
  if (!database.endsWith("_test"))
    throw new Error("TEST_MONGO_URI must select a database ending in _test.");
  await mongoose.connect(uri);
  await mongoose.connection.dropDatabase();
  await Promise.all(
    [User, Session, Invite, Group, Message, Report].map((model) =>
      model.init(),
    ),
  );
  hash = await passwordHash("test password with twelve chars");
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  for (let i = 0; i < 7; i++) {
    const user = await User.create({
      alias: `Member ${i}`,
      email: `member${i}@example.test`,
      passwordHash: hash,
      role: i === 0 ? "admin" : "member",
    });
    const token = crypto.randomBytes(32).toString("hex");
    await Session.create({
      tokenHash: digest(token),
      userId: user._id,
      expiresAt: new Date(Date.now() + 86400000),
    });
    accounts.push({ user, cookie: `tenx_session=${token}` });
  }
});
after(async () => {
  if (!uri) return;
  if (server) await new Promise((resolve) => server.close(resolve));
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
async function call(
  path,
  { method = "GET", account, body, headers = {} } = {},
) {
  const response = await fetch(base + "/api" + path, {
    method,
    headers: {
      ...(account ? { Cookie: account.cookie } : {}),
      ...(method !== "GET" ? { "X-Requested-With": "TenX" } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return {
    status: response.status,
    data: await response.json(),
    headers: response.headers,
  };
}
async function create(account = accounts[1]) {
  const result = await call("/groups", {
    method: "POST",
    account,
    body: {
      direction: "to-station",
      departureAt: new Date(Date.now() + 3600000).toISOString(),
      windowMinutes: 10,
      meetingPoint: "tenx-main-gate",
    },
  });
  assert.equal(result.status, 201, JSON.stringify(result.data));
  return result.data.group;
}
test(
  "real Mongo: privacy, contention, revocation, invitations and moderation",
  { skip: !uri },
  async (t) => {
    await t.test("readiness and authentication boundaries", async () => {
      assert.equal((await call("/health")).status, 200);
      assert.equal((await call("/groups")).status, 401);
      assert.deepEqual((await call("/auth/me")).data, { user: null });
      const request = await call("/groups", {
        method: "POST",
        account: accounts[1],
        body: {},
        headers: { Origin: "https://evil.example" },
      });
      assert.equal(request.status, 403);
      assert.equal(request.headers.get("cache-control"), "no-store");
      assert.equal(
        (await call("/groups?direction=constructor", { account: accounts[1] }))
          .status,
        400,
      );
    });
    await t.test("single-use invite and cookie authentication", async () => {
      const invitation = await call("/admin/invites", {
        method: "POST",
        account: accounts[0],
      });
      assert.equal(invitation.status, 200);
      const credentials = {
        alias: "New neighbour",
        email: "new@example.test",
        password: "test password with twelve chars",
        inviteCode: invitation.data.code,
      };
      const registered = await call("/auth/register", {
        method: "POST",
        body: credentials,
      });
      assert.equal(registered.status, 201);
      const cookie = registered.headers.get("set-cookie");
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Strict/i);
      assert.equal(
        (await call("/auth/me", { account: { cookie } })).data.user.alias,
        "New neighbour",
      );
      assert.equal(
        (
          await call("/auth/register", {
            method: "POST",
            body: { ...credentials, email: "second@example.test" },
          })
        ).status,
        400,
      );
      const login = await call("/auth/login", {
        method: "POST",
        body: { email: credentials.email, password: credentials.password },
      });
      assert.equal(login.status, 200);
      await call("/auth/logout", { method: "POST", account: { cookie } });
      assert.equal(
        (await call("/groups", { account: { cookie } })).status,
        401,
      );
    });
    await t.test(
      "competing joins cannot exceed three; board does not disclose members",
      async () => {
        const group = await create();
        const results = await Promise.all(
          accounts
            .slice(2, 7)
            .map((account) =>
              call(`/groups/${group.id}/join`, { method: "POST", account }),
            ),
        );
        assert.equal(
          results.filter((result) => result.status === 200).length,
          2,
        );
        const saved = await Group.findById(group.id);
        assert.equal(saved.memberIds.length, 3);
        assert.equal(new Set(saved.memberIds.map(String)).size, 3);
        const outsider = await call(`/groups/${group.id}`, {
          account: accounts[0],
        });
        assert.equal(outsider.data.group.memberCount, 3);
        assert.equal("members" in outsider.data, false);
        assert.equal("messages" in outsider.data, false);
        assert.equal("memberIds" in outsider.data.group, false);
        assert.equal("email" in outsider.data.group, false);
        const board = await call("/groups", { account: accounts[0] });
        assert.ok(board.data.groups.some((item) => item.id === group.id));
      },
    );
    await t.test(
      "leaving revokes private chat, host cancellation closes writes",
      async () => {
        const group = await create();
        const guest = accounts[2];
        await call(`/groups/${group.id}/join`, {
          method: "POST",
          account: guest,
        });
        const message = await call(`/groups/${group.id}/messages`, {
          method: "POST",
          account: guest,
          body: { text: "Meet at the marked stand." },
        });
        assert.equal(message.status, 201);
        assert.equal(
          (await call(`/groups/${group.id}/messages`, { account: accounts[3] }))
            .status,
          403,
        );
        assert.equal(
          (
            await call(`/groups/${group.id}/messages`, {
              method: "POST",
              account: guest,
              body: { text: "Call +91 9876543210" },
            })
          ).status,
          400,
        );
        assert.equal(
          (
            await call(`/groups/${group.id}/leave`, {
              method: "POST",
              account: guest,
            })
          ).status,
          200,
        );
        assert.equal(
          (await call(`/groups/${group.id}/messages`, { account: guest }))
            .status,
          403,
        );
        assert.equal(
          (
            await call(`/groups/${group.id}/leave`, {
              method: "POST",
              account: accounts[1],
            })
          ).status,
          409,
        );
        await call(`/groups/${group.id}/cancel`, {
          method: "POST",
          account: accounts[1],
        });
        assert.equal(
          (
            await call(`/groups/${group.id}/messages`, {
              method: "POST",
              account: accounts[1],
              body: { text: "Closed" },
            })
          ).status,
          409,
        );
        assert.equal(
          (
            await call(`/groups/${group.id}/join`, {
              method: "POST",
              account: guest,
            })
          ).status,
          409,
        );
      },
    );
    await t.test(
      "moderation access and suspension revoke sessions and memberships",
      async () => {
        const group = await create(accounts[4]);
        assert.equal(
          (await call("/admin/reports", { account: accounts[2] })).status,
          403,
        );
        assert.equal(
          (
            await call("/reports", {
              method: "POST",
              account: accounts[2],
              body: { groupId: group.id, reason: "unsafe" },
            })
          ).status,
          200,
        );
        const report = (await call("/admin/reports", { account: accounts[0] }))
          .data.reports[0];
        assert.equal(report.reporterAlias, "Member 2");
        assert.equal(
          (
            await call(`/admin/reports/${report.id}/resolve`, {
              method: "POST",
              account: accounts[0],
            })
          ).status,
          200,
        );
        assert.equal(
          (
            await call(`/admin/members/${accounts[4].user._id}/suspend`, {
              method: "POST",
              account: accounts[0],
            })
          ).status,
          200,
        );
        assert.equal(
          (await call("/groups", { account: accounts[4] })).status,
          401,
        );
        assert.equal((await Group.findById(group.id)).status, "cancelled");
      },
    );
    await t.test(
      "deletion removes chats and membership and anonymizes reports",
      async () => {
        const account = accounts[5];
        const group = await create(account);
        await call(`/groups/${group.id}/messages`, {
          method: "POST",
          account,
          body: { text: "I will wait near the gate." },
        });
        await call("/reports", {
          method: "POST",
          account,
          body: { groupId: group.id, reason: "other" },
        });
        assert.equal(
          (
            await call("/auth/account", {
              method: "DELETE",
              account,
              body: { password: "wrong" },
            })
          ).status,
          403,
        );
        assert.equal(
          (
            await call("/auth/account", {
              method: "DELETE",
              account,
              body: { password: "test password with twelve chars" },
            })
          ).status,
          200,
        );
        assert.equal(await User.exists({ _id: account.user._id }), null);
        assert.equal(
          await Session.countDocuments({ userId: account.user._id }),
          0,
        );
        assert.equal(
          await Message.countDocuments({ authorId: account.user._id }),
          0,
        );
        assert.equal(
          await Group.countDocuments({ memberIds: account.user._id }),
          0,
        );
        const report = await Report.findOne({ groupId: group.id });
        assert.equal(report.reporterAlias, "Deleted member");
        assert.equal(report.reporterId, undefined);
        assert.equal(
          (await Group.findById(group.id)).hostAlias,
          "Deleted member",
        );
      },
    );
    await t.test(
      "expiry enforced immediately independent of delayed Mongo TTL cleanup",
      async () => {
        const group = await create(accounts[6]);
        await Group.updateOne(
          { _id: group.id },
          { $set: { expiresAt: new Date(Date.now() - 1) } },
        );
        assert.equal(
          (await call(`/groups/${group.id}`, { account: accounts[6] })).status,
          404,
        );
        await Session.updateMany(
          { userId: accounts[6].user._id },
          { $set: { expiresAt: new Date(Date.now() - 1) } },
        );
        assert.equal(
          (await call("/groups", { account: accounts[6] })).status,
          401,
        );
        for (const Model of [Session, Invite, Group, Message, Report]) {
          const indexes = await Model.collection.indexes();
          assert.ok(
            indexes.some(
              (index) =>
                index.key.expiresAt === 1 && index.expireAfterSeconds === 0,
            ),
          );
        }
      },
    );
  },
);
