import { useEffect, useState, useCallback } from "react";
import { api } from "../api";
import {
  directions,
  points,
  meetingOptions,
  indiaDate,
  timeLabel,
  dateLabel,
} from "../data";

export function PostGroup({ onCreated, onClose }) {
  const [direction, setDirection] = useState("to-station");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const body = {
        direction,
        departureAt: new Date(
          `${form.date}T${form.time}:00+05:30`,
        ).toISOString(),
        windowMinutes: Number(form.windowMinutes),
        meetingPoint: form.meetingPoint,
      };
      await api("/groups", { method: "POST", body });
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel composer">
      <div className="section-top">
        <div>
          <div className="eyebrow">MAKE THE FIRST MOVE</div>
          <h2>When are you heading out?</h2>
        </div>
        <button className="text-button" onClick={onClose}>
          Close
        </button>
      </div>
      <form onSubmit={submit}>
        <label>
          Heading to
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value)}
          >
            {Object.entries(directions).map(([key, text]) => (
              <option key={key} value={key}>
                {text}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Date
            <input
              name="date"
              type="date"
              required
              min={indiaDate()}
              defaultValue={indiaDate()}
            />
          </label>
          <label>
            Departure time · IST
            <input name="time" type="time" required />
          </label>
        </div>
        <div className="form-row">
          <label>
            Meeting point
            <select key={direction} name="meetingPoint">
              {meetingOptions[direction].map((key) => (
                <option key={key} value={key}>
                  {points[key]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Can wait for
            <select name="windowMinutes" defaultValue="10">
              <option value="5">5 minutes</option>
              <option value="10">10 minutes</option>
              <option value="15">15 minutes</option>
            </select>
          </label>
        </div>
        <p className="fine">
          Plan 5 minutes to 7 days ahead. A group fits up to 3 people, including
          you. Agree on the auto and split the fare yourselves.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Posting…" : "Post departure →"}
        </button>
      </form>
    </section>
  );
}

export default function Board({ mine, refresh, onOpen, onPost }) {
  const [direction, setDirection] = useState("to-station");
  const [date, setDate] = useState(indiaDate());
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadedFilter, setLoadedFilter] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const fetchGroups = useCallback(
    async (signal) => {
      setError("");
      try {
        const result = await api(
          mine ? "/groups/mine" : `/groups?direction=${direction}&date=${date}`,
          { signal },
        );
        setGroups(result.groups);
        setLoadedFilter(`${mine}:${direction}:${date}`);
      } catch (err) {
        if (err.name !== "AbortError") setError(err.message);
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [mine, direction, date],
  );
  useEffect(() => {
    const controller = new AbortController();
    fetchGroups(controller.signal);
    const interval = setInterval(() => {
      if (!document.hidden) fetchGroups(controller.signal);
    }, 20000);
    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [fetchGroups, refresh]);
  async function join(group) {
    setBusy(group.id);
    setError("");
    try {
      await api(`/groups/${group.id}/join`, { method: "POST" });
      onOpen(group.id);
    } catch (err) {
      await fetchGroups();
      setError(err.message);
    } finally {
      setBusy("");
    }
  }
  return (
    <section>
      <div className="section-top board-title">
        <div>
          <div className="eyebrow">
            {mine ? "YOUR PLANS" : "THE DEPARTURE BOARD"}
          </div>
          <h2>
            {mine ? "Your next rides together." : "Find your next three."}
          </h2>
          <p className="muted">
            {mine
              ? "Your hosted and joined groups, all in one place."
              : "A short ride is better with familiar faces."}
          </p>
        </div>
        <button className="button primary" onClick={onPost}>
          + Post a departure
        </button>
      </div>
      {!mine && (
        <div className="filters">
          <div className="segmented">
            <button
              className={direction === "to-station" ? "selected" : ""}
              onClick={() => setDirection("to-station")}
            >
              To Station →
            </button>
            <button
              className={direction === "to-tenx" ? "selected" : ""}
              onClick={() => setDirection("to-tenx")}
            >
              To TenX ←
            </button>
          </div>
          <label className="date-filter">
            Departure date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || indiaDate())}
              min={indiaDate()}
            />
          </label>
          <span className="fine">All times in IST</span>
        </div>
      )}
      {error && (
        <div className="error" role="alert">
          {error}{" "}
          <button className="text-button" onClick={() => fetchGroups()}>
            Try again
          </button>
        </div>
      )}
      {loading ||
      (loadedFilter !== `${mine}:${direction}:${date}` && !error) ? (
        <div className="empty" role="status">
          Checking the departure board…
        </div>
      ) : loadedFilter !== `${mine}:${direction}:${date}` ? (
        <div className="empty">
          <h3>The board couldn’t load.</h3>
          <p>Try again when your connection is ready.</p>
          <button className="button secondary" onClick={() => fetchGroups()}>
            Try again
          </button>
        </div>
      ) : !groups.length ? (
        <div className="empty">
          <span className="empty-symbol" aria-hidden="true">
            →
          </span>
          <h3>
            {mine
              ? "A little room for a new plan."
              : "Be the first one heading out."}
          </h3>
          <p>
            {mine
              ? "Join a departure or start one. Your group will appear here."
              : "No departures posted for this direction and date yet. Leave a time for your neighbours to join."}
          </p>
          <button className="button secondary" onClick={onPost}>
            Start a group
          </button>
        </div>
      ) : (
        <div className="group-list">
          {groups.map((group) => (
            <article className="departure" key={group.id}>
              <div className="departure-time">
                <strong>{timeLabel(group.departureAt)}</strong>
                <span>{dateLabel(group.departureAt)} · IST</span>
              </div>
              <div className="departure-main">
                <div className="eyebrow">TO {directions[group.direction]}</div>
                <h3>{points[group.meetingPoint]}</h3>
                <p>
                  With {group.hostAlias} · {group.windowMinutes}-minute wait
                  window
                </p>
              </div>
              <div className="departure-seats">
                <div className="seat-dots" aria-hidden="true">
                  {[0, 1, 2].map((index) => (
                    <span
                      className={index < group.memberCount ? "filled" : ""}
                      key={index}
                    />
                  ))}
                </div>
                <span>
                  {group.capacity - group.memberCount}{" "}
                  {group.capacity - group.memberCount === 1 ? "spot" : "spots"}{" "}
                  open
                </span>
              </div>
              {group.isMember ? (
                <button
                  className="button secondary"
                  onClick={() => onOpen(group.id)}
                >
                  Open group →
                </button>
              ) : (
                <button
                  className="button secondary"
                  disabled={
                    busy === group.id ||
                    group.memberCount >= group.capacity ||
                    group.status !== "active"
                  }
                  onClick={() => join(group)}
                >
                  {busy === group.id
                    ? "Joining…"
                    : group.memberCount >= group.capacity
                      ? "Group full"
                      : "Join group →"}
                </button>
              )}
            </article>
          ))}
        </div>
      )}
      <p className="board-note">
        Only community members can see this board. Details and messages stay
        inside each group.
      </p>
    </section>
  );
}
