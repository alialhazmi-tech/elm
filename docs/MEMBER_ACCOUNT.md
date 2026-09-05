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
