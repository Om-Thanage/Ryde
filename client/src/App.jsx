import { lazy, Suspense, useEffect, useState } from "react";
import { api } from "./api";
import Auth from "./components/Auth";
import Board, { PostGroup } from "./components/Board";
import Room from "./components/Room";
import Settings from "./components/Settings";

const LocalityMap = lazy(() => import("./components/LocalityMap"));

function RouteIllustration({ compact = false }) {
  const [mapOpen, setMapOpen] = useState(false);
  if (mapOpen)
    return (
      <Suspense
        fallback={
          <div className="panel" role="status">
            Opening the locality map…
          </div>
        }
      >
        <LocalityMap onClose={() => setMapOpen(false)} />
      </Suspense>
    );
  return (
    <div className="route-reference">
      <div
        className={`route-art ${compact ? "compact" : ""}`}
        aria-label="Route schematic between Raymond TenX Habitat and Thane Railway Station. Not a navigation map."
      >
        <div className="route-art-top">
          <span className="eyebrow">ONE COMMUNITY. TWO STOPS.</span>
          <span className="route-arrow" aria-hidden="true">
            →
          </span>
        </div>
        <div className="route-stop stop-home">
          <span className="stop-dot" />
          <div>
            <span className="stop-number">01 / HOME</span>
            <h3>
              Raymond
              <br />
              TenX Habitat
            </h3>
            <p>
              Your neighbourhood.
              <br />
              Your starting point.
            </p>
          </div>
        </div>
        <div className="route-line" aria-hidden="true" />
        <div className="route-stop stop-station">
          <span className="stop-dot" />
          <div>
            <span className="stop-number">02 / THE CITY AWAITS</span>
            <h3>
              Thane
              <br />
              Railway Station
            </h3>
            <p>
              The next train.
              <br />A shared last mile.
            </p>
          </div>
        </div>
        <div className="route-caption">
          Route schematic · not for navigation<span aria-hidden="true">↔</span>
        </div>
      </div>
      <button
        className="text-button locality-map-toggle"
        onClick={() => setMapOpen(true)}
      >
        View locality map <span aria-hidden="true">→</span>
      </button>
      <p className="fine locality-map-toggle-note">
        Self-hosted Protomaps · no location access
      </p>
    </div>
  );
}
function Landing({ onLogin }) {
  return (
    <>
      <div className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="little-dot" /> FOR THE TENX COMMUNITY
          </div>
          <h1>
            The last mile.
            <br />
            <em>A little more</em>
            <br />
            together.
          </h1>
          <p>
            Heading to the station? Coming home?
            <br />
            Find a neighbour going your way, at your time.
            <br />
            Share an auto. Keep your privacy.
          </p>
          <a href="#community" className="button primary">
            Find your people <span>→</span>
          </a>
          <div className="hero-footnote">
            <span aria-hidden="true">↔</span> Raymond TenX Habitat & Thane
            Railway Station
          </div>
        </div>
        <RouteIllustration />
      </div>
      <section className="principles">
        <div>
          <span className="eyebrow">01 / A TIME, NOT A CHAT FLOOD</span>
          <h3>Post when you’re leaving.</h3>
          <p>
            Choose a direction and a departure time. Neighbours join when it
            works for them.
          </p>
        </div>
        <div>
          <span className="eyebrow">02 / THREE IS GOOD COMPANY</span>
          <h3>A small group. A shared auto.</h3>
          <p>
            Meet at a familiar public stop, agree on the ride, and head out
            together.
          </p>
        </div>
        <div>
          <span className="eyebrow">03 / YOUR DETAILS STAY YOURS</span>
          <h3>Less sharing. More belonging.</h3>
          <p>
            No public phone number or live tracking. Coordinate inside your
            private group.
          </p>
        </div>
      </section>
      <div className="join-layout">
        <div className="join-copy">
          <div className="eyebrow">A NEW WAY TO SAY “ANYONE GOING?”</div>
          <h2>
            Same neighbourhood.
            <br />
            Better timing.
          </h2>
          <p>
            For the early train, the late return, and every odd hour in between.
            A place for TenX neighbours to find each other without sending a
            message to everyone.
          </p>
          <div className="privacy-card">
            <span aria-hidden="true">⌑</span>
            <div>
              <h3>Designed for a little less exposure.</h3>
              <p>
                Email addresses stay private. Group conversations expire 24
                hours after departure. You choose when to join.
              </p>
            </div>
          </div>
        </div>
        <Auth onLogin={onLogin} />
      </div>
    </>
  );
}
export default function App() {
  const [user, setUser] = useState(null);
  const [initializing, setInitializing] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("board");
  const [roomId, setRoomId] = useState(null);
  const [posting, setPosting] = useState(false);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api("/auth/me", { signal: controller.signal })
      .then((result) => setUser(result.user))
      .catch((err) => {
        if (err.name !== "AbortError")
          setError(`Community service is unavailable: ${err.message}`);
      })
      .finally(() => {
        if (!controller.signal.aborted) setInitializing(false);
      });
    return () => controller.abort();
  }, []);
  function login(member) {
    setUser(member);
    setError("");
    setTab("board");
    setRoomId(null);
  }
  function changeTab(value) {
    setTab(value);
    setRoomId(null);
    setPosting(false);
  }
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
      setRoomId(null);
      setPosting(false);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="header">
        <div className="header-inner">
          <a
            className="brand"
            href="#"
            onClick={(event) => {
              event.preventDefault();
              changeTab("board");
            }}
            aria-label="TenX Together home"
          >
            <span className="brand-mark" aria-hidden="true">
              t<span>→</span>
            </span>
            <span>
              tenx<span className="brand-second">together</span>
            </span>
          </a>
          {user ? (
            <>
              <nav aria-label="Main navigation">
                {[
                  ["board", "Departures"],
                  ["mine", "My groups"],
                  ["settings", user.role === "admin" ? "Community" : "Account"],
                ].map(([value, label]) => (
                  <button
                    className={tab === value ? "active" : ""}
                    key={value}
                    onClick={() => changeTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </nav>
              <div className="account-nav">
                <span className="user-label">Hello, {user.alias}</span>
                <button className="text-button" onClick={logout}>
                  Sign out
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="header-route">
                THANE RAILWAY STATION ⇄ RAYMOND TENX HABITAT
              </span>
              <a className="button secondary small" href="#community">
                Join your neighbours →
              </a>
            </>
          )}
        </div>
      </header>
      <main id="main" className="main">
        {error && (
          <p className="error global-error" role="alert">
            {error}
          </p>
        )}
        {initializing ? (
          <div className="initial-loading" role="status">
            Making room for your community…
          </div>
        ) : !user ? (
          <Landing onLogin={login} />
        ) : (
          <div className="workspace">
            <div className="workspace-intro">
              <span className="eyebrow">TENX TOGETHER / COMMUNITY RIDES</span>
              <span className="fine">
                Invite-only · No live location tracking
              </span>
            </div>
            {roomId ? (
              <Room
                key={roomId}
                id={roomId}
                isAdmin={user.role === "admin"}
                onBack={() => {
                  setRoomId(null);
                  setRefresh((value) => value + 1);
                }}
                onChanged={() => setRefresh((value) => value + 1)}
              />
            ) : tab === "settings" ? (
              <Settings
                user={user}
                onOpen={setRoomId}
                onDeleted={() => setUser(null)}
              />
            ) : (
              <>
                {posting && (
                  <PostGroup
                    onClose={() => setPosting(false)}
                    onCreated={() => {
                      setPosting(false);
                      setRefresh((value) => value + 1);
                    }}
                  />
                )}
                <Board
                  key={tab}
                  mine={tab === "mine"}
                  refresh={refresh}
                  onOpen={setRoomId}
                  onPost={() => {
                    setPosting(true);
                    window.scrollTo({ top: 0, behavior: "instant" });
                  }}
                />
                <div className="board-bottom">
                  <RouteIllustration compact />
                  <div>
                    <span className="eyebrow">
                      THE SHORT RIDE THAT CONNECTS US
                    </span>
                    <h3>
                      Two familiar stops.
                      <br />A few familiar faces.
                    </h3>
                    <p className="muted">
                      Meet in public, agree on your auto and fare, and look out
                      for one another. TenX Together coordinates neighbours; it
                      doesn’t book transport.
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </main>
      <footer className="footer">
        <span>
          tenx together<span className="footer-dot">●</span>
        </span>
        <p>Made for the journey between home and the train.</p>
        <small>Community coordination, thoughtfully shared.</small>
      </footer>
    </>
  );
}
