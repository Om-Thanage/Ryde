import { useState } from "react";
import { api } from "../api";
export default function Auth({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const { user } = await api(`/auth/${mode}`, { method: "POST", body });
      onLogin(user);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="auth-panel" id="community">
      <div className="eyebrow">YOUR COMMUNITY, YOUR PEOPLE</div>
      <h2>
        {mode === "login" ? "Good to see you." : "A little introduction."}
      </h2>
      <p className="muted">
        {mode === "login"
          ? "Sign in to see departures and find a ride together."
          : "Ask a community administrator for a single-use invite."}
      </p>
      <div className="segmented" aria-label="Account options">
        <button
          className={mode === "login" ? "selected" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Sign in
        </button>
        <button
          className={mode === "register" ? "selected" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Join community
        </button>
      </div>
      <form onSubmit={submit}>
        {mode === "register" && (
          <>
            <label>
              Your public alias
              <input
                name="alias"
                required
                minLength={2}
                maxLength={32}
                autoComplete="nickname"
                placeholder="How neighbours will know you"
              />
            </label>
            <label>
              Invite code
              <input
                name="inviteCode"
                required
                autoComplete="off"
                maxLength={128}
              />
            </label>
          </>
        )}
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 12 : 1}
            maxLength={128}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />
        </label>
        {mode === "register" && (
          <p className="fine">
            Use at least 12 characters. Your email stays private; your alias
            appears in your groups.
          </p>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary wide" disabled={busy}>
          {busy
            ? "One moment…"
            : mode === "login"
              ? "Sign in →"
              : "Join TenX Together →"}
        </button>
      </form>
      <p className="fine">
        Invite-only. No phone numbers on a public board. No location tracking.
      </p>
    </section>
  );
}
