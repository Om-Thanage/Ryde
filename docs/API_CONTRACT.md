# TenX Together implementation contract

All JSON responses; errors `{error: string}`. Same-origin browser requests use `/api`; Vite proxies `/api` to port 3000. Session cookie HttpOnly, SameSite=Strict, Secure in production. No tokens in localStorage. Browser sends `X-Requested-With: TenX` on mutations; server rejects missing header and cross-origin mutation requests. Auth aliases public, emails private. Timestamps ISO UTC; UI displays Asia/Kolkata.

## Authentication
- `GET /api/auth/me` => `{user: null | {id, alias, role}}`.
- `POST /api/auth/register` `{alias,email,password,inviteCode}` => `{user}` (201).
- `POST /api/auth/login` `{email,password}` => `{user}`.
- `POST /api/auth/logout` => `{ok:true}`.
- `DELETE /api/auth/account` `{password}` => `{ok:true}`; revoke sessions, remove memberships, cancel hosted future groups, remove authored chats, anonymize reports referencing account.
- No self-selected admin role. Bootstrap admin using local CLI, documented. Invitations are expiring single-use codes, stored hashed. First administrator bootstrap CLI also creates an invite. No shared production invite code.

## Groups (authenticated only)
- `GET /api/groups?direction=to-station|to-tenx&date=YYYY-MM-DD` => `{groups:[Group]}`. Date is India calendar date; omit => upcoming 48h. Returns active future groups only; no email or other private contact details, participant arrays or join histories on board.
- `GET /api/groups/mine` => `{groups:[Group]}` upcoming groups where member or host.
- `POST /api/groups` `{direction,departureAt,windowMinutes,meetingPoint}` => `{group:Group}` (201). Direction two enums; start 5min to 7days ahead, windowMinutes 5|10|15, meetingPoint one of fixed direction-specific enum values. Capacity fixed three including host. No free-text publicly exposed notes or exact flat addresses.
- `GET /api/groups/:id` => `{group:Group,members?:[{id,alias}],messages?:[Message]}`. Members and messages only returned to joined members; nonmembers get board projection.
- `POST /api/groups/:id/join` => `{group}`. Atomic capacity bound, no duplicate membership, no joining own cancelled/past groups, blocked accounts rejected.
- `POST /api/groups/:id/leave` => `{ok:true}`. Host must cancel rather than leave. Leaving immediately revokes chat access.
- `POST /api/groups/:id/cancel` => `{group}` host/admin only.
- `GET /api/groups/:id/messages` => `{messages:[Message]}` joined members only.
- `POST /api/groups/:id/messages` `{text}` => `{message}` (201). Plain text 1..500 chars, joined members only, no raw HTML; no public phone/email sharing.

Group `{id,direction,departureAt,windowMinutes,meetingPoint,status,capacity:3,memberCount,hostAlias,isMember,isHost}`. status active|cancelled. Group members' names visible only in private room except host alias. Message `{id,alias,text,createdAt,isOwn}`.
Meeting points: `to-station`: `tenx-main-gate`, `tenx-auto-stand`; `to-tenx`: `station-west-auto-stand`, `station-west-exit`. Labels in client; admin must verify precise meeting instructions before launch. Map schematic explicitly not navigation.

## Moderation
- `POST /api/reports` `{groupId,reason}` => `{ok:true}`; enums spam|harassment|unsafe|other. No reporter identity exposed to reported member.
- `GET /api/admin/reports` => `{reports:[{id,reason,groupId,reporterAlias,createdAt,status}]}` admin only.
- `POST /api/admin/reports/:id/resolve` => `{ok:true}`.
- `POST /api/admin/invites` => `{code,expiresAt}` admin only; random high-entropy single-use code, default expiry 7days.
- `POST /api/admin/members/:id/suspend` => `{ok:true}`; admin only, revoke sessions, remove memberships and cancel hosted groups.
- `GET /api/health` => `{status:'ok'}` only when DB ready else 503.

Use MongoDB TTL indexes for sessions/invites (enforce expiration in query too); group expiresAt = departure +24h; messages expireAt = departure+24h. UI says coordination is removed after 24h; backup retention independently documented. Reports kept 30 days. Sessions 7 days. Passwords scrypt with unique salts and timing safe verification. Rate limit login/register and mutations. Validate request bodies strictly with bounded strings; explicit Mongo projections. Catch errors without leaking stacks or credentials. Fail startup if production secrets/origin missing. Do not seed fake activity in production.

Additional moderation interface: `GET /api/admin/members?page=N` returns `{members:[{id,alias,role,suspended}],page,hasMore}` to admins only, bounded to 100 members per page with previous/next navigation. It exposes no contact details. Moderator UI uses this list for suspension. Operator-only password recovery is a local CLI that resets a password and revokes that member's sessions; it is not a public reset endpoint.
