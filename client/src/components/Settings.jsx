import { useEffect, useState } from "react";
import { api } from "../api";
import { dateLabel } from "../data";
export default function Settings({ user, onDeleted, onOpen }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [reports, setReports] = useState([]);
  const [members, setMembers] = useState([]);
  const [memberPage, setMemberPage] = useState(1);
  const [hasMoreMembers, setHasMoreMembers] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(user.role === "admin");
  useEffect(() => {
    if (user.role !== "admin") return;
    const controller = new AbortController();
    Promise.all([
      api("/admin/reports", { signal: controller.signal }),
      api("/admin/members?page=1", { signal: controller.signal }),
    ])
      .then(([reportData, memberData]) => {
        setReports(reportData.reports);
        setMembers(memberData.members);
        setMemberPage(memberData.page);
        setHasMoreMembers(memberData.hasMore);
      })
      .catch((err) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [user.role]);
  async function remove(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/auth/account", {
        method: "DELETE",
        body: { password: new FormData(event.currentTarget).get("password") },
      });
      onDeleted();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function createInvite() {
    setBusy(true);
    setError("");
    try {
      setInvite(await api("/admin/invites", { method: "POST" }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function resolve(id) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/reports/${id}/resolve`, { method: "POST" });
      setReports((await api("/admin/reports")).reports);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  async function changeMemberPage(nextPage) {
    setMemberLoading(true);
    setError("");
    try {
      const data = await api(`/admin/members?page=${nextPage}`);
      setMembers(data.members);
      setMemberPage(data.page);
      setHasMoreMembers(data.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setMemberLoading(false);
    }
  }
  async function suspend(member) {
    if (
      !window.confirm(
        `Suspend ${member.alias}? This signs them out, removes memberships, and cancels their upcoming hosted groups.`,
      )
    )
      return;
    setBusy(true);
    setError("");
    try {
      await api(`/admin/members/${member.id}/suspend`, { method: "POST" });
      const memberData = await api(`/admin/members?page=${memberPage}`);
      setMembers(memberData.members);
      setHasMoreMembers(memberData.hasMore);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section>
      <div className="eyebrow">MAKE YOURSELF AT HOME</div>
      <h2>Your community account.</h2>
      <div className="settings-grid">
        <section className="panel">
          <h3>Hello, {user.alias}.</h3>
          <p>
            Your alias is visible to other members. Your email is private. We do
            not collect live location or show your participation history on the
            board.
          </p>
          <h3 className="subheading">Short-lived plans</h3>
          <p className="muted">
            Groups and chats expire 24 hours after departure. Reports are
            retained for 30 days. Backup retention is handled separately by the
            community operator.
          </p>
          <h3 className="subheading">Delete your account</h3>
          <p className="fine">
            This removes your memberships and authored messages, cancels your
            upcoming hosted groups, and signs you out. Reports are anonymised.
          </p>
          {confirm ? (
            <form onSubmit={remove}>
              <label>
                Confirm your password
                <input
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                />
              </label>
              <div className="inline-actions">
                <button className="button danger-button" disabled={busy}>
                  Delete permanently
                </button>
                <button
                  type="button"
                  className="text-button"
                  onClick={() => setConfirm(false)}
                >
                  Keep account
                </button>
              </div>
            </form>
          ) : (
            <button
              className="text-button danger"
              onClick={() => setConfirm(true)}
            >
              Delete my account
            </button>
          )}
        </section>
        {user.role === "admin" && (
          <section className="panel">
            <div className="eyebrow">COMMUNITY STEWARDS</div>
            <h3>Invitations & moderation</h3>
            <p className="fine">
              Issue individual invites only to verified community members. Each
              code works once and expires after seven days.
            </p>
            <button
              className="button secondary"
              disabled={busy}
              onClick={createInvite}
            >
              Create single-use invite
            </button>
            {invite && (
              <div className="invite">
                <label>
                  Share securely with your neighbour
                  <input
                    readOnly
                    value={invite.code}
                    onFocus={(event) => event.target.select()}
                  />
                </label>
                <p className="fine">
                  Expires {dateLabel(invite.expiresAt)}. This code is shown only
                  here; store it securely before leaving.
                </p>
              </div>
            )}
            <h3 className="subheading">Community members</h3>
            <p className="fine">
              Moderate by public alias. Administrators cannot be suspended here.
            </p>
            {loading ? (
              <p role="status">Loading members…</p>
            ) : (
              <ul className="moderator-members">
                {members.map((member) => (
                  <li key={member.id}>
                    <div>
                      <strong>{member.alias}</strong>
                      <span className="fine">
                        {member.suspended
                          ? "Suspended"
                          : member.role === "admin"
                            ? "Administrator"
                            : "Member"}
                      </span>
                    </div>
                    <button
                      className="text-button danger"
                      disabled={
                        busy ||
                        memberLoading ||
                        member.suspended ||
                        member.role === "admin" ||
                        member.id === user.id
                      }
                      onClick={() => suspend(member)}
                    >
                      {member.suspended ? "Suspended" : "Suspend"}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div
              className="member-pagination"
              aria-label="Community member pages"
            >
              <button
                className="text-button"
                disabled={loading || memberLoading || busy || memberPage === 1}
                onClick={() => changeMemberPage(memberPage - 1)}
              >
                ← Previous members
              </button>
              <span className="fine" role="status">
                {memberLoading ? "Loading page…" : `Page ${memberPage}`}
              </span>
              <button
                className="text-button"
                disabled={loading || memberLoading || busy || !hasMoreMembers}
                onClick={() => changeMemberPage(memberPage + 1)}
              >
                Next members →
              </button>
            </div>
            <h3 className="subheading">Reports</h3>
            {loading ? (
              <p role="status">Loading reports…</p>
            ) : !reports.length ? (
              <p className="fine">No reports to review.</p>
            ) : (
              <ul className="report-list">
                {reports.map((report) => (
                  <li key={report.id}>
                    <strong>{report.reason}</strong>
                    <p className="fine">
                      From {report.reporterAlias || "Deleted account"} ·{" "}
                      {dateLabel(report.createdAt)} · {report.status}
                    </p>
                    <p className="fine">Group: {report.groupId}</p>
                    <button
                      className="text-button"
                      onClick={() => onOpen(report.groupId)}
                    >
                      Review departure
                    </button>
                    {report.status !== "resolved" && (
                      <button
                        className="text-button"
                        disabled={busy}
                        onClick={() => resolve(report.id)}
                      >
                        Mark resolved
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
