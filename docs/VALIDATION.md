# Validation record — 6 October 2026

The TenX Together community workflow is implemented and validated in the cloud workspace. This record distinguishes local/container evidence from a public production deployment. No public domain or Atlas cluster has been configured or certified.

## Checks completed

| Check | Result and evidence |
| --- | --- |
| Clean dependency installation | Root `npm ci` and `npm run setup` completed; backend/client frozen-lockfile installs repeated successfully, existing `.env` preserved. |
| Client lint | Passed, zero errors and warnings on final source. |
| Client production build | Passed using Vite 7.3.6; 45 modules; main JavaScript 253.42 kB / 78.39 kB gzip. The optional map is lazy-loaded (~301.55 kB gzip plus a separate 508.83 kB worker); Vite reports a large map chunk warning. |
| Real MongoDB integration suite | `npm run test:backend`: Node runner reports 10 passed, zero failures/skips (one parent test plus nine behaviour scenarios). |
| Desktop/mobile browser suite | `npm run test:e2e`: Eight community cases passed using system Chromium and isolated real MongoDB. Four additional desktop/mobile map cases passed on targeted rerun after correcting development-mode request-count assumptions. |
| Accessibility and privacy requests | Axe WCAG 2 A/AA and 2.1 AA checks found zero violations in tested landing, board, private room and admin screens. Keyboard skip-link focus and horizontal overflow checks passed. Landing made no third-party requests. |
| Locality map contract | Four Node tests pass: bounded manifests, exact two stops, valid dates, same-origin resources and PMTiles ZXY URLs. Browser tests cover opt-in loading, missing data/retry, malformed manifest rejection, zero worker creation for rejected data, accessibility and no third-party requests. Actual community tile rendering/geographic correctness remains blocked by unavailable source downloads. |
| Production map serving/worker | Rebuilt web image tested in an isolated Nginx container. Missing map files returned 404; a temporary synthetic archive returned exact, uncompressed HTTP 206 bytes with Content-Range. Chromium started a real same-origin MapLibre worker under production CSP with zero violations/page errors/external requests; invalid archive showed the fallback. Synthetic files/container removed. This verifies serving/bootstrap, not actual community geography. |
| Layout inspection | Desktop/mobile screenshots inspected. Additional 360px and 720 CSS-pixel reflow checks showed no horizontal overflow; narrow schematic spacing and low-contrast text corrected. This is not a full manual assistive-technology audit. |
| Documented development startup | `npm run dev` starts database-backed API on 3000 and Vite on 5173; local `/api/health` and proxied `/api/auth/me` checked. |
| Administrator bootstrap | Actual CLI created an administrator and a hashed single-use invitation in a disposable database; repeat initialization was refused. No production administrator or sample users seeded. |
| Production image builds | Both images built successfully with frozen dependencies, TLS/npm integrity verification and trusted cloud-proxy CA. Cloud BuildKit needed resolved proxy hostname mapping; reusable `npm run build:cloud` handles it. |
| Production container functional checks | Real invite signup, Secure/HttpOnly/SameSite=Strict cookies, create/join group, private chat, outsider denial, anonymous board denial and post-leave revocation passed through Nginx against `tenx_container_test`. Test database removed afterward. |
| Container permissions | API runs as UID 1000; Nginx as UID 101. `COPY --chown` handles cloud checkout file permissions. Application/web filesystems read-only; dropped capabilities. Build proxy/CA credentials were absent from runtime image environment/files. |
| Container readiness and serving | Normal Mongo/API healthy; Nginx served final HTML and hashed assets with CSP, privacy/frame/referrer headers and immutable asset caching. |
| Database privilege and persistence | Application user restricted to `readWrite` on `tenx`. Sentinel in a separate test database survived Mongo container restart; API reconnected. Sentinel database removed. This was a persistence check, not a backup/restore drill. |
| Dependency audit | Backend production dependencies, complete client dependency tree and complete root tooling tree each report zero known npm audit vulnerabilities after compatible updates. This is a point-in-time advisory check, not a security certification. |
| Independent source review | Auth, invite privacy, capacity races, cancellation/message races, deletion/suspension, disconnect handling, canonical lock keys, retention, moderation, deployment and CI reviewed. No unresolved severe finding under the documented single-API-process topology. |
| Legacy integration removal | No Clerk, Razorpay, Google Maps or driver/vehicle/payment source or dependencies remain in backend/client. New data uses `tenx_*` collections; no silent legacy-data migration. |
| CI | Workflow committed for lint/build and both real-database suites. Local equivalent passed; remote GitHub Actions execution has not been claimed. |

Backend scenarios cover authentication/CSRF/readiness/no-store, real invite signup/login/logout, five competing joins for two open places, strict board projections, room access and revocation, moderation/suspension, deletion/anonymisation, paginated directory coverage, actual password recovery, and expiry independent of eventual TTL deletion. Browser scenarios cover landing privacy/accessibility, real registration/cookie/logout, IST-to-UTC posting, join/chat/leave/cancel, and administrator invite/directory controls.

Browser reports, screenshots and traces are local generated artifacts under ignored `playwright-report` and `test-results`. Test accounts and test databases are separate from the community database. No fake departures, accounts or statistics were added to the normal community database.

## Scope and launch prerequisites

- Configure the real HTTPS hostname, certificates, trusted proxy/IP chain and HSTS. Container tests used local transport and inspected production cookie flags; a live public TLS deployment remains untested.
- Bootstrap the community administrator, verify invite recipients and define the abuse-response contact and moderation process.
- Apply the saved map-download/geocoding domain additions in cloud environment settings, obtain the verified local PMTiles extract and landmark manifest, then validate real map rendering, locality limits and attribution as documented in LOCALITY_MAP.md.
- Confirm physical meetup points and locally permitted auto passenger capacity. The route diagram is a schematic, not verified navigation.
- Configure restricted, encrypted backups; set and communicate backup retention; perform an actual restore drill and reconcile account deletions after restores.
- For Atlas, create the restricted app identity and network access, supply the URI securely, and validate the actual cluster. No Atlas credentials were available or requested in chat.
- Run one API process. Multiple replicas require transactions/distributed coordination for the process-local account/group locks.
- Operator-assisted password recovery requires the API stopped and community identity verification. There is no public email-reset endpoint, delivery provider, push notification service or background notification promise.
- Complete a human accessibility/usability review with residents before broad rollout. Invite-only membership and an in-app report are not guarantees of personal safety.

## Cloud environment configuration

Reusable installation/startup instructions were updated for this rebuilt workflow. The earlier onboarding draft had Clerk, Google Maps and Razorpay requirements; these are now obsolete and should be removed in environment settings. The additive draft tool cannot delete previously declared credential requirements. No values for those obsolete integrations are needed by the app. Saved draft configuration is not publication or verification in a fresh task.

See [README.md](../README.md) for operational commands and [PRODUCT_PLAN.md](PRODUCT_PLAN.md) for the design/privacy decisions. [LOCALITY_MAP.md](LOCALITY_MAP.md) records the confirmed Protomaps choice and the outstanding real-data provisioning requirement.
