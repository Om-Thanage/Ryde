import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { directions, points, timeLabel, dateLabel } from "../data";
export default function Room({ id, onBack, onChanged, isAdmin }) {
  const [room, setRoom] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [text, setText] = useState("");
  const [notice, setNotice] = useState("");
  const [confirm, setConfirm] = useState(false);
  const load = useCallback(
    async (signal) => {
      try {
        setRoom(await api(`/groups/${id}`, { signal }));
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      }
    },
    [id],
  );
  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    const interval = setInterval(() => {
      if (!document.hidden) load(controller.signal);
    }, 5000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [load]);
  async function mutate(path, body, exit = false) {
    setBusy(true);
    setError("");
    try {
      await api(path, { method: "POST", body });
      if (exit) {
        onChanged();
        onBack();
      } else await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  async function send(event) {
    event.preventDefault();
    if (await mutate(`/groups/${id}/messages`, { text })) setText("");
  }
  async function report(event) {
    event.preventDefault();
    if (
      await mutate("/reports", {
        groupId: id,
        reason: new FormData(event.currentTarget).get("reason"),
      })
    )
      setNotice("Report sent privately to community moderators.");
  }
  if (!room)
    return (
      <section className="panel">
        <button className="text-button" onClick={onBack}>
          ← Back to departures
        </button>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : (
          <p role="status">Opening your group…</p>
        )}
      </section>
    );
  const { group, members = [], messages = [] } = room;
  const active =
    group.status === "active" &&
    new Date(group.departureAt).getTime() + group.windowMinutes * 60000 >
      Date.now();
  return (
    <section>
      <button className="text-button back" onClick={onBack}>
        ← Back to departures
      </button>
      <div className="room-layout">
        <div>
          <section className="panel">
            <div className="eyebrow">YOUR SMALL CIRCLE</div>
            <h2>To {directions[group.direction]}.</h2>
            <div className="room-time">
              {timeLabel(group.departureAt)}{" "}
              <small>{dateLabel(group.departureAt)} · IST</small>
            </div>
            <p>
              Meet at <strong>{points[group.meetingPoint]}</strong>.
            </p>
            <p className="muted">
              Allow a {group.windowMinutes}-minute wait window. Agree on the
              auto and fare together; this app does not book a ride.
            </p>
            <span className="tag">
              {active
                ? `${group.memberCount} of 3 people`
                : group.status === "cancelled"
                  ? "Cancelled"
                  : "Departure has passed"}
            </span>
            {group.isMember && (
              <>
                <h3 className="subheading">Who’s coming</h3>
                <ul className="member-list">
                  {members.map((member) => (
                    <li key={member.id}>
                      <span className="avatar" aria-hidden="true">
                        {member.alias.slice(0, 1).toUpperCase()}
                      </span>
                      {member.alias}
                      {isAdmin && (
                        <button
                          className="text-button danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              window.confirm(
                                `Suspend ${member.alias}? Their sessions and upcoming memberships will be removed.`,
                              )
                            )
                              mutate(`/admin/members/${member.id}/suspend`);
                          }}
                        >
                          Suspend
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              </>
            )}
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            {(group.isMember || isAdmin) && active && (
              <div className="room-actions">
                {confirm ? (
                  <>
                    <p>
                      {" "}
                      {group.isHost || isAdmin
                        ? "Cancel this departure for everyone?"
                        : "Leave this group and its private conversation?"}
                    </p>
                    <button
                      className="button danger-button"
                      disabled={busy}
                      onClick={() =>
                        mutate(
                          `/groups/${id}/${group.isHost || isAdmin ? "cancel" : "leave"}`,
                          undefined,
                          true,
                        )
                      }
                    >
                      Yes,{" "}
                      {group.isHost || isAdmin
                        ? "cancel departure"
                        : "leave group"}
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setConfirm(false)}
                    >
                      Keep my place
                    </button>
                  </>
                ) : (
                  <button
                    className="text-button danger"
                    onClick={() => setConfirm(true)}
                  >
                    {group.isHost || isAdmin
                      ? "Cancel departure"
                      : "Leave group"}
                  </button>
                )}
              </div>
            )}
          </section>
          <section className="panel safety-panel">
            <div className="eyebrow">LOOK OUT FOR EACH OTHER</div>
            <h3>A familiar ride. A public meeting.</h3>
            <p className="fine">
              Meet only at the listed public stops. Never share your flat number
              or sensitive details. This is community coordination, not an
              emergency service.
            </p>
            <form className="report-form" onSubmit={report}>
              <label>
                Report a concern
                <select name="reason">
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment</option>
                  <option value="unsafe">Unsafe behaviour</option>
                  <option value="other">Other concern</option>
                </select>
              </label>
              <button className="button secondary" disabled={busy}>
                Send report
              </button>
            </form>
            {notice && (
              <p role="status" className="success">
                {notice}
              </p>
            )}
          </section>
        </div>
        <section className="panel conversation">
          <div className="section-top">
            <div>
              <div className="eyebrow">MEMBERS ONLY</div>
              <h2>Meet here first.</h2>
            </div>
            <span className="tag">Private group</span>
          </div>
          <p className="fine">
            Messages and group coordination are removed 24 hours after
            departure. Conversations update every 5 seconds.
          </p>
          {!group.isMember ? (
            <p>You no longer have access to this conversation.</p>
          ) : (
            <>
              <div className="messages" aria-label="Group messages">
                {!messages.length && (
                  <div className="chat-empty">
                    <span aria-hidden="true">↔</span>
                    <p>Say hello. Work out the little details.</p>
                    <small>
                      Only the people in this group can read your messages.
                    </small>
                  </div>
                )}
                {messages.map((message) => (
                  <article
                    className={`message ${message.isOwn ? "own" : ""}`}
                    key={message.id}
                  >
                    <div>
                      <strong>{message.alias}</strong>
                      <time dateTime={message.createdAt}>
                        {timeLabel(message.createdAt)}
                      </time>
                    </div>
                    <p>{message.text}</p>
                  </article>
                ))}
              </div>
              {active ? (
                <form onSubmit={send} className="message-form">
                  <label className="sr-only" htmlFor="message">
                    Message your group
                  </label>
                  <textarea
                    id="message"
                    value={text}
                    onChange={(event) => setText(event.target.value)}
                    required
                    maxLength={500}
                    rows={2}
                    placeholder="A quick hello, or where you’re waiting…"
                  />
                  <div>
                    <span className="fine">
                      {text.length}/500 · Keep contact details private.
                    </span>
                    <button
                      className="button primary"
                      disabled={busy || !text.trim()}
                    >
                      Send →
                    </button>
                  </div>
                </form>
              ) : (
                <p className="fine">
                  This departure is closed. Messages remain visible until the
                  retention window ends.
                </p>
              )}
            </>
          )}
        </section>
      </div>
    </section>
  );
}
