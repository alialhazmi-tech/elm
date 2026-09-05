# Member account

The member area uses Neon Auth for identity and the existing PostgreSQL member
tables for preferences, saved stories, likes, and reading activity. It does not
share the public content cache: every private query and mutation is scoped to the
authenticated session's user ID.

## Routes and behavior

- `/join`: registration, login, and password reset requests. Forms are disabled
  when the auth configuration is missing.
- `/join/reset`: token-based password reset; no indexing or outgoing referrer.
- `/account`: protected overview, saved stories, likes, reading history,
  interests, and settings. Collections have 12-item pagination and exclude
  unpublished or hidden stories.
- Settings support name updates, password changes with other sessions revoked,
  email verification with a six-digit OTP, personalization, newsletter preferences, and confirmed
  clearing of inferred activity. Clearing preserves explicit interests, saves,
  and likes. Database failures show an unavailable state instead of empty data
  or a false success message.
- `/prototype/account`: clearly labeled illustrative data for local visual
  review. Returns 404 in production unless `MEMBERSHIP_PROTOTYPE=1` is explicitly
  set. It does not bypass authentication for account actions.

## Activation requirements

The deployed environment needs `NEON_AUTH_BASE_URL` and a securely generated
`NEON_AUTH_COOKIE_SECRET`, from the current production Neon project. Verify the
project against the production database endpoint before configuring it. Do not
use the archived `elm` project from a different region.

Configure the canonical `https://alelm.net` origin and verify provider email
delivery. Password reset callbacks use `/join/reset`; verification codes are
entered in account settings. For local development only, set
`MEMBER_AUTH_APP_URL=http://localhost:3105` to return reset requests to their
origin. Production ignores this override. Existing member table migrations must be applied through
the normal migration workflow.

Before declaring activation complete, verify registration, verification email,
login, onboarding, member persistence, password reset, and logout against the
actual provider in the target environment. Local integration tests substitute
the provider boundary and do not establish email delivery or live auth readiness.

## Verification

Run `npm test`, then run `npm run test:integration` with `TEST_DATABASE_URL`
pointing to an isolated local `alelm_test*` database. Integration tests migrate
and clear their fixture tables; never target production.

`tests/member-account.integration.mjs` exercises the actual server actions and
account loader against PostgreSQL, including cross-account isolation, expired
sessions, validation, pagination, explicit preference writes, confirmed clearing,
and unavailable storage.

## Activation record — 2026-09-05

- Confirmed project `snowy-voice-13829598` (`alelm`, Frankfurt), production
  branch `br-broad-paper-b2wfhrz5`, matches the application's database endpoint.
- The imported `neon_auth` schema still referenced the old `elm` endpoint.
  Auth provisioning returned 409 because the schema existed without an active
  integration in the current project.
- Rehearsed activation on isolated branch `br-restless-rice-b23rldsm`
  (`codex/member-auth-activation-20260905`). Preserved the old schema as
  `neon_auth_legacy_20260905`, provisioned managed Better Auth, and restored the
  two existing users and their two account records without changing IDs or
  credential values. Verified bidirectional row equality before applying the
  same procedure to production. No external foreign keys referenced the old
  auth tables. Old sessions and signing keys were not imported into the new
  service.
- Production Neon Auth is enabled with application name `العلم` and trusted
  origin `https://alelm.net`. Production auth environment values are saved in
  the ignored local environment file and the production Railway service `elm`
  (`d20d73c0-e417-448e-a0cd-5e53f2fd28db`). The two variables were set with
  deployment deferred so that activation uses the reviewed application release.
- The user confirmed no dedicated email service exists. Shared Neon email is
  configured provisionally; migrate to dedicated SMTP before a general launch
  requiring production delivery capacity. Its actual inbox delivery has not
  been verified. Verification uses OTP because shared SMTP does not support
  verification links. Password reset links are supported.
- Actual provider tests on the isolated branch passed signup, authenticated
  session, password change, rejection of the old password, login, logout, reset
  request, reset completion, and rejection of token reuse. Reset completion used
  the provider-created token for the disposable test member, read directly from
  the isolated database; this does not prove delivery to an inbox.
- Browser tests passed signup, onboarding interest persistence, protected
  account rendering, updating the name through the actual server action,
  logout followed by a protected-page redirect, and the password-reset request.
  The preview server uses the isolated branch. The separate prototype route
  remains illustrative data.
- Final local gate passed: lint (one existing image warning), typecheck,
  production build, 206 unit tests, performance budget, and the full PostgreSQL
  integration suite (including 16 member-account checks).

## Profile images, editor identity, and audience administration

The public header reads `/api/viewer` with `private, no-store`. It exposes only the current viewer's name and locally stored avatar, independently for the member and editorial sessions. A single account control is shown in the header. Its menu includes the member profile and, when an editorial session exists, the editor profile and dashboard. The public member identity takes precedence on the button when both sessions exist. Window focus, navigation, and successful avatar updates refresh this data; no private identity enters the public content cache.

`ProfileAvatar` renders the stored image consistently in the public account menu, member profile (including mobile), audience list/details, editorial header/sidebar, administrative account list/dialogs, and audit actor cells/details. Missing, invalid, or failed images fall back to the name's initial. Audit avatars and display names describe the current account; the original recorded actor remains unchanged.

- `/account?tab=settings`: upload/change/remove the member's image.
- `/tahrir/profile`: editor's own image, display name, account facts, and security link. Every active editorial role can update its own profile; client-supplied user IDs or roles are ignored.
- `/tahrir/members`: audience accounts from `neon_auth.user`, with name, email, live verification state, account status, join date, details, filters, and 25-row pagination. `users.view` gates access; `users.suspend` gates suspension/reactivation. Suspension requires a reason and both status changes and editor profile changes are audited.
- `/tahrir/admin-accounts`: the existing administrative accounts screen, renamed and moved. Existing administrative APIs remain unchanged.

Migration `0007_profile_avatars_member_status` adds `users.avatar_url` and the member profile's avatar/status/reason fields. Apply it before deploying this release. The managed Neon Auth schema is read-only; UUID identifiers are cast to text for the join with application profiles. Missing member profiles represent active members with no avatar.

All membership pages, actions and personalization endpoints use a live application status check. A suspended member cannot use these services even with an existing Auth cookie. The Auth proxy hides suspended sessions and blocks their authenticated operations, while allowing sign-out. Suspension does not delete their data or claim to disable the underlying Neon identity; reactivation restores access.

Avatar requests require the relevant live session, a trusted origin and a database-backed rate limit. Multipart input is bounded, including requests without Content-Length. JPEG/PNG/WebP are decoded with a pixel cap, EXIF/GPS metadata removed, and the result center-cropped to 384×384 WebP. Generated UUID objects are stored and verified using the existing S3-compatible image store, outside the editorial media library. The UI accepts files up to 4 MiB. Profile removal clears the profile reference; previously generated immutable image objects are not automatically purged.

Validation covers account ownership, permission denial, suspension/reactivation and audit, filtered pagination, real UUID schema joins, invalid/oversized image rejection, metadata removal, and image propagation to the viewer response. Run `tests/profiles-audience.integration.mjs` and `tests/member-account.integration.mjs` only against an isolated `alelm_test*` database. Preview migration and real image storage were also exercised on the isolated Neon development branch, without modifying production member records.
