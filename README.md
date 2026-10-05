# TenX Together

A private auto-pooling board for neighbours travelling between **TenX Raymond** and **Thane West Station**. Post a departure time, find up to two neighbours, and coordinate at a public meeting point. The app helps passengers meet; it does not book an auto or collect fares.

The rebuilt application replaces the previous driver/vehicle marketplace. Clerk, Razorpay, Google Maps, public contact details, live location and artificial activity have been removed. Community admission uses single-use invitations; authentication uses server-owned cookie sessions.

## What works

- Two directions, departure-date filters, and times displayed in India Standard Time.
- Three-person groups, including the organiser, with atomic capacity checks.
- Private group messages, join/leave, host cancellation and reporting.
- Administrator invitations, paginated member moderation and report resolution.
- Account deletion and operator-assisted password recovery.
- Authenticated Docker MongoDB with persistent storage and a least-privilege application user; Atlas uses the same connection setting.
- Responsive client, accessible controls, honest empty states and a two-stop route schematic.

The schematic is explicitly **not navigation** and sends no requests to map providers. “Proton Maps” could not be identified; Protomaps is a possible intended name. For this fixed route, a provider-free schematic is the privacy-preserving default. [The plan](docs/PRODUCT_PLAN.md) records MapLibre/Protomaps options and the research limitations. Exact meetup instructions must be confirmed by the community before launch.

## Local development

Prerequisites: Node.js **24 LTS**, npm, Docker and Docker Compose v2. Work in this existing checkout.

```bash
npm ci
npm run setup
```

Setup installs both lockfiles, generates an ignored `.env` with separate random root/application MongoDB passwords if absent, starts MongoDB, and builds the client. It preserves an existing `.env`. Database files persist in the `tenx-together_mongo-data` Docker volume; stop containers without deleting the volume. MongoDB is bound only to the host loopback interface.

Bootstrap the first community administrator once. Enter credentials locally; do not put passwords in chat or Git:

```bash
read -r -p 'Administrator email: ' BOOTSTRAP_EMAIL
read -r -p 'Public alias: ' BOOTSTRAP_ALIAS
read -r -s -p 'Password (at least 12 characters): ' BOOTSTRAP_PASSWORD
export BOOTSTRAP_EMAIL BOOTSTRAP_ALIAS BOOTSTRAP_PASSWORD
(cd backend && node --env-file=../.env scripts/bootstrap.js)
unset BOOTSTRAP_EMAIL BOOTSTRAP_ALIAS BOOTSTRAP_PASSWORD
npm run dev
```

The bootstrap command prints a single-use seven-day invitation. Share it securely with one verified resident. Sign in as the administrator to issue additional invitations. There is no default admin account or seeded production activity.

The client runs on port 5173; the API runs on 3000. Vite proxies `/api` to the API, keeping browser requests on one origin. `APP_ORIGIN` must match the exact client origin, including the hostname and port. Development defaults use `http://localhost:5173`. Do not switch between `localhost` and `127.0.0.1` without changing the configured origin. `Ctrl+C` stops both Node processes started by the development script.

```bash
# Start/stop the database independently; never add -v unless intentionally deleting all local data.
docker compose -f compose.yaml -f compose.mongo.yaml up -d --wait mongo
docker compose -f compose.yaml -f compose.mongo.yaml stop mongo
```

MongoDB initialization runs only on a new volume. Changing `.env` credentials does not rotate an existing database user; rotate using MongoDB administration tools. Existing legacy marketplace records are not migrated or reused: community data lives in new `tenx_*` collections.

## Validation

```bash
npm run test:backend
npm run test:e2e
npm --prefix client run lint
npm --prefix client run build
```

Backend tests use a separate `tenx_backend_test` database. Browser tests start an isolated API on 3100 and client on 4173, with `tenx_browser_test`. Local test helpers use the generated Docker root identity for those disposable test databases; the application itself uses only `readWrite` on `tenx`. Never point tests at live community data. A supplied `TEST_MONGO_URI` or `E2E_MONGO_URI` must select a database ending in `_test`. Backend tests drop that dedicated test database.

Playwright uses an installed `/usr/bin/chromium` when available. Otherwise install its Chromium browser with `npx playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`. The tests exercise desktop and mobile Chromium, real authentication, UTC/IST conversion, group coordination, privacy payloads, keyboard entry and automated WCAG accessibility checks. Automated checks do not replace a human accessibility review. HTML reports and screenshots are generated under ignored `playwright-report` and `test-results` directories.

[VALIDATION.md](docs/VALIDATION.md) records actual results and remaining launch work. The [API contract](docs/API_CONTRACT.md) and [product plan](docs/PRODUCT_PLAN.md) describe behaviour and rationale.

## Production deployment

Run **one API process**. Account/group mutation locks are process-local; multiple replicas require database transactions or distributed coordination before scaling. Do not silently increase the replica count.

Use a real HTTPS origin in deployment `.env` or injected configuration:

```env
APP_ORIGIN=https://pool.your-community.example
WEB_PORT=8080
```

Build and launch with the local database overlay:

```bash
docker compose -f compose.yaml -f compose.mongo.yaml build
docker compose -f compose.yaml -f compose.mongo.yaml up -d --wait
```

The backend refuses to start in production with an HTTP origin. The supplied Nginx serves the built client and proxies `/api`, with CSP and privacy headers. Put a TLS reverse proxy in front of the loopback-only web port. Configure certificates, HSTS and a trusted real-client-IP chain there. Secure cookies require HTTPS: the production Compose stack is not a development HTTP login configuration. Health checks use internal HTTP and do not need browser sessions.

Compose sets `TRUST_PROXY_HOPS=1` for the supplied Nginx hop. Nginx overwrites forwarded client-IP headers, which protects the API from spoofing when accessed through that topology. An additional TLS proxy changes the client-IP topology: configure Nginx `real_ip` only for the known proxy network, then forward the resulting real client address. Do not trust arbitrary forwarded headers or expose the API directly. Auth limits apply per IP; shared NAT networks may need measured tuning. API reads and mutations have separate rate limits.

Containers run without root, with read-only application filesystems and dropped Linux capabilities. MongoDB remains private; its root identity is for operations only. Preserve the generated `.env` permissions and supply credentials securely through the deployment system. Images use supported major-version tags: resolve and pin tested digests for a production release, then update them deliberately.

For a corporate/cloud build proxy, Docker supports proxy build arguments. Both Dockerfiles accept an optional BuildKit secret named `npm_ca` containing the trusted proxy CA. Configure build networking and that secret for your environment; keep TLS and npm integrity checks enabled. Never put proxy credentials in a Dockerfile or disable certificate validation. In this cloud, run `npm run build:cloud`: the helper resolves the proxy hostname, supplies a temporary BuildKit host mapping, forwards the proxy settings, and mounts the trusted CA without storing it in the image. The cloud onboarding build additionally used host build networking; normal non-proxied machines do not need that override.

### MongoDB Atlas

Use the base Compose file without the local database overlay:

```env
MONGO_URI=mongodb+srv://APP_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER/tenx?retryWrites=true&w=majority
APP_ORIGIN=https://pool.your-community.example
```

```bash
docker compose build
docker compose up -d --wait
```

Create an Atlas application user limited to `readWrite` on `tenx`, allow the deployment's actual outbound IPs/private network, and retain TLS verification. Keep the URI out of the client bundle and Git. Local Docker credentials are not Atlas credentials. Atlas connectivity has not been tested without your cluster configuration. Back up and explicitly migrate data if moving an existing community database.

## Privacy, retention and recovery

The board exposes direction, departure time, organiser alias and place count to signed-in members. It never exposes email, phone, flat number, member roster or history. Joined members see each other's aliases and private room messages. Community admins can list aliases for moderation; they do not get blanket access to private messages. “Private” means access controlled, not end-to-end encrypted: database operators can access stored messages. Invite-only membership is not identity or safety verification.

Groups/messages become inaccessible 24 hours after departure and are subsequently removed by MongoDB's eventual TTL cleanup. Report retention is 30 days, sessions and invitations seven days. Deletion removes memberships and authored messages, revokes sessions, cancels upcoming hosted groups and anonymises relevant reports. Backups have their own retention: restrict access, encrypt them and set a short documented schedule. Restoring a backup may resurrect deleted records; reconcile deletions before reopening access.

For an operator-assisted password reset, verify the resident through the community process, **stop the API**, then run:

```bash
read -r -p 'Member email: ' RECOVERY_EMAIL
read -r -s -p 'New password (at least 12 characters): ' RECOVERY_PASSWORD
export RECOVERY_EMAIL RECOVERY_PASSWORD
(cd backend && node --env-file=../.env scripts/reset-password.js)
unset RECOVERY_EMAIL RECOVERY_PASSWORD
```

The command resets the password and revokes every session. Restart the API afterward. In Compose, stop `api` and use `docker compose run --rm --no-deps -e RECOVERY_EMAIL -e RECOVERY_PASSWORD api node scripts/reset-password.js`, including the same overlay files as the running deployment. Suspended accounts are not re-enabled by a password reset. There is no public reset endpoint or email delivery provider.

## Before inviting the community

Choose the hosting domain and TLS proxy, bootstrap an administrator, confirm meeting points and permitted auto capacity, and establish an abuse-response contact/process. Perform an encrypted backup and restore drill, decide backup retention, test the actual deployment's Atlas/local database connectivity, and review the deployed origin/rate-limit settings. These operational steps require your community and deployment details and are not claimed as completed by a local test run.

Notifications, recurring schedules, train-time feeds, car-driver matching and geographic maps are not part of this release. In-app coordination polls while the page is visible; it does not promise background notification delivery.
