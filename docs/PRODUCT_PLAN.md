# TenX community pooling: product and delivery plan

This plan replaces the original driver, vehicle, payment and arbitrary-route marketplace with a private community departure board. The first community is TenX Raymond, and the only destinations are **TenX Raymond** and **Thane West Station**. The immediate job is simple: find neighbours heading the same way at roughly the same time, including odd hours, and meet at an agreed auto stand.

This is a plan and acceptance baseline, not a declaration that every item has shipped. The README and validation record must describe the actual delivered functionality and remaining launch gates. [API_CONTRACT.md](./API_CONTRACT.md) records the concrete implementation contract; this document explains the product decisions behind it.

## Product decisions and assumptions

- Start with auto-rickshaw pooling: at most three people, including the organiser. The organiser is another passenger, not a driver. Verify the local permitted passenger capacity before launch.
- Both directions are equally prominent. Show departures in Asia/Kolkata and label dates explicitly; store timestamps in UTC.
- Membership is invite-only. Community membership checks reduce casual access but do not guarantee a person's identity or safety.
- No payments, driver onboarding, vehicle marketplace, ratings, home addresses, live GPS, phone directory or published daily schedules.
- People agree and pay the actual auto fare directly. Do not invent fares, ride duration, emissions savings, exact coordinates or train timetable integrations.
- The community organiser must confirm the exact physical meeting point at each endpoint. Until then, use the known endpoint names and a diagram explicitly labelled as a schematic.
- Preserve the existing checkout and make small task commits. Do not create a worktree for cloud setup. Existing marketplace data must not be silently converted to community membership or pooled departures.

## Shared vocabulary

| Term | Meaning |
| --- | --- |
| Member | An account admitted to this community through an invitation. |
| Invitation | A limited, expiring opportunity to create a community account. |
| Departure | A request to meet and travel in one of the two supported directions at a chosen time. |
| Organiser | The member who starts a departure and occupies one passenger place. |
| Place | One passenger position in the group; it is not a vehicle booking. |
| Group | The members currently sharing a departure. |
| Meeting point | A community-approved public place at one endpoint, not a member's home. |
| Cancellation | The organiser closes a departure before travelling. |
| Leave | A member relinquishes their own place. |
| Expiry | A departure stops accepting joins once its time window has elapsed. |

## Core journey

1. A resident follows an invitation, chooses a display name and creates an account. Explain what other members can see before they join.
2. The member opens a board with two direction choices, a clear next-departure list and a prominent “Start a pool” action. Useful empty states explain how to start the first group.
3. A departure card shows direction, local departure time, bounded capacity, status and a safe display name. It does not expose email, phone number, apartment, attendance history or private identifiers.
4. The member joins an available departure. The server rechecks eligibility and capacity atomically, so two simultaneous joins cannot overbook the last place.
5. Joined members see the public meeting instructions and only the group information needed to coordinate. A private, polled group chat supports coordination: reads and sends both require current membership; leaving immediately removes access. The board shows the organiser's alias, but no member roster.
6. A member can leave; the organiser can cancel. Joining and leaving are idempotent, and expired or cancelled departures reject further joins. The screen clearly shows whether the action succeeded.

For the first release, avoid automatically publishing daily commutes. A saved private preference can be explored later, but a schedule visible to other members would reveal routines. Likewise, opt-in notifications must not promise delivery until a real delivery service is configured and tested.

## Visual direction

Use a restrained editorial interface: warm off-white canvas, dark readable typography, one muted green accent, fine separators, generous spacing and compact departures. Give the two directions a clear segmented control, then let times and open places dominate the board. Avoid oversized marketing heroes, decorative dashboard metrics, glass panels, gradient backgrounds and a moving map behind the content.

Design references to inspect when network access permits:

- [Dribbble travel dashboard results](https://dribbble.com/search/travel-dashboard): possible references for spacing and hierarchy only; do not copy artwork or let concept mockups override accessibility.
- [Citymapper](https://www.citymapper.com/): a reference for practical transit hierarchy and quick destination decisions.
- [GOV.UK service design guidance](https://www.gov.uk/service-manual/design): a reference for plain language, clear errors and task-focused flows.

These pages could not be retrieved from this environment: the network proxy returned HTTP 403 for the connection requests. This plan does not claim to have visually inspected specific shots. The resulting interface should be assessed directly at mobile and desktop widths.

Every interactive control needs a keyboard-visible focus state, a descriptive label and adequate contrast. Errors must remain visible beside the relevant action. Avoid layout shifts while loading. Respect reduced-motion preferences. Test a 360px-wide viewport and 200% zoom, not just a desktop screenshot.

## Map decision: Protomaps, restricted to the community locality

The user confirmed [Protomaps](https://protomaps.com/) and requested coverage only around **Thane Railway Station** and **Raymond TenX Habitat**. Use MapLibre to render a self-hosted regional PMTiles extract, with self-hosted glyphs and sprites. Keep the view optional and lazy-loaded, constrain panning/zoom to a small validated bounding rectangle, show only the two community landmark markers, and request no location permission or address search.

The schematic remains available before opening the geographic reference. It must stay explicitly labelled as a schematic. The locality map is also a reference, not route guidance or evidence of a confirmed pickup gate. A small geographic rectangle necessarily includes the intervening streets; it does not create additional departure destinations.

Official Protomaps documentation was inspected from its GitHub source. Direct map download and geocoding sites remain blocked by the cloud network allowlist. No endpoint coordinates or locality tiles have been fabricated. See [LOCALITY_MAP.md](LOCALITY_MAP.md) for the asset contract, provenance and outstanding provisioning checks.

## Technical delivery sequence

1. **Define and document the pivot.** Record this scope, the membership model, fixed endpoints, data visibility and production gates.
2. **Replace the backend marketplace.** Remove Clerk/Razorpay/Google dependencies and routes; implement community accounts, invitations, departures, safe projections, join/leave/cancel and expiry. Delete abandoned driver/payment pathways rather than leaving them reachable.
3. **Build the community interface.** Replace existing booking screens with sign-in/invitation entry, departure board, create/join/leave/cancel flows and clear account controls. Build the route diagram without remote map assets.
4. **Make deployment repeatable.** Supply Docker-based MongoDB, application images/configuration, health checks, ignored local configuration and a single MongoDB URI switch for Atlas.
5. **Validate the seams.** Test authentication, invitation use, authorization, concurrent capacity, validation, expiry and cancellation; run lint/build and an end-to-end persisted workflow. Review the browser and dependency audit findings.
6. **Document launch readiness honestly.** Publish local commands, production secret requirements, backup/restore procedure, migration boundary and remaining manual gates. Commit each coherent task separately.

Keep the implementation small: React/Vite, Express, MongoDB and native Node cryptography are sufficient. Server-owned seven-day cookie sessions and scrypt password hashing avoid a replacement hosted identity dependency. Single-use hashed invitations expire after seven days; a local CLI bootstraps the first administrator, who can issue subsequent invitations. Same-origin production routing through Nginx, strict cookies, mutation request-header checks and origin validation protect browser mutations. Browser polling is acceptable for this small board; realtime sockets add authorization and reconnection work and should earn their place.

## Privacy and abuse threat model

| Threat | Required mitigation | Residual limit |
| --- | --- | --- |
| Public visitor scrapes commute details | Authentication and active community membership on every board/detail endpoint; no public departures | An admitted member can still copy what they see |
| Invitation is forwarded or guessed | High-entropy invitation secret; store a digest; expiry and atomic use limit; never log the raw secret | Organisers must distribute invitations deliberately |
| Account or session theft | Slow password hashing, HttpOnly cookies, Secure in production, bounded expiry, session revocation, rate limits | Compromised devices still expose active sessions |
| Forged cross-site mutation | Same-origin deployment, strict origin validation/CSRF protection, restrictive CORS and cookie policy | Incorrect reverse-proxy configuration can weaken checks |
| Outsider reads group details/messages | Authorize every lookup by current member identity; return only allowlisted fields | Group members can screenshot content |
| Daily routine inference | No public recurring schedules, precise GPS or history; minimise departure retention | Live board membership necessarily reveals a planned departure |
| Flooding, harassment or impersonation | Input limits, rate limits, invitation controls, account suspension and a documented community reporting route | Invite-only does not constitute identity verification |
| Sensitive diagnostics leak | Redact tokens/cookies/URI credentials; generic client errors; no body dumps | Operators still need restricted access to operational logs |
| Overbooking or stale actions | Atomic conditional join, idempotency, bounded state transitions and server-controlled expiry | Clients must refresh after conflicts |

Private communication, if delivered, requires a retention policy and a moderator escalation process. Do not promise end-to-end encryption unless it is actually implemented and audited. Prefer coordination at public meeting points; prohibit sharing apartment numbers and sensitive personal details in product guidance.

## Data and environment

- Retain MongoDB as the durable store. Use a Docker named volume and authenticated MongoDB for local/community deployment; avoid a published database port in the production Compose configuration.
- Use `MONGO_URI`/the documented equivalent as the sole connection selector: local Docker URI or an Atlas SRV URI. Credentials belong in deployment secrets, never in Git or client bundles.
- Atlas requires a database user, appropriate network access and TLS. Docker credentials are not automatically valid Atlas credentials.
- Persist invitations, members, sessions and departures in deliberately named collections. A fresh namespace prevents accidental access to old marketplace records. Back up before any future data migration; do not silently delete historical data.
- Departure expiry must be enforced in queries and mutations. MongoDB TTL cleanup is eventual and is not an authorization or status check.
- Remove departure and chat coordination data 24 hours after departure; retain abuse reports for 30 days and sessions for seven days. Enforce access expiry before eventual TTL deletion. Backup retention is separate and must be documented. Account deletion revokes sessions, removes memberships, cancels future organised groups, removes authored chats and anonymises reports; do not retain a personal travel history.

## Production acceptance checklist

This checklist is a launch gate, not a promise of certification. Mark items only after evidence is recorded.

- [ ] Registration requires a valid invitation; expired/reused invitations fail without leaking account existence.
- [ ] Passwords are slow-hashed with unique salts; session tokens and invitation secrets are stored as digests.
- [ ] Cookies, session expiry/revocation, request origin checks, rate limits and proxy trust match the deployment topology.
- [ ] Unauthenticated and unauthorised requests fail for every protected operation, including detail and messaging paths.
- [ ] Board payloads contain no email, phone, credentials, precise coordinates or private account profile fields.
- [ ] Simultaneous last-place joins cannot exceed capacity; duplicate joins/leaves are safe; cancellation and expiry block joins.
- [ ] Date/time validation, payload limits and server-side fixed-direction validation reject malformed input.
- [ ] App and database startup have meaningful readiness checks; data survives service restart.
- [ ] Docker MongoDB workflow is exercised; Atlas URI is documented and never exposed to the browser.
- [ ] No reachable Clerk, Razorpay, Google Maps, driver-payment marketplace or fake production data pathway remains.
- [ ] Client lint/build and focused backend tests pass; dependency/security findings have documented dispositions.
- [ ] Mobile keyboard, focus, error/empty/loading states, reduced motion and contrast are reviewed in a browser.
- [ ] HTTPS, secret rotation, least-privilege database access, backup and an actual restore drill are configured by the deployment operator.
- [ ] Community administrator controls, abuse-reporting contact, account recovery/deletion and retention policy are available or explicitly remain launch blockers.
- [ ] Local meetup instructions and permitted capacity are confirmed by the community; cancellation/no-show expectations are explained.

## After the first release

Evaluate real usage before adding recurrence, notifications, queueing, train arrivals, multi-community support, richer moderation, external maps or car pooling. If car pooling is added, model vehicle capacity and responsibility separately rather than overloading the three-person auto group. Recovery, retention and moderation deserve priority ahead of decorative features. Never label an untested external service, undeployed application or unfinished operational process as production ready.
